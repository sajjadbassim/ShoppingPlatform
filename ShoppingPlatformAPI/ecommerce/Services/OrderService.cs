using ecommerce.Services.DeliverySlotService;
using ecommerce.Core;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.Exceptions;
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
        private readonly ILogger<OrderService> _logger;
        private readonly IDeliverySlotService _deliverySlots;
        private readonly TimeProvider _time;

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
            IInventoryService inventoryService,
            ILogger<OrderService> logger,
            IDeliverySlotService? deliverySlots = null,
            TimeProvider? time = null)
        {
            _time = time ?? TimeProvider.System;
            _deliverySlots = deliverySlots ?? new DeliverySlotService.DeliverySlotService(context, _time);
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
            _logger = logger;
        }

        public async Task<OrderResponseDto> CreateOrderFromCartAsync(Guid userId, CreateOrderDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new NotFoundException("المستخدم غير موجود");
            // الشراء يتطلب رقم هاتف في الحساب (حسابات Google تُنشأ بلا هاتف)
            if (string.IsNullOrWhiteSpace(user.Phone))
                throw new BusinessRuleException("أضف رقم هاتفك لإكمال الطلب");

            // مهلة تأكيد المتجر من الإعدادات (الافتراضي 5 دقائق)
            var confirmationMinutes = await _context.DeliverySettings.AsNoTracking()
                .Select(x => (int?)x.ConfirmationTimeoutMinutes).FirstOrDefaultAsync() is int m and >= 1 and <= 240 ? m : 5;

            var address = await _addressRepository.GetByIdAsync(dto.AddressId);
            if (address == null) throw new NotFoundException("العنوان غير موجود");
            if (address.UserId != userId) throw new NotFoundException("العنوان غير موجود");   // لا نكشف وجود عنوان زبون آخر
            // بلا دبوس لا فحص لواسط ولا موقع لملاحة السائق — يُحفظ العنوان هكذا لكن لا يُطلب عليه
            if (address.Latitude == null || address.Longitude == null)
                throw new BusinessRuleException("حدّد موقع العنوان على الخريطة لإكمال الطلب — عدّل العنوان وضع الدبوس على باب البيت");
            if (!ServiceArea.Covers(address.Latitude, address.Longitude))
                throw new BusinessRuleException("عنوان التوصيل خارج منطقة التوصيل (محافظة واسط فقط) — اختر عنواناً آخر أو عدّل موقعه على الخريطة");

            var cart = await _cartRepository.GetByUserIdAsync(userId);
            if (cart == null || cart.Items == null || !cart.Items.Any())
                throw new BusinessRuleException("السلة فارغة");

            var errors = new List<string>();

            var cartProductIds = cart.Items.Select(i => i.ProductId).Distinct().ToList();
            var productsWithVariants = (await _context.ProductVariants
                    .Where(v => cartProductIds.Contains(v.ProductId))
                    .Select(v => v.ProductId)
                    .Distinct()
                    .ToListAsync())
                .ToHashSet();
            var hiddenCategoryIds = await CategoryVisibility.GetHiddenCategoryIdsAsync(_context);

            foreach (var item in cart.Items)
            {
                // المنتج ذو المتغيرات: التوفر من المتغير (يُتحقق منه أدناه)
                if (!item.Product.IsActive || (item.Variant == null && !item.Product.IsAvailable))
                    errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» غير متوفر");

                if (item.Product.Vendor == null || !item.Product.Vendor.IsActive)
                    errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» من متجر غير متاح حالياً");

                if (item.Product.CategoryId.HasValue && hiddenCategoryIds.Contains(item.Product.CategoryId.Value))
                    errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» غير متاح حالياً");

                if (item.Variant == null && productsWithVariants.Contains(item.ProductId))
                    errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» يحتاج اختيار الخيارات");

                if (item.Variant != null)
                {
                    if (!item.Variant.IsAvailable)
                        errors.Add($"الخيار المختار من «{item.Product.NameAr ?? item.Product.Name}» غير متوفر حالياً");
                    if (item.Quantity > item.Variant.StockQuantity)
                        errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» {StockText.Available(item.Variant.StockQuantity, variant: true)}");
                }
                else
                {
                    if (item.Quantity > item.Product.StockQuantity)
                        errors.Add($"المنتج «{item.Product.NameAr ?? item.Product.Name}» {StockText.Available(item.Product.StockQuantity)}");
                }
            }

            if (errors.Any()) throw new BusinessRuleException(string.Join("، ", errors));

            // منتجات السوبرماركت في السلة: موعد توصيل من الفترات المتاحة + ماذا نفعل إن نفد منتج
            var groceryIds = await CategoryVisibility.GetGroceryCategoryIdsAsync(_context);
            var groceryStores = cart.Items
                .Where(i => i.Product.CategoryId.HasValue && groceryIds.Contains(i.Product.CategoryId.Value) && i.Product.Vendor != null)
                .Select(i => i.Product.Vendor).DistinctBy(v => v.Id).ToList();
            DeliverySlotDto? slot = null;
            string? substitution = null;
            // موعد أُرسل لطلب بلا منتجات سوبرماركت: كان يُتجاهل بصمت فيظن الزبون أن طلبه بموعد
            if (groceryStores.Count == 0 && dto.DeliverySlotStart != null)
                throw new BusinessRuleException("موعد التوصيل متاح لطلبات السوبرماركت فقط — أرسل الطلب بلا موعد ويصلك في أقرب وقت");
            if (groceryStores.Count > 0)
            {
                // الموعد يجب أن يقع ضمن أوقات عمل متاجر السوبرماركت في السلة
                slot = await _deliverySlots.ResolveAsync(dto.DeliverySlotStart, groceryStores);
                substitution = SubstitutionPreference.Parse(dto.SubstitutionPreference);
            }

            // المتجر المغلق: الطلب الفوري يحتاج متجراً مفتوحاً الآن؛ طلب السوبرماركت بموعد يكفيه أن يعمل المتجر في الموعد
            // (تحقق منه ResolveAsync). إيقاف استقبال الطلبات يدوياً يمنع الحالتين
            var checkoutTime = _time.GetUtcNow().UtcDateTime;
            var scheduledStoreIds = slot != null ? groceryStores.Select(v => v.Id).ToHashSet() : new HashSet<Guid>();
            foreach (var vendor in cart.Items.Select(i => i.Product.Vendor).Where(v => v != null).DistinctBy(v => v.Id))
            {
                if (!vendor.IsAcceptingOrders)
                    errors.Add($"متجر «{vendor.NameAr ?? vendor.Name}»: المتجر لا يستقبل طلبات حالياً");
                else if (!scheduledStoreIds.Contains(vendor.Id) && StoreHours.Status(vendor, checkoutTime) is { IsOpen: false } closed)
                    errors.Add($"متجر «{vendor.NameAr ?? vendor.Name}»: {closed.Message}");
            }

            if (errors.Any()) throw new BusinessRuleException(string.Join("، ", errors));

            // ✅ سعر الوحدة الفعلي بعد تطبيق أفضل عرض فعّال على كل منتج (يُحسب مرة واحدة ويُعاد استخدامه)
            // العرض على السعر الكامل للمتغير (الأساسي + فرق المتغير) — نسبة الخصم نفسها على كل المقاسات
            var unitPrices = new Dictionary<Guid, decimal>(await _promotionService.CalculateFinalPricesAsync(cart.Items.Select(i =>
                new PriceQuery(i.ProductId, i.Product.CategoryId, i.Product.VendorId,
                    i.Product.Price + (i.Variant?.PriceAdjustment ?? 0), i.Id))));

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
                    errors.Add($"الطلب من «{vendor.NameAr ?? vendor.Name}» أقل من الحد الأدنى ({vendor.MinOrderAmount:N0} د.ع) — أضف {vendor.MinOrderAmount - vendorSubtotal:N0} د.ع");
            }

            if (errors.Any()) throw new BusinessRuleException(string.Join("، ", errors));
            var zoneUsed = vendorGroups.Any(g => feeRules.UsesZone(g.First().Product.Vendor));

            // إنشاء الطلب كاملاً في معاملة واحدة: إذا فشل أي جزء يُتراجع عن خصم المخزون أيضاً
            Order order;
            List<StockChange> stockChanges;
            var createdSubOrders = new List<SubOrder>();

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // إرسال الطلب مرتين معاً (نقرتان، شبكة بطيئة): قفل لكل زبون حتى نهاية المعاملة، ثم التأكد أن السلة
                // ما زالت كما قُرئت — الطلب الثاني ينتظر الأول فيجد سلته فارغة بدل أن ينشئ طلباً مكرراً
                var cartItemIds = cart.Items.Select(i => i.Id).ToList();
                if (_context.Database.IsSqlServer())
                {
                    var lockResult = (await _context.Database.SqlQuery<int>(
                        $"DECLARE @r int; EXEC @r = sp_getapplock @Resource = {OrderLock.CartResource(userId)}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS [Value]")
                        .ToListAsync()).FirstOrDefault(-1);
                    if (lockResult < 0) throw new ConflictException("طلبك السابق ما زال قيد الإرسال — حاول بعد لحظات");
                    var current = await _context.CartItems.AsNoTracking()
                        .Where(ci => cartItemIds.Contains(ci.Id))
                        .Select(ci => new { ci.Id, ci.Quantity }).ToListAsync();
                    if (current.Count != cartItemIds.Count)
                        throw new ConflictException("تم إرسال هذا الطلب مسبقاً — راجع صفحة طلباتك");
                    // تغيّرت كمية بعد قراءة السلة (من تبويب آخر): لا نرسل طلباً بكمية لم يرها الزبون
                    if (current.Any(c => c.Quantity != cart.Items.First(i => i.Id == c.Id).Quantity))
                        throw new ConflictException("تغيّرت سلتك أثناء إرسال الطلب — راجعها ثم أعد المحاولة");
                }

                // خصم المخزون عند إنشاء الطلب (ذرياً) — يمنع بيع نفس القطعة لزبونين في نفس الوقت
                // الاسم في رسالة نفاد الكمية للزبون: العربي مع خيار المتغير (المقاس/اللون) لا الرمز الداخلي
                stockChanges = await _inventoryService.ReserveAsync(cart.Items.Select(i => new StockLine(
                    i.ProductId, i.VariantId, i.Quantity, CustomerItemName(i))));

                decimal discountAmount = 0;
                Coupon? appliedCoupon = null;

                if (!string.IsNullOrWhiteSpace(dto.CouponCode))
                {
                    var vendorSubtotals = vendorGroups.ToDictionary(g => g.Key, g => g.Sum(i => unitPrices[i.Id] * i.Quantity));
                    var couponValidation = await _couponService.ValidateAsync(userId,
                        new ValidateCouponDto { Code = dto.CouponCode, OrderAmount = totalSubtotal }, vendorSubtotals);
                    if (!couponValidation.IsValid) throw new BusinessRuleException($"الكوبون غير صالح: {couponValidation.ErrorMessage}");
                    discountAmount = couponValidation.DiscountAmount;
                    appliedCoupon = await _couponRepository.GetByCodeAsync(dto.CouponCode);
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
                    CouponVendorId = discountAmount > 0 ? appliedCoupon?.VendorId : null,
                    CouponDiscountType = discountAmount > 0 ? appliedCoupon?.DiscountType : null,
                    CouponDiscountValue = discountAmount > 0 ? appliedCoupon?.DiscountValue : null,
                    CouponMaxDiscount = discountAmount > 0 ? appliedCoupon?.MaxDiscountAmount : null,
                    CouponOriginalAmount = discountAmount,
                    OriginalTotalAmount = totalSubtotal + totalDelivery - discountAmount,
                    PaymentMethod = PaymentMethods.COD,
                    PaymentStatus = PaymentStatus.Pending,
                    CustomerNotes = dto.CustomerNotes ?? "",
                    DeliveryLatitude = address.Latitude,
                    DeliveryLongitude = address.Longitude,
                    DeliveryZoneId = zoneUsed ? feeRules.Zone!.Id : null,
                    DeliveryZoneName = zoneUsed ? feeRules.Zone!.Name : null,
                    DeliverySlotStart = slot?.Start,
                    DeliverySlotEnd = slot?.End,
                    SubstitutionPreference = substitution
                };

                order = await _orderRepository.CreateAsync(order);

                if (appliedCoupon != null && discountAmount > 0)
                {
                    // التحقق أعلاه قد يمرّ لطلبين متزامنين؛ الحجز الذري هنا يقفل صف الكوبون حتى نهاية المعاملة،
                    // ثم يُعاد عدّ استخدامات الزبون تحت القفل فلا يُتجاوز الحد الكلي ولا حد المستخدم
                    if (!await _couponRepository.TryIncrementUsageCountAsync(appliedCoupon.Id))
                        throw new ConflictException("تم استنفاد استخدامات هذا الكوبون");
                    if (await _couponRepository.GetUserUsageCountAsync(appliedCoupon.Id, userId) >= appliedCoupon.UserUsageLimit)
                        throw new ConflictException("لقد استخدمت هذا الكوبون العدد المسموح به");

                    await _couponRepository.RecordUsageAsync(new CouponUsage { CouponId = appliedCoupon.Id, UserId = userId, OrderId = order.Id, DiscountAmount = discountAmount });
                }

                await LogOrderStatusChangeAsync(order.Id, "", order.Status, userId, slot == null
                    ? "إنشاء طلب جديد"
                    : $"إنشاء طلب جديد — موعد التوصيل: {DeliverySlotService.DeliverySlotService.Describe(slot.Start, slot.End)}");

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
                        // متجر مغلق الآن (طلب سوبرماركت بموعد لاحق): مهلة القبول تبدأ من فتحه، لا من الآن —
                        // وإلا ظهر الطلب «متأخراً» للعمليات طوال الليل
                        ConfirmationDeadline = (StoreHours.NextOpeningUtc(vendor, checkoutTime) ?? checkoutTime).AddMinutes(confirmationMinutes)
                    };

                    subOrder = await _subOrderRepository.CreateAsync(subOrder);
                    createdSubOrders.Add(subOrder);
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
                            Subtotal = unitPrice * cartItem.Quantity,
                            WeightStepKg = cartItem.Product.WeightStepKg
                        });
                    }

                    vendorIndex++;
                }

                // نصيب كل متجر من الكوبون يُحفظ على طلبه الفرعي
                if (discountAmount > 0)
                {
                    OrderTotals.Recalculate(order, createdSubOrders);
                    await _context.SaveChangesAsync();
                }

                // تُحذف القطع التي دخلت الطلب فقط: ما أُضيف للسلة أثناء الإرسال يبقى فيها ولا يضيع
                await _cartRepository.RemoveItemsAsync(cart.Id, cartItemIds);

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            // الإشعارات بعد الحفظ فقط: لا تصل العمليات والمتاجر إشعارات عن طلب تراجعت معاملته،
            // وفشل الإشعار لا يُفشل طلباً حُفظ فعلاً
            try
            {
                await _notificationService.NotifyNewOrderAsync(order.Id, order.OrderNumber);
                foreach (var subOrder in createdSubOrders)
                    await _notificationService.NotifyNewSubOrderAsync(subOrder.Id, subOrder.SubOrderNumber, subOrder.VendorId);
                await _notificationService.NotifyCustomerAsync(userId, $"تم إنشاء طلبك {order.OrderNumber} بنجاح", new { orderId = order.Id, orderNumber = order.OrderNumber });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderNumber} saved but its notifications failed", order.OrderNumber);
            }

            await _inventoryService.NotifyLowStockAsync(stockChanges);

            return MapToDto(await _orderRepository.GetByIdAsync(order.Id));
        }

        public async Task<OrderResponseDto> GetOrderByIdAsync(Guid orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null) throw new NotFoundException("الطلب غير موجود");
            return MapToDto(order);
        }

        public async Task<OrderResponseDto> GetOrderByNumberAsync(string orderNumber)
        {
            var order = await _orderRepository.GetByOrderNumberAsync(orderNumber);
            if (order == null) throw new NotFoundException("الطلب غير موجود");
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

            if (order == null) throw new NotFoundException("الطلب غير موجود");
            if (!isAdmin && order.CustomerId != customerId) throw new NotFoundException("الطلب غير موجود");

            var allStatuses = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED };
            var statusArMap = new Dictionary<string, (string ar, string desc)>
            {
                { OrderStatus.PENDING_CONFIRMATION, ("بانتظار التأكيد", "تم استلام طلبك وهو بانتظار التأكيد") },
                { OrderStatus.CONFIRMED,            ("تم التأكيد",      "تم تأكيد طلبك وسيبدأ التحضير قريباً") },
                { OrderStatus.PREPARING,            ("قيد التحضير",    "يتم تحضير طلبك الآن") },
                { OrderStatus.READY,                ("جاهز للاستلام",  "طلبك جاهز وبانتظار السائق") },
                { OrderStatus.OUT_FOR_DELIVERY,     ("في الطريق إليك", "طلبك في الطريق إليك") },
                { OrderStatus.DELIVERED,            ("تم التسليم",      "تم تسليم طلبك بنجاح") },
                { OrderStatus.CANCELLED,            ("ملغي",            "تم إلغاء الطلب") },
            };

            // الخطوات الأساسية، ثم ما حدث خارج المسار: محاولة توصيل فاشلة (بسببها) وإلغاء (بسببه)
            List<TrackingTimelineDto> Build(List<OrderStatusLog> logs, string current, string? cancelReason)
            {
                static string Main(string s) => s == OrderStatus.PARTIALLY_CONFIRMED ? OrderStatus.CONFIRMED : s;
                current = Main(current);
                // آخر خطوة وصلها الطلب فعلاً (لا أبعد خطوة): سُحب من السائق قبل الاستلام فعاد «جاهز» — «في الطريق» لم يحدث.
                // وكل ما قبلها منجز (طلب متعدد المتاجر قد ينتقل من «مؤكد جزئياً» إلى «قيد التحضير» مباشرة)
                var lastMain = logs.Where(l => allStatuses.Contains(Main(l.NewStatus))).OrderBy(l => l.CreatedAt).LastOrDefault();
                var reached = lastMain == null ? -1 : Array.IndexOf(allStatuses, Main(lastMain.NewStatus));
                var steps = allStatuses.Select((status, i) =>
                {
                    var log = logs.Where(l => Main(l.NewStatus) == status).OrderBy(l => l.CreatedAt).FirstOrDefault();
                    var (ar, desc) = statusArMap.GetValueOrDefault(status, (status, ""));
                    return new TrackingTimelineDto { Status = status, StatusAr = ar, Description = desc, OccurredAt = i <= reached ? log?.CreatedAt : null, IsCompleted = i <= reached, IsCurrent = current == status };
                }).ToList();
                // طلب أُلغي أو تعذّر تسليمه (لا إعادة محاولة): لا تُعرض خطوات لن تحدث (مثل «تم التسليم»)
                if (current is OrderStatus.CANCELLED or OrderStatus.DELIVERY_FAILED) steps.RemoveAll(t => !t.IsCompleted);

                var failedAt = steps.FindIndex(t => t.Status == OrderStatus.OUT_FOR_DELIVERY) + 1;
                if (failedAt == 0) failedAt = steps.Count;
                // محاولة التوصيل الفاشلة من سجل الجزء نفسه (سجل الطلب الرئيسي تحديث تلقائي بنص داخلي)
                foreach (var f in logs.Where(l => l.NewStatus == OrderStatus.DELIVERY_FAILED && l.SubOrderId != null).OrderByDescending(l => l.CreatedAt))
                    steps.Insert(failedAt, new TrackingTimelineDto
                    {
                        Status = OrderStatus.DELIVERY_FAILED, StatusAr = "تعذّر التسليم",
                        Description = string.IsNullOrWhiteSpace(f.Reason) ? "لم يتمكن السائق من تسليم الطلب" : $"لم يتمكن السائق من التسليم: {f.Reason}",
                        OccurredAt = f.CreatedAt, IsCompleted = true, IsCurrent = current == OrderStatus.DELIVERY_FAILED,
                    });

                if (current == OrderStatus.CANCELLED)
                {
                    var c = logs.Where(l => l.NewStatus == OrderStatus.CANCELLED).OrderBy(l => l.CreatedAt).FirstOrDefault();
                    var reason = cancelReason ?? c?.Reason;
                    steps.Add(new TrackingTimelineDto
                    {
                        Status = OrderStatus.CANCELLED, StatusAr = "ملغي",
                        Description = string.IsNullOrWhiteSpace(reason) ? "تم إلغاء الطلب" : $"تم إلغاء الطلب: {reason}",
                        OccurredAt = c?.CreatedAt, IsCompleted = true, IsCurrent = true,
                    });
                }
                return steps;
            }

            // محاولة التوصيل الفاشلة مسجّلة على أجزاء الطلب — تظهر في مسار الطلب كله أيضاً
            var orderLogs = order.StatusLogs.Where(l => l.OrderId == orderId)
                .Concat(order.SubOrders.SelectMany(so => so.StatusLogs ?? new List<OrderStatusLog>()).Where(l => l.NewStatus == OrderStatus.DELIVERY_FAILED))
                .ToList();
            var timeline = Build(orderLogs, order.Status, order.CancellationReason);

            var subOrdersTracking = order.SubOrders.Select(so =>
            {
                var subTimeline = Build((so.StatusLogs ?? new List<OrderStatusLog>()).Where(l => l.SubOrderId == so.Id).ToList(), so.Status, so.CancellationReason);

                DriverTrackingDto? driverDto = so.Driver == null ? null : new DriverTrackingDto { DriverId = so.Driver.Id, DriverName = so.Driver.FullName, DriverPhone = so.Driver.Phone, VehicleType = so.Driver.VehicleType };
                return new SubOrderTrackingDto { SubOrderId = so.Id, SubOrderNumber = so.SubOrderNumber, VendorName = so.Vendor?.Name ?? "", Status = so.Status, Driver = driverDto, Timeline = subTimeline };
            }).ToList();

            return new OrderTrackingDto { OrderId = order.Id, OrderNumber = order.OrderNumber, CurrentStatus = order.Status,
                // الموعد الوحيد الذي نعرفه فعلاً: نهاية فترة توصيل السوبرماركت المختارة (الطلب الفوري بلا تقدير)
                EstimatedDelivery = order.Status is OrderStatus.DELIVERED or OrderStatus.CANCELLED ? null : order.DeliverySlotEnd, Timeline = timeline, SubOrders = subOrdersTracking };
        }

        public async Task<OrderResponseDto> CancelOrderAsync(Guid orderId, Guid customerId, CancelOrderDto dto)
        {
            // إلغاء الزبون مع قبول/رفض المتجر في نفس اللحظة: واحد فقط ينجح
            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId);
            // ضغطة إلغاء ثانية (أو من تبويب آخر): الطلب ملغى أصلاً — نفس النتيجة بلا خطأ
            var currentStatus = await _context.Orders.AsNoTracking().Where(o => o.Id == orderId && o.CustomerId == customerId)
                .Select(o => o.Status).FirstOrDefaultAsync();
            if (currentStatus == OrderStatus.CANCELLED) return await GetOrderByIdAsync(orderId);
            List<SubOrder> cancelled;
            Guid orderCustomerId;
            string oldOrderStatus, orderNumber;
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var order = await _context.Orders.Include(o => o.SubOrders).FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null) throw new NotFoundException("الطلب غير موجود");
                if (order.CustomerId != customerId) throw new NotFoundException("الطلب غير موجود");

                var cancellable = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.PARTIALLY_CONFIRMED, OrderStatus.CONFIRMED };
                // متجر بدأ التحضير (وآخر لم يؤكد بعد فالطلب «مؤكد جزئياً»): الإلغاء متاح قبل بدء التحضير فقط
                var started = order.SubOrders.Any(so => so.Status != OrderStatus.CANCELLED
                    && so.Status != OrderStatus.PENDING_CONFIRMATION && so.Status != OrderStatus.CONFIRMED);
                if (!cancellable.Contains(order.Status) || started)
                    throw new BusinessRuleException($"لا يمكن إلغاء الطلب وهو «{OrderStatusText.Ar(started ? OrderStatus.PREPARING : order.Status)}»، الإلغاء متاح فقط قبل بدء التحضير");

                var oldStatus = order.Status;
                order.Status = OrderStatus.CANCELLED;
                order.CancellationReason = dto.Reason;
                order.UpdatedAt = DateTime.UtcNow;

                cancelled = order.SubOrders.Where(so => so.Status != OrderStatus.CANCELLED).ToList();
                var cancelledSubOrderIds = cancelled.Select(so => so.Id).ToList();

                foreach (var subOrder in cancelled)
                {
                    _context.OrderStatusLogs.Add(new OrderStatusLog { SubOrderId = subOrder.Id, OldStatus = subOrder.Status, NewStatus = OrderStatus.CANCELLED, ChangedBy = customerId, Reason = dto.Reason, Notes = "إلغاء من قِبل العميل" });
                    subOrder.Status = OrderStatus.CANCELLED;
                    subOrder.CancellationReason = dto.Reason;
                    subOrder.CancelledBy = customerId;
                    subOrder.CancelledAt = DateTime.UtcNow;
                    subOrder.UpdatedAt = DateTime.UtcNow;
                }

                await _context.OrderStatusLogs.AddAsync(new OrderStatusLog { OrderId = order.Id, OldStatus = oldStatus, NewStatus = OrderStatus.CANCELLED, ChangedBy = customerId, Reason = dto.Reason, Notes = "إلغاء من قِبل العميل" });
                OrderTotals.SyncCancelled(order, order.SubOrders);
                await _context.SaveChangesAsync();

                // إعادة مخزون الطلبات الفرعية التي أُلغيت الآن (داخل نفس المعاملة)
                await _inventoryService.RestoreForSubOrdersAsync(cancelledSubOrderIds);

                await _loyaltyService.CancelRedemptionAsync(orderId);
                await transaction.CommitAsync();
                oldOrderStatus = oldStatus;
                orderNumber = order.OrderNumber;
                orderCustomerId = order.CustomerId;
            }
            catch { await transaction.RollbackAsync(); throw; }

            // بعد الحفظ فقط: المتجر (حتى لو قبل الطلب وبدأ يجهّزه) والعمليات يعرفون بالإلغاء. فشل الإشعار لا يُفشل الإلغاء
            try
            {
                foreach (var so in cancelled)
                    await _notificationService.NotifySubOrderCancelledAsync(so.Id, so.SubOrderNumber, $"ألغى الزبون الطلب: {dto.Reason}", so.VendorId);
                await _notificationService.NotifyOrderStatusChangedAsync(orderId, oldOrderStatus, OrderStatus.CANCELLED, orderNumber);
                // تأكيد للزبون في قائمة إشعاراته (السبب، وعودة النقاط إن استخدمها)
                await _notificationService.NotifyCustomerOrderStatusAsync(orderCustomerId, orderId, orderNumber, OrderStatus.CANCELLED);
                // محفوظ في قائمة العمليات (البث اللحظي أعلاه يضيع إن لم تكن الصفحة مفتوحة)
                await _notificationService.NotifyOpsAsync(NotificationCategory.NewOrders, NotificationType.ORDER_STATUS,
                    $"ألغى الزبون الطلب {orderNumber}: {dto.Reason}", new { orderId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Order {OrderNumber} cancelled by customer but notifications failed", orderNumber);
            }

            return await GetOrderByIdAsync(orderId);
        }

        private async Task LogOrderStatusChangeAsync(Guid orderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null, string notes = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { OrderId = orderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason, Notes = notes });
        }

        private async Task LogSubOrderStatusChangeAsync(Guid subOrderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null, string notes = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { SubOrderId = subOrderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason, Notes = notes });
        }

        private static string CustomerItemName(CartItem i)
        {
            var name = i.Product.NameAr ?? i.Product.Name;
            var options = i.Variant?.AttributeValues?
                .Select(av => av.AttributeValue?.ValueAr ?? av.AttributeValue?.Value)
                .Where(v => !string.IsNullOrWhiteSpace(v)).ToList();
            return options is { Count: > 0 } ? $"{name} ({string.Join(" · ", options)})" : name;
        }

        private OrderResponseDto MapToDto(Order order)
        {
            var shares = order.SubOrders == null ? new() : OrderTotals.DiscountShares(order, order.SubOrders);
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
                DiscountShare = shares.GetValueOrDefault(so.Id),
                ConfirmedBy = so.ConfirmedBy,
                ConfirmedByName = so.ConfirmedByUser?.FullName,
                ConfirmedAt = so.ConfirmedAt,
                ConfirmationDeadline = so.ConfirmationDeadline,
                // العدّاد لما ينتظر تأكيد المتجر فقط — بعد التأكيد أو الإلغاء لا عدّ تنازلي
                MinutesRemaining = so.ConfirmationDeadline.HasValue && so.Status == SubOrderStatus.PendingConfirmation
                    ? (int)Math.Max(0, (so.ConfirmationDeadline.Value - DateTime.UtcNow).TotalMinutes) : null,
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
                    WeightStepKg = i.WeightStepKg,
                    ReplacesItemId = i.ReplacesItemId,
                    UnavailableQuantity = i.UnavailableQuantity,
                    RefusedQuantity = i.RefusedQuantity,
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
                DeliveryZoneName = order.DeliveryZoneName,
                DiscountAmount = order.DiscountAmount,
                CouponDiscountAmount = OrderTotals.CouponDiscount(order),
                PointsDiscountAmount = order.PointsDiscountAmount,
                TotalAmount = order.TotalAmount,
                RefusedAmount = order.SubOrders?.SelectMany(so => so.Items ?? new List<SubOrderItem>()).Sum(i => i.UnitPrice * i.RefusedQuantity) ?? 0,
                OriginalTotalAmount = order.OriginalTotalAmount,
                RefusalFeeAmount = order.RefusalFeeAmount,
                RefusalFeePayer = order.RefusalFeePayer,
                CashCollectedAmount = order.CashCollectedAmount,
                CouponCode = order.CouponCode,
                DeliverySlotStart = order.DeliverySlotStart,
                DeliverySlotEnd = order.DeliverySlotEnd,
                SubstitutionPreference = order.SubstitutionPreference,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                CustomerNotes = order.CustomerNotes,
                CancellationReason = order.CancellationReason,
                SubOrders = subOrdersDto,
                TotalSubOrders = subOrdersDto?.Count ?? 0,
                // كل متجر قَبِل طلبه (مؤكد فما بعده) — لا «مؤكد» حرفياً فقط
                ConfirmedSubOrders = subOrdersDto?.Count(so => so.Status != SubOrderStatus.PendingConfirmation && so.Status != SubOrderStatus.Cancelled) ?? 0,
                CancelledSubOrders = subOrdersDto?.Count(so => so.Status == SubOrderStatus.Cancelled) ?? 0,
                PendingSubOrders = subOrdersDto?.Count(so => so.Status == SubOrderStatus.PendingConfirmation) ?? 0,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt
            };
        }
    }
}