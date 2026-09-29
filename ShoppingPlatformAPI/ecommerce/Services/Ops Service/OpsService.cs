using ecommerce.Core;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Cart;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using System.Text.Json;

namespace ecommerce.Services
{
    public class OpsService : IOpsService
    {
        private readonly ISubOrderRepository _subOrderRepository;
        private readonly IOrderRepository _orderRepository;
        private readonly IUserRepository _userRepository;
        private readonly IOrderStatusLogRepository _orderStatusLogRepository;
        private readonly INotificationService _notificationService;
        private readonly IDriverRepository _driverRepository;
        private readonly INotificationRepository _notificationRepository;
        private readonly ILoyaltyService _loyaltyService;
        private readonly IInventoryService _inventoryService;

        public OpsService(
            ISubOrderRepository subOrderRepository,
            IOrderRepository orderRepository,
            IUserRepository userRepository,
            IOrderStatusLogRepository orderStatusLogRepository,
            INotificationService notificationService,
            IDriverRepository driverRepository,
            INotificationRepository notificationRepository,
            ILoyaltyService loyaltyService,
            IInventoryService inventoryService)
        {
            _subOrderRepository = subOrderRepository;
            _orderRepository = orderRepository;
            _userRepository = userRepository;
            _orderStatusLogRepository = orderStatusLogRepository;
            _notificationService = notificationService;
            _driverRepository = driverRepository;
            _notificationRepository = notificationRepository;
            _loyaltyService = loyaltyService;
            _inventoryService = inventoryService;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Helper: Map SubOrderItem → DTO (مع Variant)
        // ─────────────────────────────────────────────────────────────────────
        private static PendingSubOrderItemDto MapItemToDto(SubOrderItem i) => new()
        {
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
        };

        // ─────────────────────────────────────────────────────────────────────
        // Helper: Map SubOrder → PendingSubOrderDto
        // ─────────────────────────────────────────────────────────────────────
        private static PendingSubOrderDto MapToPendingDto(SubOrder so)
        {
            var timeRemaining = so.ConfirmationDeadline.HasValue
                ? so.ConfirmationDeadline.Value - DateTime.UtcNow
                : TimeSpan.Zero;

            return new PendingSubOrderDto
            {
                Id = so.Id,
                SubOrderNumber = so.SubOrderNumber,
                Status = so.Status,
                OrderId = so.OrderId,
                OrderNumber = so.Order?.OrderNumber,
                CustomerId = so.Order?.CustomerId ?? Guid.Empty,
                CustomerName = so.Order?.Customer?.FullName,
                CustomerPhone = so.Order?.Customer?.Phone,
                DeliveryAddress = so.Order?.Address != null
                    ? $"{so.Order.Address.StreetAddress}, {so.Order.Address.Area}, {so.Order.Address.City}"
                    : "",
                DeliveryPhone = so.Order?.Address?.Phone,
                DeliveryNotes = so.Order?.CustomerNotes,
                VendorId = so.VendorId,
                VendorName = so.Vendor?.Name,
                VendorNameAr = so.Vendor?.NameAr,
                VendorPhone = so.Vendor?.Phone,
                Subtotal = so.Subtotal,
                DeliveryFee = so.DeliveryFee,
                CreatedAt = so.CreatedAt,
                ConfirmationDeadline = so.ConfirmationDeadline,
                MinutesRemaining = (int)Math.Max(0, timeRemaining.TotalMinutes),
                SecondsRemaining = (int)Math.Max(0, timeRemaining.TotalSeconds),
                Items = so.Items?.Select(MapItemToDto).ToList() ?? new()
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET PENDING
        // ─────────────────────────────────────────────────────────────────────
        public async Task<IEnumerable<PendingSubOrderDto>> GetPendingSubOrdersAsync()
        {
            var subOrders = await _subOrderRepository.GetPendingSubOrdersAsync();
            return subOrders.Select(MapToPendingDto).OrderBy(so => so.MinutesRemaining);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET DETAILS
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> GetSubOrderDetailsAsync(Guid subOrderId)
        {
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new Exception("الطلب الفرعي غير موجود");
            return MapToDto(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CONFIRM
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> ConfirmSubOrderAsync(Guid subOrderId, ConfirmSubOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new Exception("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new Exception("المستخدم ليس لديه صلاحية Ops");

            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new Exception("الطلب الفرعي غير موجود");
            if (subOrder.Status != SubOrderStatus.PendingConfirmation) throw new Exception($"لا يمكن تأكيد الطلب. الحالة الحالية: {subOrder.Status}");

            var oldStatus = subOrder.Status;
            subOrder.Status = SubOrderStatus.Confirmed;
            subOrder.ConfirmedBy = dto.OpsUserId;
            subOrder.ConfirmedAt = DateTime.UtcNow;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, SubOrderStatus.Confirmed, dto.OpsUserId, "تأكيد الطلب الفرعي", dto.Notes);
            await _notificationService.NotifySubOrderConfirmedAsync(subOrder.Id, subOrder.SubOrderNumber, subOrder.VendorId);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.SUB_ORDER, $"تم تأكيد الطلب الفرعي: {subOrder.SubOrderNumber}", new { subOrderId = subOrder.Id, subOrderNumber = subOrder.SubOrderNumber });
            await _notificationService.NotifyCustomerAsync(subOrder.Order.CustomerId, $"تم تأكيد جزء من طلبك ({subOrder.Vendor.Name})", new { subOrderId = subOrder.Id });
            await UpdateMainOrderStatusAsync(subOrder.OrderId);

            return MapToDto(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CANCEL
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> CancelSubOrderAsync(Guid subOrderId, CancelSubOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new Exception("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new Exception("المستخدم ليس لديه صلاحية Ops");

            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new Exception("الطلب الفرعي غير موجود");
            if (subOrder.Status != SubOrderStatus.PendingConfirmation) throw new Exception($"لا يمكن إلغاء الطلب. الحالة الحالية: {subOrder.Status}");

            var oldStatus = subOrder.Status;
            subOrder.Status = SubOrderStatus.Cancelled;
            subOrder.CancellationReason = dto.CancellationReason;
            subOrder.CancelledBy = dto.OpsUserId;
            subOrder.CancelledAt = DateTime.UtcNow;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            // إعادة مخزون بنود الطلب الملغى
            await _inventoryService.RestoreForSubOrdersAsync(new[] { subOrder.Id });

            await UpdateDriverWorkStatusAsync(subOrder, OrderStatus.CANCELLED);
            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, SubOrderStatus.Cancelled, dto.OpsUserId, dto.CancellationReason);
            await _notificationService.NotifySubOrderCancelledAsync(subOrder.Id, subOrder.SubOrderNumber, dto.CancellationReason, subOrder.VendorId);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.SUB_ORDER, $"تم إلغاء الطلب الفرعي: {subOrder.SubOrderNumber} — {dto.CancellationReason}", new { subOrderId = subOrder.Id, reason = dto.CancellationReason });
            await _notificationService.NotifyCustomerAsync(subOrder.Order.CustomerId, $"تم إلغاء جزء من طلبك ({subOrder.Vendor.Name}): {dto.CancellationReason}", new { subOrderId = subOrder.Id });
            await UpdateMainOrderStatusAsync(subOrder.OrderId);

            return MapToDto(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // UPDATE STATUS
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> UpdateSubOrderStatusAsync(Guid subOrderId, UpdateSubOrderStatusDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new Exception("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new Exception("المستخدم ليس لديه صلاحية Ops");

            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new Exception("الطلب الفرعي غير موجود");

            var allowedTransitions = new Dictionary<string, string[]>
            {
                { OrderStatus.CONFIRMED,  new[] { OrderStatus.PREPARING } },
                { OrderStatus.PREPARING,  new[] { SubOrderStatus.Ready } },   // ✅ جديد
                { OrderStatus.OUT_FOR_DELIVERY, new[] { OrderStatus.DELIVERED } },
            };

            if (!allowedTransitions.ContainsKey(subOrder.Status) || !allowedTransitions[subOrder.Status].Contains(dto.NewStatus))
                throw new Exception($"لا يمكن الانتقال من {subOrder.Status} إلى {dto.NewStatus}");

            var oldStatus = subOrder.Status;
            subOrder.Status = dto.NewStatus;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            await UpdateDriverWorkStatusAsync(subOrder, dto.NewStatus);
            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, dto.NewStatus, dto.OpsUserId, dto.Notes);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS, $"تم تحديث حالة الطلب {subOrder.SubOrderNumber} من {oldStatus} إلى {dto.NewStatus}", new { subOrderId = subOrder.Id, oldStatus, newStatus = dto.NewStatus });

            // ✅ كسب النقاط عند التسليم
            if (dto.NewStatus == OrderStatus.DELIVERED && subOrder.Order != null)
            {
                var amount = subOrder.Items?.Sum(i => i.UnitPrice * i.Quantity) ?? subOrder.Subtotal;
                await _loyaltyService.EarnPointsAsync(subOrder.Order.CustomerId, subOrder.OrderId, amount);
            }

            await UpdateMainOrderStatusAsync(subOrder.OrderId);
            return MapToDto(subOrder);
        }
        public async Task<IEnumerable<SubOrderDto>> AssignDriverToOrderAsync(Guid orderId, AssignDriverToOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new Exception("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin)
                throw new Exception("المستخدم ليس لديه صلاحية Ops");

            var allSubOrders = (await _subOrderRepository.GetByOrderIdAsync(orderId)).ToList();
            var activeSubOrders = allSubOrders.Where(so => so.Status != OrderStatus.CANCELLED).ToList();

            if (!activeSubOrders.Any())
                throw new Exception("لا توجد طلبات فرعية فعالة بهذا الطلب");

            // ✅ الشرط الأساسي: الكل لازم يكون PREPARING (نفس شرط AssignDriverAsync أدناه)
            var notReady = activeSubOrders.Where(so => so.Status != OrderStatus.PREPARING).ToList();
            if (notReady.Any())
                throw new Exception(
                    $"لا يمكن تعيين سائق. طلبات لسه ما جاهزة: {string.Join(", ", notReady.Select(so => so.SubOrderNumber))}");

            var driver = await _driverRepository.GetByIdAsync(dto.DriverId);
            if (driver == null) throw new Exception("السائق غير موجود");
            if (driver.Status != DriverStatus.Active) throw new Exception("السائق غير نشط");
            if (driver.WorkStatus != DriverWorkStatus.Available) throw new Exception("السائق غير متاح حالياً");

            // ✅ تعيين موحّد على كل الـ SubOrders دفعة وحدة
            foreach (var subOrder in activeSubOrders)
            {
                var oldStatus = subOrder.Status;
                subOrder.DriverId = dto.DriverId;
                subOrder.AssignedAt = DateTime.UtcNow;
                subOrder.Status = OrderStatus.OUT_FOR_DELIVERY;
                await _subOrderRepository.UpdateAsync(subOrder);

                await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, OrderStatus.OUT_FOR_DELIVERY,
                    dto.OpsUserId, $"تعيين سائق موحّد لكامل الطلب: {driver.FullName}");
            }

            // ✅ السائق يصير مشغول مرة وحدة بس
            driver.WorkStatus = DriverWorkStatus.Delivering;
            await _driverRepository.UpdateAsync(driver);

            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS,
                $"تم تعيين السائق {driver.FullName} لكامل الطلب", new { orderId, driverName = driver.FullName });

            await UpdateMainOrderStatusAsync(orderId);

            return activeSubOrders.Select(MapToDto);
        }
        // ─────────────────────────────────────────────────────────────────────
        // ASSIGN DRIVER
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> AssignDriverAsync(Guid subOrderId, AssignDriverDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new Exception("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new Exception("المستخدم ليس لديه صلاحية Ops");

            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new Exception("الطلب الفرعي غير موجود");
            if (subOrder.Status != OrderStatus.PREPARING) throw new Exception($"لا يمكن تعيين سائق. يجب أن تكون الحالة PREPARING، الحالة الحالية: {subOrder.Status}");

            var driver = await _driverRepository.GetByIdAsync(dto.DriverId);
            if (driver == null) throw new Exception("السائق غير موجود");
            if (driver.Status != DriverStatus.Active) throw new Exception("السائق غير نشط");
            if (driver.WorkStatus != DriverWorkStatus.Available) throw new Exception("السائق غير متاح حالياً");

            var oldStatus = subOrder.Status;
            subOrder.DriverId = dto.DriverId;
            subOrder.AssignedAt = DateTime.UtcNow;
            subOrder.Status = OrderStatus.OUT_FOR_DELIVERY;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            driver.WorkStatus = DriverWorkStatus.Delivering;
            await _driverRepository.UpdateAsync(driver);

            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, OrderStatus.OUT_FOR_DELIVERY, dto.OpsUserId, $"تم تعيين السائق: {driver.FullName} وتحويل الحالة تلقائياً");
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS, $"تم تعيين السائق {driver.FullName} للطلب {subOrder.SubOrderNumber}", new { subOrderId = subOrder.Id, driverName = driver.FullName });
            await UpdateMainOrderStatusAsync(subOrder.OrderId);

            return MapToDto(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET PAGED
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrdersPagedResultDto> GetSubOrdersPagedAsync(int pageNumber, int pageSize, string? status)
        {
            var (items, totalCount) = await _subOrderRepository.GetPagedAsync(pageNumber, pageSize, status);

            return new SubOrdersPagedResultDto
            {
                Items = items.Select(MapToPendingDto).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET DASHBOARD STATS
        // ─────────────────────────────────────────────────────────────────────
        public async Task<OpsDashboardStatsDto> GetDashboardStatsAsync()
        {
            return await _subOrderRepository.GetDashboardStatsAsync();
        }

        // ─────────────────────────────────────────────────────────────────────
        // PRIVATE: MapToDto (SubOrderDto — للتفاصيل)
        // ─────────────────────────────────────────────────────────────────────
        private SubOrderDto MapToDto(SubOrder so)
        {
            var timeRemaining = so.ConfirmationDeadline.HasValue
                ? so.ConfirmationDeadline.Value - DateTime.UtcNow
                : TimeSpan.Zero;

            return new SubOrderDto
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
                MinutesRemaining = (int)Math.Max(0, timeRemaining.TotalMinutes),
                CancellationReason = so.CancellationReason,
                CancelledBy = so.CancelledBy,
                CancelledByName = so.CancelledByUser?.FullName,
                CancelledAt = so.CancelledAt,
                DriverId = so.DriverId,
                DriverName = so.Driver?.FullName,
                DriverPhone = so.Driver?.Phone,
                AssignedAt = so.AssignedAt,
                // ✅ Items مع Variant
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
                UpdatedAt = so.UpdatedAt,
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // PRIVATE: Helpers
        // ─────────────────────────────────────────────────────────────────────
        private async Task UpdateMainOrderStatusAsync(Guid orderId)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null) return;

            var oldStatus = order.Status;
            var subOrders = await _subOrderRepository.GetByOrderIdAsync(orderId);

            var total = subOrders.Count();
            var cancelled = subOrders.Count(so => so.Status == OrderStatus.CANCELLED);
            var delivered = subOrders.Count(so => so.Status == OrderStatus.DELIVERED);
            var outForDel = subOrders.Count(so => so.Status == OrderStatus.OUT_FOR_DELIVERY);
            var preparing = subOrders.Count(so => so.Status == OrderStatus.PREPARING);
            var confirmed = subOrders.Count(so => so.Status == OrderStatus.CONFIRMED);
            var active = total - cancelled;

            string newStatus;
            if (cancelled == total) newStatus = OrderStatus.CANCELLED;
            else if (delivered == active) newStatus = OrderStatus.DELIVERED;
            else if (outForDel > 0) newStatus = OrderStatus.OUT_FOR_DELIVERY;
            else if (preparing > 0) newStatus = OrderStatus.PREPARING;
            else if (confirmed == active) newStatus = OrderStatus.CONFIRMED;
            else if (confirmed > 0) newStatus = OrderStatus.PARTIALLY_CONFIRMED;
            else newStatus = OrderStatus.PENDING_CONFIRMATION;

            if (order.Status == newStatus) return;

            order.Status = newStatus;
            await _orderRepository.UpdateAsync(order);
            await LogOrderStatusChangeAsync(order.Id, oldStatus, newStatus, null, $"تحديث تلقائي: {confirmed} مؤكد، {preparing} تحضير، {outForDel} توصيل، {delivered} مسلم، {cancelled} ملغي");
            await _notificationService.NotifyOrderStatusChangedAsync(order.Id, oldStatus, newStatus);
            await _notificationService.NotifyCustomerOrderStatusAsync(order.CustomerId, order.Id, order.OrderNumber, newStatus);
        }

        private async Task SaveOpsNotificationAsync(Guid opsUserId, string type, string message, object data)
        {
            await _notificationRepository.CreateAsync(new Notification
            {
                UserId = opsUserId,
                Type = type,
                Message = message,
                Data = JsonSerializer.Serialize(data)
            });
        }

        private async Task UpdateDriverWorkStatusAsync(SubOrder subOrder, string newStatus)
        {
            if (!subOrder.DriverId.HasValue) return;
            var driver = await _driverRepository.GetByIdAsync(subOrder.DriverId.Value);
            if (driver == null) return;

            if (newStatus == OrderStatus.DELIVERED || newStatus == OrderStatus.CANCELLED)
            {
                driver.WorkStatus = DriverWorkStatus.Available;
                driver.TotalDeliveries += newStatus == OrderStatus.DELIVERED ? 1 : 0;
                await _driverRepository.UpdateAsync(driver);
            }
            else if (newStatus == OrderStatus.OUT_FOR_DELIVERY)
            {
                driver.WorkStatus = DriverWorkStatus.Delivering;
                await _driverRepository.UpdateAsync(driver);
            }
        }

        private async Task LogSubOrderStatusChangeAsync(Guid subOrderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null, string notes = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { SubOrderId = subOrderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason, Notes = notes });
        }

        private async Task LogOrderStatusChangeAsync(Guid orderId, string oldStatus, string newStatus, Guid? changedBy, string reason = null)
        {
            await _orderStatusLogRepository.CreateAsync(new OrderStatusLog { OrderId = orderId, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = changedBy, Reason = reason });
        }
    }
}