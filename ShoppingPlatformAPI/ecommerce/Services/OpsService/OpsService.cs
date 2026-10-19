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
using ecommerce.Core.Exceptions;

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
        private readonly ecommerce.Services.FinanceService.IFinanceService? _finance;

        public OpsService(
            ISubOrderRepository subOrderRepository,
            IOrderRepository orderRepository,
            IUserRepository userRepository,
            IOrderStatusLogRepository orderStatusLogRepository,
            INotificationService notificationService,
            IDriverRepository driverRepository,
            INotificationRepository notificationRepository,
            ILoyaltyService loyaltyService,
            IInventoryService inventoryService,
            ecommerce.Services.FinanceService.IFinanceService? finance = null)
        {
            _finance = finance;
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
            WeightStepKg = i.WeightStepKg,
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
        private static PendingSubOrderDto MapToPendingDto(SubOrder so, decimal discountShare)
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
                DeliverySlotStart = so.Order?.DeliverySlotStart,
                DeliverySlotEnd = so.Order?.DeliverySlotEnd,
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
                DiscountShare = discountShare,
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
            var subOrders = (await _subOrderRepository.GetPendingSubOrdersAsync()).ToList();
            var shares = await SharesAsync(subOrders);
            return subOrders.Select(so => MapToPendingDto(so, shares.GetValueOrDefault(so.Id))).OrderBy(so => so.MinutesRemaining);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET DETAILS
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> GetSubOrderDetailsAsync(Guid subOrderId)
        {
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");
            return await MapToDtoAsync(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CONFIRM
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> ConfirmSubOrderAsync(Guid subOrderId, ConfirmSubOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new NotFoundException("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new BusinessRuleException("المستخدم ليس لديه صلاحية Ops");

            await using var orderLock = await _subOrderRepository.LockOrderOfSubOrderAsync(subOrderId);
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");
            if (subOrder.Status != SubOrderStatus.PendingConfirmation) throw new BusinessRuleException($"لا يمكن تأكيد الطلب. الحالة الحالية: {OrderStatusText.Ar(subOrder.Status)}");

            var oldStatus = subOrder.Status;
            subOrder.Status = SubOrderStatus.Confirmed;
            subOrder.ConfirmedBy = dto.OpsUserId;
            subOrder.ConfirmedAt = DateTime.UtcNow;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, SubOrderStatus.Confirmed, dto.OpsUserId, "تأكيد الطلب الفرعي", dto.Notes);
            await _notificationService.NotifySubOrderConfirmedAsync(subOrder.Id, subOrder.SubOrderNumber, subOrder.VendorId);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.SUB_ORDER, $"تم تأكيد الطلب الفرعي: {subOrder.SubOrderNumber}", new { subOrderId = subOrder.Id, subOrderNumber = subOrder.SubOrderNumber });
            // طلب من متجر واحد: يصل الزبون إشعار «تم تأكيد طلبك» من تحديث حالة الطلب أدناه — «جزء» فقط لمتعدد المتاجر
            if ((await _subOrderRepository.GetByOrderIdAsync(subOrder.OrderId)).Count(s => s.Status != OrderStatus.CANCELLED) > 1)
                await _notificationService.NotifyCustomerOrderNoticeAsync(subOrder.Order.CustomerId, $"تم تأكيد جزء من طلبك {subOrder.Order.OrderNumber} ({subOrder.Vendor.DisplayName})", new { orderId = subOrder.OrderId, subOrderId = subOrder.Id });
            await UpdateMainOrderStatusAsync(subOrder.OrderId, dto.OpsUserId);

            return await MapToDtoAsync(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // CANCEL
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> CancelSubOrderAsync(Guid subOrderId, CancelSubOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new NotFoundException("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new BusinessRuleException("المستخدم ليس لديه صلاحية Ops");

            await using var orderLock = await _subOrderRepository.LockOrderOfSubOrderAsync(subOrderId);
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");
            // يُلغى في أي مرحلة قبل خروجه مع السائق (مثلاً المتجر اكتشف نقصاً بعد التأكيد)
            var cancellable = new[] { SubOrderStatus.PendingConfirmation, SubOrderStatus.Confirmed, SubOrderStatus.Preparing, SubOrderStatus.Ready, SubOrderStatus.DeliveryFailed };
            if (subOrder.Status == SubOrderStatus.OutForDelivery)
                throw new BusinessRuleException("الطلب مع السائق الآن — يسجّل السائق «تعذّر التسليم» فتعود البضاعة للمتجر ويُغلق الطلب تلقائياً حين يؤكد المتجر استلامها");
            if (!cancellable.Contains(subOrder.Status))
                throw new BusinessRuleException($"لا يمكن إلغاء الطلب. الحالة الحالية: {OrderStatusText.Ar(subOrder.Status)}");
            // البضاعة مع السائق في طريقها للمتجر: الإلغاء الآن يُعيد مخزوناً لم يصل بعد
            if (subOrder.Status == SubOrderStatus.DeliveryFailed && await _subOrderRepository.HasOpenReturnTripAsync(subOrder.Id))
                throw new BusinessRuleException("البضاعة مع السائق في طريقها للمتجر — يُغلق الطلب تلقائياً حين يؤكد المتجر استلامها");

            var oldStatus = subOrder.Status;
            // معيَّن لسائق لم يستلمه بعد: يُلغى مباشرة ويُبلَّغ السائق ألا يذهب للمتجر
            var assignedDriverId = DriverTrip.AwaitingPickup(subOrder) ? subOrder.DriverId : null;
            subOrder.Status = SubOrderStatus.Cancelled;
            subOrder.CancellationReason = dto.CancellationReason;
            subOrder.CancelledBy = dto.OpsUserId;
            subOrder.CancelledAt = DateTime.UtcNow;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            // إعادة مخزون بنود الطلب الملغى
            await _inventoryService.RestoreForSubOrdersAsync(new[] { subOrder.Id });

            await UpdateDriverWorkStatusAsync(subOrder, OrderStatus.CANCELLED);
            if (assignedDriverId is Guid cancelledDriverId) await NotifyDriverRemovedAsync(cancelledDriverId, subOrder, "أُلغي");
            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, SubOrderStatus.Cancelled, dto.OpsUserId, dto.CancellationReason);
            await _notificationService.NotifySubOrderCancelledAsync(subOrder.Id, subOrder.SubOrderNumber, dto.CancellationReason, subOrder.VendorId);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.SUB_ORDER, $"تم إلغاء الطلب الفرعي: {subOrder.SubOrderNumber} — {dto.CancellationReason}", new { subOrderId = subOrder.Id, reason = dto.CancellationReason });

            // المبلغ المطلوب من الزبون = المتاجر الباقية فقط (وإلا يحصّل السائق ثمن ما أُلغي)
            var order = await _orderRepository.GetByIdAsync(subOrder.OrderId);
            if (OrderTotals.Recalculate(order, order.SubOrders)) await _orderRepository.UpdateAsync(order);
            var wholeOrderCancelled = order.SubOrders.All(s => s.Status == OrderStatus.CANCELLED);
            if (wholeOrderCancelled && string.IsNullOrWhiteSpace(order.CancellationReason))
            {
                order.CancellationReason = dto.CancellationReason;
                await _orderRepository.UpdateAsync(order);
            }

            // إلغاء جزئي: الزبون يعرف ما أُلغي والمبلغ الجديد. الإلغاء الكامل يصله من تحديث حالة الطلب أدناه
            if (!wholeOrderCancelled)
                await _notificationService.NotifyCustomerOrderNoticeAsync(order.CustomerId,
                    $"تم إلغاء جزء من طلبك {order.OrderNumber} ({subOrder.Vendor.DisplayName}): {dto.CancellationReason} — المبلغ الجديد {order.TotalAmount:N0} د.ع"
                    + OrderTotals.PointsReturnedNote(OrderTotals.UnusedPoints(order)),
                    new { orderId = order.Id, subOrderId = subOrder.Id });
            await UpdateMainOrderStatusAsync(subOrder.OrderId, dto.OpsUserId);
            if (wholeOrderCancelled) await _loyaltyService.CancelRedemptionAsync(order.Id);   // النقاط المستخدمة ترجع للزبون
            else await _loyaltyService.RefundUnusedPointsAsync(order.Id);   // نصيب الجزء الملغى من النقاط إن لم يبقَ جزء مفتوح يحمله

            return await MapToDtoAsync(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // UPDATE STATUS
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> UpdateSubOrderStatusAsync(Guid subOrderId, UpdateSubOrderStatusDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new NotFoundException("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new BusinessRuleException("المستخدم ليس لديه صلاحية Ops");

            await using var orderLock = await _subOrderRepository.LockOrderOfSubOrderAsync(subOrderId);
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");

            var allowedTransitions = new Dictionary<string, string[]>
            {
                { OrderStatus.CONFIRMED,  new[] { OrderStatus.PREPARING } },
                { OrderStatus.PREPARING,  new[] { OrderStatus.READY } },          // جاهز للاستلام (احتياط إن نسي المتجر)
                { OrderStatus.READY,      new[] { OrderStatus.PREPARING } },      // تراجع: ليس جاهزاً بعد
                // تعذّر التسليم: لا إعادة محاولة — البضاعة تعود مع السائق لمتجرها ويُغلق الجزء عند استلامه
            };

            if (!KnownStatuses.Contains(dto.NewStatus ?? ""))
                throw new BusinessRuleException("حالة غير صالحة");
            if (!allowedTransitions.ContainsKey(subOrder.Status) || !allowedTransitions[subOrder.Status].Contains(dto.NewStatus))
                throw new BusinessRuleException($"لا يمكن الانتقال من «{OrderStatusText.Ar(subOrder.Status)}» إلى «{OrderStatusText.Ar(dto.NewStatus)}»");

            if (DriverTrip.AwaitingPickup(subOrder))
                throw new BusinessRuleException("الطلب معيَّن لسائق — اسحبه من السائق أولاً ثم أعده للتحضير");

            var oldStatus = subOrder.Status;
            subOrder.Status = dto.NewStatus;
            if (oldStatus == OrderStatus.DELIVERY_FAILED)
            {
                // محاولة جديدة: سائق جديد واستلام جديد (السبب يبقى في السجل)
                subOrder.DriverId = null;
                subOrder.AssignedAt = null;
                subOrder.PickedUpAt = null;
            }
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            await UpdateDriverWorkStatusAsync(subOrder, dto.NewStatus);
            await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, dto.NewStatus, dto.OpsUserId, dto.Notes);
            await _notificationService.NotifySubOrderStatusChangedAsync(subOrder.Id, subOrder.SubOrderNumber, subOrder.OrderId, dto.NewStatus, pushToOps: false);
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS, OrderStatusText.StaffMessage(dto.NewStatus, subOrder.SubOrderNumber), new { subOrderId = subOrder.Id, oldStatus, newStatus = dto.NewStatus });

            await UpdateMainOrderStatusAsync(subOrder.OrderId, dto.OpsUserId);
            return await MapToDtoAsync(subOrder);
        }
        private static readonly string[] KnownStatuses =
        {
            OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.DELIVERY_FAILED,
        };

        public async Task<IEnumerable<SubOrderDto>> AssignDriverToOrderAsync(Guid orderId, AssignDriverToOrderDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new NotFoundException("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin)
                throw new BusinessRuleException("المستخدم ليس لديه صلاحية Ops");

            await using var orderLock = await _subOrderRepository.LockOrderAsync(orderId);
            await using var driverLock = await _driverRepository.LockAsync(dto.DriverId);
            var allSubOrders = (await _subOrderRepository.GetByOrderIdAsync(orderId)).ToList();
            var activeSubOrders = allSubOrders.Where(so => so.Status != OrderStatus.CANCELLED).ToList();

            if (!activeSubOrders.Any())
                throw new BusinessRuleException("لا توجد طلبات فرعية فعالة بهذا الطلب");

            // الشرط الأساسي: كل المتاجر «جاهز للاستلام» (نفس شرط AssignDriverAsync أدناه).
            // ما مع نفس السائق (معيَّن أو استلمه) أو سُلّم لا يمنع — يأخذ السائق الباقي إلى نفس التوصيلة
            var onOtherDriver = activeSubOrders.Where(so => DriverTrip.IsOpen(so) && so.DriverId != dto.DriverId).ToList();
            if (onOtherDriver.Any())
                throw new BusinessRuleException(
                    $"جزء من الطلب معيَّن لسائق آخر: {string.Join("، ", onOtherDriver.Select(so => so.SubOrderNumber))} — اسحبه منه أولاً أو عيّن السائق نفسه");
            var notReady = activeSubOrders.Where(so => so.Status != OrderStatus.DELIVERED && !DriverTrip.Statuses.Contains(so.Status)).ToList();
            if (notReady.Any())
                throw new BusinessRuleException(
                    $"لا يمكن تعيين سائق قبل أن تجهز كل المتاجر. غير جاهز: {string.Join("، ", notReady.Select(so => $"{so.SubOrderNumber} ({OrderStatusText.Ar(so.Status)})"))}");
            var toAssign = activeSubOrders.Where(so => so.Status == OrderStatus.READY && so.DriverId == null).ToList();
            if (toAssign.Count == 0)
                throw new BusinessRuleException("لا يوجد في هذا الطلب جزء جاهز بانتظار سائق");

            var driver = await _driverRepository.GetByIdAsync(dto.DriverId);
            if (driver == null) throw new NotFoundException("السائق غير موجود");
            await EnsureDriverCanTakeAsync(driver, orderId);

            // ✅ تعيين موحّد على كل الـ SubOrders الجاهزة دفعة وحدة
            // الحالة تبقى «جاهز للاستلام» حتى يستلمه السائق من المتجر (DriverTrip)
            foreach (var subOrder in toAssign)
            {
                subOrder.DriverId = dto.DriverId;
                subOrder.AssignedAt = DateTime.UtcNow;
                await _subOrderRepository.UpdateAsync(subOrder);

                await LogSubOrderStatusChangeAsync(subOrder.Id, OrderStatus.READY, OrderStatus.READY,
                    dto.OpsUserId, $"تعيين سائق موحّد لكامل الطلب: {driver.FullName}");
            }

            // ✅ السائق يصير مشغول مرة وحدة بس
            driver.WorkStatus = DriverWorkStatus.Delivering;
            await _driverRepository.UpdateAsync(driver);

            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS,
                $"تم تعيين السائق {driver.FullName} لكامل الطلب", new { orderId, driverName = driver.FullName });
            await NotifyDriverAssignedAsync(driver, orderId);
            await _notificationService.NotifyDriverUpdatedAsync(driver.Id, driver.WorkStatus, "assigned");

            await UpdateMainOrderStatusAsync(orderId, dto.OpsUserId);

            return await MapToDtosAsync(toAssign);
        }
        // ─────────────────────────────────────────────────────────────────────
        // ASSIGN DRIVER
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> AssignDriverAsync(Guid subOrderId, AssignDriverDto dto)
        {
            var opsUser = await _userRepository.GetByIdAsync(dto.OpsUserId);
            if (opsUser == null) throw new NotFoundException("المستخدم غير موجود");
            if (opsUser.Role != UserRoles.Ops && opsUser.Role != UserRoles.Admin) throw new BusinessRuleException("المستخدم ليس لديه صلاحية Ops");

            // الطلب ثم السائق (نفس الترتيب دائماً): تعيينان متزامنان لنفس الجزء أو لنفس السائق لا ينجحان معاً
            await using var orderLock = await _subOrderRepository.LockOrderOfSubOrderAsync(subOrderId);
            await using var driverLock = await _driverRepository.LockAsync(dto.DriverId);
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");
            if (subOrder.Status != OrderStatus.READY) throw new BusinessRuleException($"لا يمكن تعيين سائق قبل أن يصبح الطلب «جاهز للاستلام». الحالة الحالية: {OrderStatusText.Ar(subOrder.Status)}");
            if (subOrder.DriverId != null) throw new BusinessRuleException("الطلب معيَّن لسائق — اسحبه منه أولاً لتعيين غيره");

            var driver = await _driverRepository.GetByIdAsync(dto.DriverId);
            if (driver == null) throw new NotFoundException("السائق غير موجود");
            await EnsureDriverCanTakeAsync(driver, subOrder.OrderId);

            subOrder.DriverId = dto.DriverId;
            subOrder.AssignedAt = DateTime.UtcNow;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            driver.WorkStatus = DriverWorkStatus.Delivering;
            await _driverRepository.UpdateAsync(driver);

            await LogSubOrderStatusChangeAsync(subOrder.Id, OrderStatus.READY, OrderStatus.READY, dto.OpsUserId, $"تم تعيين السائق: {driver.FullName}");
            await SaveOpsNotificationAsync(dto.OpsUserId, NotificationType.ORDER_STATUS, $"تم تعيين السائق {driver.FullName} للطلب {subOrder.SubOrderNumber}", new { subOrderId = subOrder.Id, driverName = driver.FullName });
            await NotifyDriverAssignedAsync(driver, subOrder.OrderId);
            await _notificationService.NotifyDriverUpdatedAsync(driver.Id, driver.WorkStatus, "assigned");
            await UpdateMainOrderStatusAsync(subOrder.OrderId, dto.OpsUserId);

            return await MapToDtoAsync(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // UNASSIGN: سحب الجزء من السائق قبل أن يستلمه من المتجر — يعود «جاهز للاستلام» ويُعيَّن لغيره.
        // بعد الاستلام البضاعة مع السائق: الطريق هو «تعذّر التسليم» ومهمة الإرجاع
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrderDto> UnassignDriverAsync(Guid subOrderId, Guid opsUserId, string? reason)
        {
            await using var orderLock = await _subOrderRepository.LockOrderOfSubOrderAsync(subOrderId);
            var subOrder = await _subOrderRepository.GetByIdAsync(subOrderId);
            if (subOrder == null) throw new NotFoundException("الطلب الفرعي غير موجود");
            if (subOrder.Status == OrderStatus.OUT_FOR_DELIVERY)
                throw new BusinessRuleException("استلم السائق الطلب من المتجر — لا يمكن سحبه. يسجّل السائق «تعذّر التسليم» فتُنشأ مهمة إرجاع");
            if (!DriverTrip.AwaitingPickup(subOrder) || subOrder.DriverId is not Guid driverId)
                throw new BusinessRuleException($"لا يوجد سائق لسحب الطلب منه — الحالة: {OrderStatusText.Ar(subOrder.Status)}");

            // الطلب ثم السائق (نفس ترتيب التعيين)
            await using var driverLock = await _driverRepository.LockAsync(driverId);
            subOrder.DriverId = null;
            subOrder.AssignedAt = null;
            subOrder = await _subOrderRepository.UpdateAsync(subOrder);

            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver != null && driver.WorkStatus == DriverWorkStatus.Delivering && !await _subOrderRepository.HasActiveDeliveryAsync(driverId))
            {
                driver.WorkStatus = DriverWorkStatus.Available;
                await _driverRepository.UpdateAsync(driver);
            }

            var note = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
            await LogSubOrderStatusChangeAsync(subOrder.Id, OrderStatus.READY, OrderStatus.READY, opsUserId,
                note, $"سُحب الطلب من السائق {driver?.FullName}");
            await NotifyDriverRemovedAsync(driverId, subOrder, "سُحب منك");
            if (driver != null) await _notificationService.NotifyDriverUpdatedAsync(driver.Id, driver.WorkStatus, "unassigned");
            await UpdateMainOrderStatusAsync(subOrder.OrderId, opsUserId);

            return await MapToDtoAsync(subOrder);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GET PAGED
        // ─────────────────────────────────────────────────────────────────────
        public async Task<SubOrdersPagedResultDto> GetSubOrdersPagedAsync(int pageNumber, int pageSize, string? status)
        {
            var (items, totalCount) = await _subOrderRepository.GetPagedAsync(pageNumber, pageSize, status);
            var list = items.ToList();
            var shares = await SharesAsync(list);

            return new SubOrdersPagedResultDto
            {
                Items = list.Select(so => MapToPendingDto(so, shares.GetValueOrDefault(so.Id))).ToList(),
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
        private async Task<SubOrderDto> MapToDtoAsync(SubOrder so) =>
            MapToDto(so, (await SharesAsync(new[] { so })).GetValueOrDefault(so.Id));

        private async Task<List<SubOrderDto>> MapToDtosAsync(IReadOnlyCollection<SubOrder> subs)
        {
            var shares = await SharesAsync(subs);
            return subs.Select(so => MapToDto(so, shares.GetValueOrDefault(so.Id))).ToList();
        }

        private Task<Dictionary<Guid, decimal>> SharesAsync(IEnumerable<SubOrder> subs) =>
            _subOrderRepository.GetDiscountSharesAsync(subs.Select(s => s.OrderId));

        private SubOrderDto MapToDto(SubOrder so, decimal discountShare)
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
                DiscountShare = discountShare,
                ConfirmedBy = so.ConfirmedBy,
                ConfirmedByName = so.ConfirmedByUser?.FullName,
                ConfirmedAt = so.ConfirmedAt,
                ConfirmationDeadline = so.ConfirmationDeadline,
                MinutesRemaining = so.Status == OrderStatus.PENDING_CONFIRMATION ? (int)Math.Max(0, timeRemaining.TotalMinutes) : null,
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
                    WeightStepKg = i.WeightStepKg,
                    ReplacesItemId = i.ReplacesItemId,
                    UnavailableQuantity = i.UnavailableQuantity,
                    RefusedQuantity = i.RefusedQuantity,
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
        // DRIVER: السائق يسلّم الطلب من لوحته
        // يسلّم كل أجزاء الطلب التي معه (قد تكون من أكثر من متجر) دفعة واحدة
        // ─────────────────────────────────────────────────────────────────────
        public async Task<IReadOnlyList<SubOrder>> MarkDeliveredByDriverAsync(Guid orderId, Guid driverId, Guid driverUserId)
        {
            var all = (await _subOrderRepository.GetByOrderIdAsync(orderId)).ToList();
            var mine = all.Where(so => so.DriverId == driverId && DriverTrip.Statuses.Contains(so.Status)).ToList();
            if (mine.Count == 0)
                throw new BusinessRuleException("لا يوجد في هذا الطلب ما يمكنك تسليمه");
            // النقاط على ما دفعه الزبون فعلاً: قيمة القطع المستلمة ناقص نصيب الجزء من الخصم (كوبون/نقاط)
            var order = await _orderRepository.GetByIdAsync(orderId);
            var shares = order != null ? OrderTotals.DiscountShares(order, all) : new Dictionary<Guid, decimal>();
            // التوصيلة تُحسب للسائق مرة لكل طلب، لا لكل رحلة (طلب متعدد المتاجر قد يُسلَّم على رحلات)
            var firstTripForOrder = !all.Any(so => so.DriverId == driverId && so.Status == OrderStatus.DELIVERED);

            var now = DateTime.UtcNow;
            foreach (var subOrder in mine)
            {
                var oldStatus = subOrder.Status;
                subOrder.Status = OrderStatus.DELIVERED;
                subOrder.PickedUpAt ??= now;
                await _subOrderRepository.UpdateAsync(subOrder);
                await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, OrderStatus.DELIVERED, driverUserId, "سلّمه السائق للزبون");

                if (order != null)
                {
                    var amount = subOrder.Items?.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity)) ?? subOrder.Subtotal;
                    amount = Math.Max(0, amount - shares.GetValueOrDefault(subOrder.Id));
                    await _loyaltyService.EarnPointsAsync(order.CustomerId, subOrder.OrderId, subOrder.Id, amount);
                }
            }

            // السائق يعود متاحاً فقط إن لم يبقَ معه طلب آخر
            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver != null)
            {
                if (firstTripForOrder) driver.TotalDeliveries += 1;
                if (!await _subOrderRepository.HasActiveDeliveryAsync(driverId)) driver.WorkStatus = DriverWorkStatus.Available;
                await _driverRepository.UpdateAsync(driver);
            }

            await UpdateMainOrderStatusAsync(orderId, driverUserId);
            return mine;
        }

        // DRIVER: استلم الجزء من المتجر — الآن فقط «في الطريق» (التعيين يبقيه «جاهز للاستلام»)
        public async Task MarkPickedUpByDriverAsync(SubOrder subOrder, Guid driverUserId)
        {
            subOrder.PickedUpAt = DateTime.UtcNow;
            subOrder.Status = OrderStatus.OUT_FOR_DELIVERY;
            await _subOrderRepository.UpdateAsync(subOrder);
            await LogSubOrderStatusChangeAsync(subOrder.Id, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, driverUserId, "استلمه السائق من المتجر");
            await UpdateMainOrderStatusAsync(subOrder.OrderId, driverUserId);
        }

        // DRIVER: تعذّر التسليم — أجزاء الطلب التي مع السائق تصبح «تعذّر التسليم» وتنتظر قرار العمليات
        public async Task<IReadOnlyList<SubOrder>> MarkFailedByDriverAsync(Guid orderId, Guid driverId, Guid driverUserId, string reason, string? note)
        {
            var mine = (await _subOrderRepository.GetByOrderIdAsync(orderId))
                .Where(so => so.DriverId == driverId && DriverTrip.Statuses.Contains(so.Status))
                .ToList();
            if (mine.Count == 0)
                throw new BusinessRuleException("لا يوجد في هذا الطلب ما يمكنك إغلاقه");

            var now = DateTime.UtcNow;
            foreach (var subOrder in mine)
            {
                var oldStatus = subOrder.Status;
                subOrder.Status = OrderStatus.DELIVERY_FAILED;
                subOrder.FailureReason = reason;
                subOrder.FailureNote = note;
                subOrder.FailedAt = now;
                await _subOrderRepository.UpdateAsync(subOrder);
                await LogSubOrderStatusChangeAsync(subOrder.Id, oldStatus, OrderStatus.DELIVERY_FAILED, driverUserId,
                    DeliveryFailureReason.Ar(reason), note);
            }

            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver != null)
            {
                if (!await _subOrderRepository.HasActiveDeliveryAsync(driverId)) driver.WorkStatus = DriverWorkStatus.Available;
                await _driverRepository.UpdateAsync(driver);
            }

            await UpdateMainOrderStatusAsync(orderId, driverUserId);
            return mine;
        }

        // متاح أو يوصل الآن: السائق يحمل أكثر من طلب في جولته (طبيعي في التوصيل). الاستراحة وعدم الاتصال يمنعان
        private static Task EnsureDriverCanTakeAsync(Driver driver, Guid orderId)
        {
            if (driver.Status != DriverStatus.Active) throw new BusinessRuleException("السائق غير نشط — فعّل حسابه أولاً");
            if (driver.WorkStatus == DriverWorkStatus.Available || driver.WorkStatus == DriverWorkStatus.Delivering) return Task.CompletedTask;
            throw new BusinessRuleException(driver.WorkStatus == DriverWorkStatus.Break
                ? "السائق في استراحة الآن — اختر سائقاً آخر"
                : "السائق غير متصل الآن — اختر سائقاً آخر");
        }

        // جزء أُلغي أو سُحب قبل أن يستلمه السائق: لا يذهب للمتجر لأجله
        private async Task NotifyDriverRemovedAsync(Guid driverId, SubOrder subOrder, string what)
        {
            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver?.UserId is not Guid driverUserId) return;
            var orderNumber = subOrder.Order?.OrderNumber ?? (await _orderRepository.GetByIdAsync(subOrder.OrderId))?.OrderNumber;
            await _notificationService.NotifyCustomerAsync(driverUserId,
                $"{what} الطلب {orderNumber} ({subOrder.Vendor?.DisplayName}) — لا تستلمه من المتجر", new { orderId = subOrder.OrderId });
        }

        private async Task NotifyDriverAssignedAsync(Driver driver, Guid orderId)
        {
            if (!driver.UserId.HasValue) return;
            var order = await _orderRepository.GetByIdAsync(orderId);
            await _notificationService.NotifyCustomerAsync(driver.UserId.Value,
                $"طلب جديد بانتظارك: {order?.OrderNumber}", new { orderId, orderNumber = order?.OrderNumber });
        }

        // ─────────────────────────────────────────────────────────────────────
        // PRIVATE: Helpers
        // ─────────────────────────────────────────────────────────────────────
        private async Task UpdateMainOrderStatusAsync(Guid orderId, Guid? changedBy = null)
        {
            var order = await _orderRepository.GetByIdAsync(orderId);
            if (order == null) return;

            var oldStatus = order.Status;
            var subOrders = await _subOrderRepository.GetByOrderIdAsync(orderId);

            var statuses = subOrders.Select(so => so.Status).ToList();
            int Count(string s) => statuses.Count(x => x == s);
            var cancelled = Count(OrderStatus.CANCELLED);
            var delivered = Count(OrderStatus.DELIVERED);
            var outForDel = Count(OrderStatus.OUT_FOR_DELIVERY);
            var preparing = Count(OrderStatus.PREPARING);
            var ready = Count(OrderStatus.READY);
            var confirmed = Count(OrderStatus.CONFIRMED);

            var newStatus = OrderStatusRollup.Compute(statuses);

            if (order.Status == newStatus) return;

            order.Status = newStatus;
            OrderTotals.SyncCancelled(order, subOrders);
            await _orderRepository.UpdateAsync(order);
            await LogOrderStatusChangeAsync(order.Id, oldStatus, newStatus, changedBy, $"تحديث تلقائي: {confirmed} مؤكد، {preparing} تحضير، {ready} جاهز، {outForDel} توصيل، {delivered} مسلم، {cancelled} ملغي");
            await _notificationService.NotifyOrderStatusChangedAsync(order.Id, oldStatus, newStatus, order.OrderNumber);
            // «في الطريق إليك» حين يستلم السائق الطلب من المتجر (DriverAppService.PickUpAsync) لا لحظة تعيينه —
            // قد يُسحب منه قبل الاستلام، فلا يُبلَّغ الزبون بذهاب وعودة لم يرهما
            var pickedUp = subOrders.Any(so => so.PickedUpAt != null && so.Status != OrderStatus.CANCELLED);
            if ((newStatus == OrderStatus.OUT_FOR_DELIVERY || oldStatus == OrderStatus.OUT_FOR_DELIVERY) && !pickedUp) return;
            await _notificationService.NotifyCustomerOrderStatusAsync(order.CustomerId, order.Id, order.OrderNumber, newStatus);
        }

        // سجل لما فعله موظف العمليات نفسه — يُحفظ مقروءاً فلا يضخّم عدّاد غير المقروء بأفعاله هو
        private async Task SaveOpsNotificationAsync(Guid opsUserId, string type, string message, object data)
        {
            await _notificationRepository.CreateAsync(new Notification
            {
                UserId = opsUserId,
                Type = type,
                Message = message,
                Data = JsonSerializer.Serialize(data),
                IsRead = true,
                ReadAt = DateTime.UtcNow,
            });
        }

        private async Task UpdateDriverWorkStatusAsync(SubOrder subOrder, string newStatus)
        {
            if (!subOrder.DriverId.HasValue) return;
            var driver = await _driverRepository.GetByIdAsync(subOrder.DriverId.Value);
            if (driver == null) return;

            if (newStatus == OrderStatus.DELIVERED || newStatus == OrderStatus.CANCELLED)
            {
                // يعود متاحاً فقط إن كان «يوصل» ولم يبقَ معه طلب آخر في الطريق — إلغاء طلب فشل سابقاً
                // (ما زال يحمل معرّف سائقه القديم) لا يحرّر سائقاً خرج بطلب جديد
                var changed = false;
                if (driver.WorkStatus == DriverWorkStatus.Delivering && !await _subOrderRepository.HasActiveDeliveryAsync(driver.Id, subOrder.Id))
                {
                    driver.WorkStatus = DriverWorkStatus.Available;
                    changed = true;
                }
                if (newStatus == OrderStatus.DELIVERED) { driver.TotalDeliveries += 1; changed = true; }
                if (changed) await _driverRepository.UpdateAsync(driver);
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