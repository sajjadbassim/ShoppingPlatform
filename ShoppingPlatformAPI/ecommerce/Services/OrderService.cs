using ecommerce.Core;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.Models;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public class OrderService : IOrderService
    {
        private readonly IOrderRepository _orderRepository;
        private readonly ISubOrderRepository _subOrderRepository;
        private readonly ICartRepository _cartRepository;
        private readonly IUserRepository _userRepository;
        private readonly IAddressRepository _addressRepository;
        private readonly IOrderStatusLogRepository _orderStatusLogRepository;
        private readonly INotificationService _notificationService;
        private readonly AppDbContext _context;
        private readonly ICouponService _couponService;
        private readonly ICouponRepository _couponRepository;
        private readonly ILoyaltyService _loyaltyService;
        private readonly IPromotionService _promotionService;
        private readonly IInventoryService _inventoryService;

        public OrderService(
            IOrderRepository orderRepository,
            ISubOrderRepository subOrderRepository,
            ICartRepository cartRepository,
            IUserRepository userRepository,
            IAddressRepository addressRepository,
            IOrderStatusLogRepository orderStatusLogRepository,
            INotificationService notificationService,
            AppDbContext context,
            ICouponService couponService,
            ICouponRepository couponRepository,
            ILoyaltyService loyaltyService,
            IPromotionService promotionService,
            IInventoryService inventoryService)
        {
            _orderRepository = orderRepository;
            _subOrderRepository = subOrderRepository;
            _cartRepository = cartRepository;
            _userRepository = userRepository;
            _addressRepository = addressRepository;
            _orderStatusLogRepository = orderStatusLogRepository;
            _notificationService = notificationService;
            _context = context;
            _couponService = couponService;
            _couponRepository = couponRepository;
            _loyaltyService = loyaltyService;
            _promotionService = promotionService;
            _inventoryService = inventoryService;
        }

        public async Task<OrderResponseDto> CreateOrderFromCartAsync(Guid userId, CreateOrderDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("المستخدم غير موجود");
            // الشراء يتطلب رقم هاتف في الحساب (حسابات Google تُنشأ بلا هاتف)
            if (string.IsNullOrWhiteSpace(user.Phone))
                throw new Exception("أضف رقم هاتفك لإكمال الطلب");

            // مهلة تأكيد المتجر من الإعدادات (الافتراضي 5 دقائق)
            var confirmationMinutes = await _context.DeliverySettings.AsNoTracking()
                .Select(x => (int?)x.ConfirmationTimeoutMinutes).FirstOrDefaultAsync() is int m and >= 1 and <= 240 ? m : 5;

            var address = await _addressRepository.GetByIdAsync(dto.AddressId);
            if (address == null) throw new Exception("العنوان غير موجود");
            if (address.UserId != userId) throw new Exception("هذا العنوان غير مسجل باسمك");

            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null || cart.Items == null || !cart.Items.Any())
                throw new Exception("السلة فارغة");

            var errors = new List<string>();

            foreach (var item in cart.Items)
            {
                if (!item.Product.IsActive || !item.Product.IsAvailable)
                    errors.Add($"المنتج '{item.Product.Name}' غير متوفر");

                if (item.Variant != null)
                {
                    if (!item.Variant.IsAvailable)
                        errors.Add($"المتغير '{item.Variant.Sku}' غير متوفر حالياً");
                    if (item.Quantity > item.Variant.StockQuantity)
                        errors.Add($"المنتج '{item.Product.Name}' الكمية المتوفرة من هذا المتغير فقط {item.Variant.StockQuantity}");
                }
                else
                {
                    if (item.Quantity > item.Product.StockQuantity)
                        errors.Add($"المنتج '{item.Product.Name}' الكمية المتوفرة فقط {item.Product.StockQuantity}");
                }
            }

            if (errors.Any()) throw new Exception(string.Join(", ", errors));

            // ✅ سعر الوحدة الفعلي بعد تطبيق أفضل عرض فعّال على كل منتج (يُحسب مرة واحدة ويُعاد استخدامه)
            var unitPrices = new Dictionary<Guid, decimal>();
            foreach (var item in cart.Items)
            {
                var promoPrice = await _promotionService.CalculateFinalPriceAsync(
                    item.ProductId,
                    item.Product.CategoryId ?? Guid.Empty,
                    item.Product.VendorId,
                    item.Product.Price);

                unitPrices[item.Id] = item.Variant != null
                    ? promoPrice + item.Variant.PriceAdjustment
                    : promoPrice;
            }

            var vendorGroups = cart.Items.GroupBy(i => i.Product.VendorId);
            decimal totalSubtotal = 0;
            decimal totalDelivery = 0;
            // رسوم التوصيل: سعر منطقة العنوان للمتاجر المشمولة بالمناطق، وإلا سعر المتجر الثابت
            var feeRules = await DeliveryFeeRules.LoadAsync(_context, address.ZoneId);

            foreach (var group in vendorGroups)
            {
                var vendor = group.First().Product.Vendor;
                var vendorSubtotal = group.Sum(i => unitPrices[i.Id] * i.Quantity);
                totalSubtotal += vendorSubtotal;
                totalDelivery += feeRules.FeeFor(vendor);
                if (vendorSubtotal < vendor.MinOrderAmount)
                    errors.Add($"الطلب من '{vendor.Name}' أقل من الحد الأدنى ({vendor.MinOrderAmount} دينار)");
            }

            if (errors.Any()) throw new Exception(string.Join(", ", errors));
            var zoneUsed = vendorGroups.Any(g => feeRules.UsesZone(g.First().Product.Vendor));

            // إنشاء الطلب كاملاً في معاملة واحدة: إذا فشل أي جزء يُتراجع عن خصم المخزون أيضاً
            Order order;
            List<StockChange> stockChanges;

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // خصم المخزون عند إنشاء الطلب (ذرياً) — يمنع بيع نفس القطعة لزبونين في نفس الوقت
                stockChanges = await _inventoryService.ReserveAsync(cart.Items.Select(i => new StockLine(
                    i.ProductId, i.VariantId, i.Quantity,
                    i.Variant != null ? $"{i.Product.Name} ({i.Variant.Sku})" : i.Product.Name)));

                decimal discountAmount = 0;
                Guid? appliedCouponId = null;

                if (!string.IsNullOrWhiteSpace(dto.CouponCode))
                {
                    var couponValidation = await _couponService.ValidateAsync(userId, new ValidateCouponDto { Code = dto.CouponCode, OrderAmount = totalSubtotal });
                    if (!couponValidation.IsValid) throw new Exception($"الكوبون غير صالح: {couponValidation.ErrorMessage}");
                    discountAmount = couponValidation.DiscountAmount;
                    var coupon = await _couponRepository.GetByCodeAsync(dto.CouponCode);
                    appliedCouponId = coupon?.Id;
                }

                var orderNumber = await _orderRepository.GenerateOrderNumberAsync();

                order = new Order
                {
                    OrderNumber = orderNumber,
                    CustomerId = userId,
                    AddressId = dto.AddressId,
                    Status = OrderStatus.PENDING_CONFIRMATION,
                    Subtotal = totalSubtotal,
                    DeliveryFees = totalDelivery,
                    DiscountAmount = discountAmount,
                    TotalAmount = totalSubtotal + totalDelivery - discountAmount,
                    CouponCode = dto.CouponCode?.ToUpper(),
                    PaymentMethod = PaymentMethods.COD,
                    PaymentStatus = PaymentStatus.Pending,
                    CustomerNotes = dto.CustomerNotes,
                    DeliveryLatitude = address.Latitude,
                    DeliveryLongitude = address.Longitude,
                    DeliveryZoneId = zoneUsed ? feeRules.Zone!.Id : null,
                    DeliveryZoneName = zoneUsed ? feeRules.Zone!.Name : null
                };

                order = await _orderRepository.CreateAsync(order);

                if (appliedCouponId.HasValue && discountAmount > 0)
                {
                    await _couponRepository.RecordUsageAsync(new CouponUsage { CouponId = appliedCouponId.Value, UserId = userId, OrderId = order.Id, DiscountAmount = discountAmount });
                    await _couponRepository.IncrementUsageCountAsync(appliedCouponId.Value);
                }

                await LogOrderStatusChangeAsync(order.Id, "", order.Status, userId, "إنشاء طلب جديد");
                await _notificationService.NotifyNewOrderAsync(order.Id, order.OrderNumber);

                int vendorIndex = 1;

                foreach (var group in vendorGroups)
                {
                    var vendor = group.First().Product.Vendor;
                    var vendorSubtotal = group.Sum(i => unitPrices[i.Id] * i.Quantity);

                    var subOrder = new SubOrder
                    {
                        OrderId = order.Id,
                        VendorId = vendor.Id,
                        SubOrderNumber = $"{orderNumber}-V{vendorIndex}",
                        Status = SubOrderStatus.PendingConfirmation,
                        Subtotal = vendorSubtotal,
                        DeliveryFee = feeRules.FeeFor(vendor),
                        ConfirmationDeadline = DateTime.UtcNow.AddMinutes(confirmationMinutes)
                    };

                    subOrder = await _subOrderRepository.CreateAsync(subOrder);
                    await _notificationService.NotifyNewSubOrderAsync(subOrder.Id, subOrder.SubOrderNumber, vendor.Id);
                    await LogSubOrderStatusChangeAsync(subOrder.Id, "", subOrder.Status, userId, $"إنشاء طلب فرعي للمتجر {vendor.Name}");

                    foreach (var cartItem in group)
                    {
                        // ✅ السعر (بعد العروض) والصورة من الـ Variant إن وجد
                        var unitPrice = unitPrices[cartItem.Id];

                        var image = cartItem.Variant?.ImageUrl
                            ?? cartItem.Product.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl
                            ?? cartItem.Product.Images?.FirstOrDefault()?.ImageUrl
                            ?? "";

                        await _subOrderRepository.CreateItemAsync(new SubOrderItem
                        {
                            SubOrderId = subOrder.Id,
                            ProductId = cartItem.ProductId,
                            VariantId = cartItem.VariantId, // ✅
                            ProductName = cartItem.Product.Name,
                            ProductNameAr = cartItem.Product.NameAr,
                            ProductImageUrl = image,
                            UnitPrice = unitPrice,          // ✅
                            Quantity = cartItem.Quantity,
                            Subtotal = unitPrice * cartItem.Quantity
                        });
                    }

                    vendorIndex++;
                }

                await _cartRepository.ClearCartAsync(cart.Id);
                await _notificationService.NotifyCustomerAsync(userId, "تم إنشاء طلبك بنجاح", new { orderId = order.Id, orderNumber = order.OrderNumber });

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            await _inventoryService.NotifyLowStockAsync(stockChanges);

            return MapToDto(await _orderRepository.GetByIdAsync(order.Id));
        }

        public async Task<OrderResponseDto> GetOrderByIdAsync(Guid orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null) throw new Exception("الطلب غير موجود");
            return MapToDto(order);
        }

        public async Task<OrderResponseDto> GetOrderByNumberAsync(string orderNumber)
        {
            var order = await _orderRepository.GetByOrderNumberAsync(orderNumber);
            if (order == null) throw new Exception("الطلب غير موجود");
            return MapToDto(order);
        }

        public async Task<IEnumerable<OrderResponseDto>> GetCustomerOrdersAsync(Guid customerId)
        {
            var orders = await _orderRepository.GetByCustomerAsync(customerId);
            return orders.Select(MapToDto);
        }

        public async Task<PagedResponse<OrderResponseDto>> GetPagedAsync(
            PaginationParams pagination, Guid? customerId = null, string orderNumber = null, string status = null)
        {
            var pagedOrders = await _orderRepository.GetPagedAsync(customerId, orderNumber, status, pagination.PageNumber, pagination.PageSize);
            // نفس تحويل صفحة التفاصيل: الزبون، العنوان، المتاجر، السائق والمنتجات
            var dtoList = pagedOrders.Items.Select(MapToDto).ToList();
            return new PagedResponse<OrderResponseDto>(dtoList, pagedOrders.TotalCount, pagedOrders.PageNumber, pagedOrders.PageSize);
        }

        public Task<Dictionary<string, int>> GetStatusCountsAsync() => _orderRepository.GetStatusCountsAsync();

        public async Task<OrderTrackingDto> GetOrderTrackingAsync(Guid orderId, Guid customerId, bool isAdmin = false)
        {
            var order = await _context.Orders
                .Include(o => o.SubOrders).ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders).ThenInclude(so => so.Driver)
                .Include(o => o.SubOrders).ThenInclude(so => so.StatusLogs)
                .Include(o => o.StatusLogs)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null) throw new Exception("الطلب غير موجود");
            if (!isAdmin && order.CustomerId != customerId) throw new UnauthorizedAccessException("ليس لديك صلاحية لعرض هذا الطلب");

            var allStatuses = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED };
            var statusArMap = new Dictionary<string, (string ar, string desc)>
            {
                { OrderStatus.PENDING_CONFIRMATION, ("بانتظار التأكيد", "تم استلام طلبك وهو بانتظار التأكيد") },
                { OrderStatus.CONFIRMED,            ("تم التأكيد",      "تم تأكيد طلبك وسيبدأ التحضير قريباً") },
                { OrderStatus.PREPARING,            ("قيد التحضير",    "يتم تحضير طلبك الآن") },
                { OrderStatus.OUT_FOR_DELIVERY,     ("في الطريق إليك", "طلبك في الطريق إليك") },
                { OrderStatus.DELIVERED,            ("تم التسليم",      "تم تسليم طلبك بنجاح") },
                { OrderStatus.CANCELLED,            ("ملغي",            "تم إلغاء الطلب") },
            };

            var completedStatuses = order.StatusLogs.Where(l => l.OrderId == orderId).Select(l => l.NewStatus).ToHashSet();
            var timeline = allStatuses.Select(status =>
            {
                var log = order.StatusLogs.Where(l => l.OrderId == orderId && l.NewStatus == status).OrderBy(l => l.CreatedAt).FirstOrDefault();
                var (ar, desc) = statusArMap.GetValueOrDefault(status, (status, ""));
                return new TrackingTimelineDto { Status = status, StatusAr = ar, Description = desc, OccurredAt = log?.CreatedAt, IsCompleted = completedStatuses.Contains(status), IsCurrent = order.Status == status };
            }).ToList();

            var subOrdersTracking = order.SubOrders.Select(so =>
            {
                var subTimeline = allStatuses.Select(status =>
                {
                    var log = so.StatusLogs?.Where(l => l.SubOrderId == so.Id && l.NewStatus == status).OrderBy(l => l.CreatedAt).FirstOrDefault();
                    var (ar, desc) = statusArMap.GetValueOrDefault(status, (status, ""));
                    return new TrackingTimelineDto { Status = status, StatusAr = ar, Description = desc, OccurredAt = log?.CreatedAt, IsCompleted = so.StatusLogs?.Any(l => l.SubOrderId == so.Id && l.NewStatus == status) == true, IsCurrent = so.Status == status };
                }).ToList();

                DriverTrackingDto? driverDto = so.Driver == null ? null : new DriverTrackingDto { DriverId = so.Driver.Id, DriverName = so.Driver.FullName, DriverPhone = so.Driver.Phone, VehicleType = so.Driver.VehicleType };
                return new SubOrderTrackingDto { SubOrderId = so.Id, SubOrderNumber = so.SubOrderNumber, VendorName = so.Vendor?.Name ?? "", Status = so.Status, Driver = driverDto, Timeline = subTimeline };
            }).ToList();

            return new OrderTrackingDto { OrderId = order.Id, OrderNumber = order.OrderNumber, CurrentStatus = order.Status, EstimatedDelivery = null, Timeline = timeline, SubOrders = subOrdersTracking };
        }

        public async Task<OrderResponseDto> CancelOrderAsync(Guid orderId, Guid customerId, CancelOrderDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var order = await _context.Orders.Include(o => o.SubOrders).FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null) throw new Exception("الطلب غير موجود");
                if (order.CustomerId != customerId) throw new UnauthorizedAccessException("ليس لديك صلاحية لإلغاء هذا الطلب");

                var cancellable = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED };
                if (!cancellable.Contains(order.Status))
                    throw new Exception($"لا يمكن إلغاء الطلب وهو «{OrderStatusText.Ar(order.Status)}»، الإلغاء متاح فقط قبل بدء التحضير");

                var oldStatus = order.Status;
                order.Status = OrderStatus.CANCELLED;
                order.CancellationReason = dto.Reason;
                order.UpdatedAt = DateTime.UtcNow;

                var cancelledSubOrderIds = order.SubOrders
                    .Where(so => so.Status != OrderStatus.CANCELLED)
                    .Select(so => so.Id)
                    .ToList();

                foreach (var subOrder in order.SubOrders.Where(so => so.Status != OrderStatus.CANCELLED))
                {
                    subOrder.Status = OrderStatus.CANCELLED;
                    subOrder.CancellationReason = dto.Reason;
                    subOrder.CancelledBy = customerId;
                    subOrder.CancelledAt = DateTime.UtcNow;
                    subOrder.UpdatedAt = DateTime.UtcNow;
                }

                await _context.OrderStatusLogs.AddAsync(new OrderStatusLog { OrderId = order.Id, OldStatus = oldStatus, NewStatus = OrderStatus.CANCELLED, ChangedBy = customerId, Reason = dto.Reason, Notes = "إلغاء من قِبل العميل" });
                await _context.SaveChangesAsync();

                // إعادة مخزون الطلبات الفرعية التي أُلغيت الآن (داخل نفس المعاملة)
                await _inventoryService.RestoreForSubOrdersAsync(cancelledSubOrderIds);

                await _loyaltyService.CancelRedemptionAsync(orderId);
                await transaction.CommitAsync();

                return await GetOrderByIdAsync(orderId);
            }
            catch { await transaction.RollbackAsync(); throw; }
        }

        private async Task LogOrderStatusChangeAsync(Guid orderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null, string notes = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { OrderId = orderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason, Notes = notes });
        }

        private async Task LogSubOrderStatusChangeAsync(Guid subOrderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null, string notes = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { SubOrderId = subOrderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason, Notes = notes });
        }

        private OrderResponseDto MapToDto(Order order)
        {
            var subOrdersDto = order.SubOrders?.Select(so => new SubOrderDto
            {
                Id = so.Id,
                SubOrderNumber = so.SubOrderNumber,
                Status = so.Status,
                VendorId = so.VendorId,
                VendorName = so.Vendor?.Name,
                VendorNameAr = so.Vendor?.NameAr,
                VendorPhone = so.Vendor?.Phone,
                Subtotal = so.Subtotal,
                DeliveryFee = so.DeliveryFee,
                ConfirmedBy = so.ConfirmedBy,
                ConfirmedByName = so.ConfirmedByUser?.FullName,
                ConfirmedAt = so.ConfirmedAt,
                ConfirmationDeadline = so.ConfirmationDeadline,
                MinutesRemaining = so.ConfirmationDeadline.HasValue ? (int)Math.Max(0, (so.ConfirmationDeadline.Value - DateTime.UtcNow).TotalMinutes) : null,
                CancellationReason = so.CancellationReason,
                FailureReason = so.FailureReason,
                FailureReasonAr = so.FailureReason == null ? null : DeliveryFailureReason.Ar(so.FailureReason),
                FailureNote = so.FailureNote,
                PickedUpAt = so.PickedUpAt,
                CancelledBy = so.CancelledBy,
                CancelledByName = so.CancelledByUser?.FullName,
                CancelledAt = so.CancelledAt,
                DriverId = so.DriverId,
                DriverName = so.Driver?.FullName,
                DriverPhone = so.Driver?.Phone,
                AssignedAt = so.AssignedAt,
                Items = so.Items?.Select(i => new SubOrderItemDto
                {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    ProductNameAr = i.ProductNameAr,
                    ProductImageUrl = i.ProductImageUrl,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    Subtotal = i.Subtotal,
                    // ✅ Variant
                    VariantId = i.VariantId,
                    VariantSku = i.Variant?.Sku,
                    VariantAttributes = i.Variant?.AttributeValues?
                        .OrderBy(av => av.AttributeValue?.Attribute?.DisplayOrder)
                        .Select(av => new VariantAttributeInfo
                        {
                            AttributeName = av.AttributeValue?.Attribute?.Name ?? "",
                            AttributeNameAr = av.AttributeValue?.Attribute?.NameAr ?? "",
                            Value = av.AttributeValue?.Value ?? "",
                            ValueAr = av.AttributeValue?.ValueAr ?? ""
                        }).ToList() ?? new()
                }).ToList(),
                CreatedAt = so.CreatedAt,
                UpdatedAt = so.UpdatedAt
            }).ToList();

            return new OrderResponseDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Status = order.Status,
                CustomerId = order.CustomerId,
                CustomerName = order.Customer?.FullName,
                CustomerPhone = order.Customer?.Phone,
                AddressId = order.AddressId,
                DeliveryAddress = $"{order.Address?.StreetAddress}, {order.Address?.Area}, {order.Address?.City}",
                DeliveryPhone = order.Address?.Phone,
                Subtotal = order.Subtotal,
                DeliveryFees = order.DeliveryFees,
                DiscountAmount = order.DiscountAmount,
                TotalAmount = order.TotalAmount,
                CouponCode = order.CouponCode,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                CustomerNotes = order.CustomerNotes,
                CancellationReason = order.CancellationReason,
                SubOrders = subOrdersDto,
                TotalSubOrders = subOrdersDto?.Count ?? 0,
                ConfirmedSubOrders = subOrdersDto?.Count(so => so.Status == SubOrderStatus.Confirmed) ?? 0,
                CancelledSubOrders = subOrdersDto?.Count(so => so.Status == SubOrderStatus.Cancelled) ?? 0,
                PendingSubOrders = subOrdersDto?.Count(so => so.Status == SubOrderStatus.PendingConfirmation) ?? 0,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt
            };
        }
    }
}