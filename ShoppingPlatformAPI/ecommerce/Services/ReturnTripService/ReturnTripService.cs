using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.ReturnTripService
{
    public interface IReturnTripService
    {
        // تعذّر التسليم: مهمة إرجاع لكل جزء فشل (ما لم يُستلم من المتجر أصلاً يُلغى فوراً ويعود مخزونه)
        Task CreateForFailureAsync(Guid orderId, Guid driverId, IReadOnlyCollection<Guid> subOrderIds, string reason, CancellationToken ct = default);
        // رفض عند الباب: مهمة إرجاع للقطع المرفوضة فقط
        Task CreateForRefusalAsync(Guid orderId, Guid driverId, Guid returnId, IReadOnlyCollection<(SubOrderItem Item, int Quantity)> refused, CancellationToken ct = default);
        Task<List<ReturnTripDto>> GetOpenForDriverAsync(Guid driverId, CancellationToken ct = default);
        // سجل السائق: كل ما استلمه المتجر، الأحدث استلاماً أولاً، حتى سقف `limit`
        Task<List<ReturnTripDto>> GetClosedForDriverAsync(Guid driverId, int limit = 200, CancellationToken ct = default);
        Task<int> CountOpenForDriverAsync(Guid driverId, CancellationToken ct = default);
        Task<List<ReturnTripDto>> GetForVendorAsync(Guid vendorId, bool openOnly, CancellationToken ct = default);
        Task<ReturnTripReportDto> GetReportAsync(DateOnly? from, DateOnly? to, CancellationToken ct = default);
        // المتجر (أو العمليات نيابة عنه) يؤكد استلام البضاعة: يعود المخزون ويُغلق الجزء الفاشل
        Task<ReturnTripDto> ConfirmReceivedAsync(Guid tripId, Guid userId, Guid? vendorId, CancellationToken ct = default);

        // إرجاع بعد الاستلام: العمليات تعيّن سائقاً يأخذ القطع من الزبون (مهمة لكل متجر)، أو تسحبه قبل أن يأخذها
        Task AssignCustomerReturnAsync(Guid returnId, Guid driverId, Guid opsUserId, CancellationToken ct = default);
        Task UnassignCustomerReturnAsync(Guid returnId, Guid opsUserId, CancellationToken ct = default);
        // السائق: أخذ القطع من الزبون، أو تعذّر أخذها (تعود المهمة للعمليات لتعيين سائق آخر)
        Task CollectCustomerReturnAsync(Guid driverId, Guid returnId, CancellationToken ct = default);
        Task FailCustomerReturnPickupAsync(Guid driverId, Guid returnId, string? note, CancellationToken ct = default);
    }

    public class ReturnTripService : IReturnTripService
    {
        private readonly AppDbContext _context;
        private readonly IInventoryService _inventory;
        private readonly INotificationService? _notifications;
        private readonly ILoyaltyService? _loyalty;
        private readonly ecommerce.Services.FinanceService.IFinanceService? _finance;

        public ReturnTripService(AppDbContext context, IInventoryService inventory,
            INotificationService? notifications = null, ILoyaltyService? loyalty = null,
            ecommerce.Services.FinanceService.IFinanceService? finance = null)
        {
            _context = context;
            _inventory = inventory;
            _notifications = notifications;
            _loyalty = loyalty;
            _finance = finance;
        }

        public async Task CreateForFailureAsync(Guid orderId, Guid driverId, IReadOnlyCollection<Guid> subOrderIds, string reason, CancellationToken ct = default)
        {
            var subs = await _context.SubOrders.Include(so => so.Items)
                .Where(so => subOrderIds.Contains(so.Id) && so.Status == OrderStatus.DELIVERY_FAILED)
                .ToListAsync(ct);
            if (subs.Count == 0) return;
            if (await _context.ReturnTrips.AnyAsync(t => subOrderIds.Contains(t.SubOrderId) && t.ReturnId == null, ct)) return;

            var trips = subs.Select(so => NewTrip(orderId, so.Id, so.VendorId, driverId, reason, null,
                so.Items.Select(i => (i, i.Quantity - i.RefusedQuantity)))).Where(t => t.Items.Count > 0).ToList();
            _context.ReturnTrips.AddRange(trips);
            await _context.SaveChangesAsync(ct);

            // لم يستلمها السائق من المتجر (سبب آخر قبل الاستلام): البضاعة ما زالت هناك — تُغلق فوراً
            foreach (var trip in trips.Where(t => subs.First(s => s.Id == t.SubOrderId).PickedUpAt == null))
                await ApplyReceiptAsync(trip, receivedBy: null, ct);
            await NotifyVendorsAsync(trips.Where(t => t.Status == ReturnTripStatus.WithDriver));
        }

        public async Task CreateForRefusalAsync(Guid orderId, Guid driverId, Guid returnId,
            IReadOnlyCollection<(SubOrderItem Item, int Quantity)> refused, CancellationToken ct = default)
        {
            if (refused.Count == 0) return;
            var vendorOf = await _context.SubOrders.AsNoTracking()
                .Where(so => so.OrderId == orderId).ToDictionaryAsync(so => so.Id, so => so.VendorId, ct);
            var trips = refused.GroupBy(r => r.Item.SubOrderId)
                .Select(g => NewTrip(orderId, g.Key, vendorOf[g.Key], driverId, ReturnTripReason.DoorRefusal, returnId,
                    g.Select(r => (r.Item, r.Quantity))))
                .ToList();
            _context.ReturnTrips.AddRange(trips);
            await _context.SaveChangesAsync(ct);
            await NotifyVendorsAsync(trips);
        }

        private static ReturnTrip NewTrip(Guid orderId, Guid subOrderId, Guid vendorId, Guid driverId, string reason, Guid? returnId,
            IEnumerable<(SubOrderItem Item, int Quantity)> lines) => new()
        {
            OrderId = orderId, SubOrderId = subOrderId, VendorId = vendorId, DriverId = driverId,
            Reason = reason, ReturnId = returnId, DeliveryFee = 0,
            Items = lines.Where(l => l.Quantity > 0).Select(l => new ReturnTripItem
            {
                SubOrderItemId = l.Item.Id, ProductId = l.Item.ProductId, VariantId = l.Item.VariantId,
                ProductName = l.Item.ProductNameAr ?? l.Item.ProductName, Quantity = l.Quantity,
            }).ToList(),
        };

        public Task<List<ReturnTripDto>> GetOpenForDriverAsync(Guid driverId, CancellationToken ct = default) =>
            QueryAsync(Query().Where(t => t.DriverId == driverId && ReturnTripStatus.Open.Contains(t.Status)), ct);

        public Task<List<ReturnTripDto>> GetClosedForDriverAsync(Guid driverId, int limit = 200, CancellationToken ct = default) =>
            QueryAsync(Query().Where(t => t.DriverId == driverId && t.Status == ReturnTripStatus.Received)
                .OrderByDescending(t => t.ReceivedAt ?? t.CreatedAt).Take(limit), ct);

        public Task<int> CountOpenForDriverAsync(Guid driverId, CancellationToken ct = default) =>
            _context.ReturnTrips.CountAsync(t => t.DriverId == driverId && ReturnTripStatus.Open.Contains(t.Status), ct);

        public Task<List<ReturnTripDto>> GetForVendorAsync(Guid vendorId, bool openOnly, CancellationToken ct = default)
        {
            var since = DateTime.UtcNow.AddDays(-30);
            return QueryAsync(Query().Where(t => t.VendorId == vendorId
                && (ReturnTripStatus.Open.Contains(t.Status) || (!openOnly && t.CreatedAt >= since))), ct);
        }

        public async Task<ReturnTripReportDto> GetReportAsync(DateOnly? from, DateOnly? to, CancellationToken ct = default)
        {
            // الأيام بتوقيت بغداد؛ بلا فترة = آخر 30 يوماً. المفتوحة تظهر دائماً مهما كان تاريخها
            var toDay = to ?? DateOnly.FromDateTime(IraqTime.FromUtc(DateTime.UtcNow));
            var fromDay = from ?? toDay.AddDays(-29);
            if (toDay < fromDay) throw new BusinessRuleException("تاريخ النهاية قبل تاريخ البداية");
            var start = fromDay.ToDateTime(TimeOnly.MinValue) - IraqTime.Offset;
            var end = toDay.AddDays(1).ToDateTime(TimeOnly.MinValue) - IraqTime.Offset;

            var trips = await QueryAsync(Query().Where(t => ReturnTripStatus.Open.Contains(t.Status)
                || (t.CreatedAt >= start && t.CreatedAt < end)), ct);
            return new ReturnTripReportDto
            {
                Open = trips.Count(t => ReturnTripStatus.Open.Contains(t.Status)),
                Received = trips.Count(t => t.Status == ReturnTripStatus.Received),
                ByReason = trips.GroupBy(t => t.ReasonAr).ToDictionary(g => g.Key, g => g.Count()),
                Trips = trips,
            };
        }

        public async Task<ReturnTripDto> ConfirmReceivedAsync(Guid tripId, Guid userId, Guid? vendorId, CancellationToken ct = default)
        {
            var orderId = await _context.ReturnTrips.AsNoTracking().Where(t => t.Id == tripId)
                .Select(t => (Guid?)t.OrderId).FirstOrDefaultAsync(ct) ?? throw new NotFoundException("مهمة الإرجاع غير موجودة");
            // تأكيدان متزامنان (المتجر والعمليات): واحد فقط يُعيد المخزون
            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId, ct);

            var trip = await _context.ReturnTrips.Include(t => t.Items)
                .FirstOrDefaultAsync(t => t.Id == tripId && (vendorId == null || t.VendorId == vendorId), ct)
                ?? throw new NotFoundException("مهمة الإرجاع غير موجودة");
            if (trip.Status == ReturnTripStatus.Received)
                throw new BusinessRuleException("تم تأكيد استلام هذه البضاعة مسبقاً");
            if (trip.Status == ReturnTripStatus.AtCustomer)
                throw new BusinessRuleException("لم يأخذ السائق القطع من الزبون بعد");

            await ApplyReceiptAsync(trip, userId, ct);
            if (trip.Reason == ReturnTripReason.CustomerReturn) await CompleteCustomerReturnAsync(trip, ct);
            return (await QueryAsync(Query().Where(t => t.Id == tripId), ct)).Single();
        }

        // الاستلام: المخزون يعود للقطع المُرجعة، والجزء الفاشل يُغلق «ملغى» (والطلب يتبع أجزاءه)
        private async Task ApplyReceiptAsync(ReturnTrip trip, Guid? receivedBy, CancellationToken ct)
        {
            trip.Status = ReturnTripStatus.Received;
            trip.ReceivedAt = DateTime.UtcNow;
            trip.ReceivedBy = receivedBy;

            var restock = true;
            // رفض عند الباب من أكثر من متجر: مهمة لكل متجر بنفس سجل الإرجاع — كل مهمة تعيد قطعها هي.
            // علامة «أُعيد للمخزون» على السجل تمنع الإعادة فقط إن أعادته الإدارة يدوياً قبل أول استلام
            var siblingReceived = trip.ReturnId is Guid rid && await _context.ReturnTrips.AnyAsync(t =>
                t.ReturnId == rid && t.Id != trip.Id && t.Status == ReturnTripStatus.Received, ct);
            if (trip.ReturnId is Guid returnId && !siblingReceived)
            {
                // رفض عند الباب: سجل الإرجاع يُعلَّم «أُعيد للمخزون» — إلا إن أعادته الإدارة يدوياً قبل ذلك
                if (_context.Database.IsRelational())
                    restock = await _context.Returns.Where(r => r.Id == returnId && !r.IsRestocked)
                        .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsRestocked, true)
                            .SetProperty(r => r.RestockedAt, DateTime.UtcNow)
                            .SetProperty(r => r.RestockedBy, receivedBy), ct) > 0;
                else if (await _context.Returns.FirstOrDefaultAsync(r => r.Id == returnId, ct) is { IsRestocked: false } ret)
                {
                    ret.IsRestocked = true;
                    ret.RestockedAt = DateTime.UtcNow;
                    ret.RestockedBy = receivedBy;
                }
                else restock = false;
            }
            if (restock)
                await _inventory.RestockAsync(trip.Items.Select(i => new StockLineQuantity(i.ProductId, i.VariantId, i.Quantity)), ct);

            if (trip.ReturnId == null) await CloseFailedSubOrderAsync(trip, receivedBy, ct);
            else if (trip.Reason == ReturnTripReason.DoorRefusal) await CompleteDoorRefusalAsync(trip, ct);
            await _context.SaveChangesAsync(ct);
        }

        // كل متاجر الرفض استلمت قطعها: سجل الإرجاع مكتمل (لا استرجاع مال — الزبون لم يدفع ثمن ما رفضه)،
        // فلا يبقى «نشطاً» يمنع الزبون من إرجاع قطع أخرى من الطلب
        private async Task CompleteDoorRefusalAsync(ReturnTrip trip, CancellationToken ct)
        {
            var ret = await _context.Returns.FirstOrDefaultAsync(r => r.Id == trip.ReturnId && r.IsDoorRefusal, ct);
            if (ret == null || ret.Status != ReturnStatus.APPROVED) return;
            var othersOpen = await _context.ReturnTrips.AnyAsync(t =>
                t.ReturnId == ret.Id && t.Id != trip.Id && t.Status != ReturnTripStatus.Received, ct);
            if (othersOpen) return;
            ret.Status = ReturnStatus.COMPLETED;
            ret.UpdatedAt = DateTime.UtcNow;
        }

        private async Task CloseFailedSubOrderAsync(ReturnTrip trip, Guid? userId, CancellationToken ct)
        {
            var order = await _context.Orders.Include(o => o.SubOrders).FirstAsync(o => o.Id == trip.OrderId, ct);
            var sub = order.SubOrders.First(s => s.Id == trip.SubOrderId);
            if (sub.Status != OrderStatus.DELIVERY_FAILED) return;

            var reason = $"تعذّر التسليم: {DeliveryFailureReason.Ar(trip.Reason)} — أُرجع للمتجر";
            sub.Status = OrderStatus.CANCELLED;
            sub.CancellationReason = reason;
            sub.CancelledBy = userId;
            sub.CancelledAt = DateTime.UtcNow;
            sub.UpdatedAt = DateTime.UtcNow;
            _context.OrderStatusLogs.Add(new OrderStatusLog
            {
                SubOrderId = sub.Id, OldStatus = OrderStatus.DELIVERY_FAILED, NewStatus = OrderStatus.CANCELLED,
                ChangedBy = userId, Reason = reason, Notes = "استلم المتجر البضاعة المُرجعة",
            });

            // الزبون لا يدفع ثمن ما لم يستلمه
            OrderTotals.Recalculate(order, order.SubOrders);
            var oldStatus = order.Status;
            var newStatus = OrderStatusRollup.Compute(order.SubOrders.Select(s => s.Status).ToList());
            if (newStatus == OrderStatus.CANCELLED && string.IsNullOrWhiteSpace(order.CancellationReason))
                order.CancellationReason = reason;
            if (newStatus != oldStatus)
            {
                order.Status = newStatus;
                order.UpdatedAt = DateTime.UtcNow;
                _context.OrderStatusLogs.Add(new OrderStatusLog
                {
                    OrderId = order.Id, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = userId,
                    Notes = "تحديث تلقائي بعد إرجاع البضاعة للمتجر",
                });
            }
            // آخر جزء مفتوح أُغلق والباقي سُلّم: الطلب مدفوع
            OrderTotals.SyncPayment(order);
            OrderTotals.SyncCancelled(order, order.SubOrders);
            await _context.SaveChangesAsync(ct);

            if (newStatus == OrderStatus.CANCELLED && _loyalty != null)
                await _loyalty.CancelRedemptionAsync(order.Id);   // النقاط المستخدمة ترجع للزبون (الكوبون يبقى مستهلَكاً)
            else if (_loyalty != null)
                await _loyalty.RefundUnusedPointsAsync(order.Id);
            if (newStatus != oldStatus && _notifications != null)
            {
                try
                {
                    await _notifications.NotifyOrderStatusChangedAsync(order.Id, oldStatus, newStatus, order.OrderNumber);
                    await _notifications.NotifyCustomerOrderStatusAsync(order.CustomerId, order.Id, order.OrderNumber, newStatus);
                }
                catch { /* الإشعار لا يُفشل الاستلام */ }
            }
        }

        // ===================================
        // إرجاع بعد الاستلام: السائق يأخذ القطع من الزبون ويوصلها لمتاجرها
        // ===================================
        public async Task AssignCustomerReturnAsync(Guid returnId, Guid driverId, Guid opsUserId, CancellationToken ct = default)
        {
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId, ct);
            var ret = await _context.Returns.Include(r => r.Items).FirstOrDefaultAsync(r => r.Id == returnId, ct)
                ?? throw new NotFoundException("طلب الإرجاع غير موجود");
            if (ret.IsDoorRefusal) throw new BusinessRuleException("رفض عند الاستلام — القطع مع السائق أصلاً");
            if (ret.Status != ReturnStatus.APPROVED) throw new BusinessRuleException("يُعيَّن سائق للإرجاع بعد الموافقة عليه فقط");
            if (ret.ItemsReceivedAt != null) throw new BusinessRuleException("وصلت القطع للمتجر مسبقاً");
            if (await _context.ReturnTrips.AnyAsync(t => t.ReturnId == returnId && ReturnTripStatus.Open.Contains(t.Status), ct))
                throw new BusinessRuleException("الإرجاع معيَّن لسائق — اسحبه منه أولاً لتعيين غيره");

            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId, ct)
                ?? throw new NotFoundException("السائق غير موجود");
            if (driver.Status != DriverStatus.Active) throw new BusinessRuleException("السائق غير نشط — فعّل حسابه أولاً");
            if (driver.WorkStatus != DriverWorkStatus.Available && driver.WorkStatus != DriverWorkStatus.Delivering)
                throw new BusinessRuleException(driver.WorkStatus == DriverWorkStatus.Break
                    ? "السائق في استراحة الآن — اختر سائقاً آخر" : "السائق غير متصل الآن — اختر سائقاً آخر");

            // قطع الإرجاع ← قطعها في الطلب (لكل متجر مهمة، كما في الطلب)
            var subs = await _context.SubOrders.Include(so => so.Items)
                .Where(so => so.OrderId == ret.OrderId && so.Status == OrderStatus.DELIVERED).ToListAsync(ct);
            var lines = ret.Items.Select(ri => (Item: subs.SelectMany(s => s.Items)
                    .FirstOrDefault(i => i.ProductId == ri.ProductId && i.VariantId == ri.VariantId), ri.Quantity))
                .Where(l => l.Item != null).Select(l => (l.Item!, l.Quantity)).ToList();
            if (lines.Count == 0) throw new BusinessRuleException("قطع الإرجاع غير موجودة في الطلب");

            var payer = ret.PickupFeePayer;
            var trips = lines.GroupBy(l => l.Item1.SubOrderId).Select(g =>
            {
                var sub = subs.First(s => s.Id == g.Key);
                var trip = NewTrip(ret.OrderId, sub.Id, sub.VendorId, driverId, ReturnTripReason.CustomerReturn, ret.Id, g.Select(l => (l.Item1, l.Quantity)));
                trip.Status = ReturnTripStatus.AtCustomer;
                trip.DeliveryFee = payer == RefusalFeePayer.None ? 0 : sub.DeliveryFee;
                return trip;
            }).ToList();
            _context.ReturnTrips.AddRange(trips);
            ret.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);

            if (_notifications == null) return;
            try
            {
                var order = await _context.Orders.AsNoTracking().Include(o => o.Customer).Include(o => o.Address)
                    .FirstAsync(o => o.Id == ret.OrderId, ct);
                if (driver.UserId is Guid driverUserId)
                    await _notifications.NotifyCustomerAsync(driverUserId,
                        $"استلام مرتجع {ret.ReturnNumber} من الزبون {order.Customer?.FullName} ({order.Address?.Area}) — ثم أوصله للمتجر",
                        new { returnId = ret.Id });
                await _notifications.NotifyCustomerAsync(ret.CustomerId,
                    $"سيأتيك السائق {driver.FullName} لاستلام القطع المُرجعة ({ret.ReturnNumber}) — جهّزها من فضلك",
                    new { returnId = ret.Id, orderId = ret.OrderId });
            }
            catch { /* الإشعار لا يُفشل التعيين */ }
        }

        public async Task UnassignCustomerReturnAsync(Guid returnId, Guid opsUserId, CancellationToken ct = default)
        {
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId, ct);
            var trips = await _context.ReturnTrips.Include(t => t.Items)
                .Where(t => t.ReturnId == returnId && t.Reason == ReturnTripReason.CustomerReturn && ReturnTripStatus.Open.Contains(t.Status))
                .ToListAsync(ct);
            if (trips.Count == 0) throw new BusinessRuleException("لا يوجد سائق معيَّن لهذا الإرجاع");
            if (trips.Any(t => t.Status != ReturnTripStatus.AtCustomer))
                throw new BusinessRuleException("أخذ السائق القطع من الزبون — يؤكد المتجر استلامها حين تصل");
            await RemovePickupTripsAsync(trips, "سُحب منك استلام المرتجع", ct);
        }

        public async Task CollectCustomerReturnAsync(Guid driverId, Guid returnId, CancellationToken ct = default)
        {
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId, ct);
            var trips = await _context.ReturnTrips.Include(t => t.Items)
                .Where(t => t.ReturnId == returnId && t.DriverId == driverId && t.Status == ReturnTripStatus.AtCustomer)
                .ToListAsync(ct);
            if (trips.Count == 0) throw new NotFoundException("مهمة الاستلام غير موجودة أو تمت مسبقاً");

            var now = DateTime.UtcNow;
            foreach (var t in trips) { t.Status = ReturnTripStatus.WithDriver; t.PickedUpAt = now; }
            await _context.SaveChangesAsync(ct);

            await NotifyVendorsAsync(trips);
            if (_notifications == null) return;
            try
            {
                var ret = await _context.Returns.AsNoTracking().FirstAsync(r => r.Id == returnId, ct);
                await _notifications.NotifyCustomerAsync(ret.CustomerId,
                    $"استلم السائق القطع المُرجعة ({ret.ReturnNumber}) — يُردّ لك المبلغ بعد وصولها للمتجر",
                    new { returnId, orderId = ret.OrderId });
            }
            catch { /* الإشعار لا يُفشل الاستلام */ }
        }

        public async Task FailCustomerReturnPickupAsync(Guid driverId, Guid returnId, string? note, CancellationToken ct = default)
        {
            await using var returnLock = await OrderLock.ForReturnAsync(_context, returnId, ct);
            var trips = await _context.ReturnTrips.Include(t => t.Items)
                .Where(t => t.ReturnId == returnId && t.DriverId == driverId && t.Status == ReturnTripStatus.AtCustomer)
                .ToListAsync(ct);
            if (trips.Count == 0) throw new NotFoundException("مهمة الاستلام غير موجودة أو تمت مسبقاً");
            await RemovePickupTripsAsync(trips, null, ct);

            if (_notifications == null) return;
            try
            {
                var ret = await _context.Returns.AsNoTracking().FirstAsync(r => r.Id == returnId, ct);
                var why = string.IsNullOrWhiteSpace(note) ? "" : $": {note.Trim()}";
                await _notifications.NotifyOpsAsync(NotificationCategory.Returns, NotificationType.RETURN,
                    $"تعذّر استلام المرتجع {ret.ReturnNumber} من الزبون{why} — عيّن سائقاً آخر أو تواصل مع الزبون", new { returnId });
                await _notifications.NotifyCustomerAsync(ret.CustomerId,
                    $"حاول السائق استلام القطع المُرجعة ({ret.ReturnNumber}) ولم يتمكن — سنتواصل معك لموعد آخر",
                    new { returnId, orderId = ret.OrderId });
            }
            catch { /* الإشعار لا يُفشل التسجيل */ }
        }

        // مهمة استلام لم يأخذ فيها السائق شيئاً: تُحذف (لا بضاعة تحرّكت) ويعود الإرجاع «بانتظار سائق»
        private async Task RemovePickupTripsAsync(List<ReturnTrip> trips, string? driverMessage, CancellationToken ct)
        {
            var driverId = trips[0].DriverId;
            var returnId = trips[0].ReturnId;
            _context.ReturnTripItems.RemoveRange(trips.SelectMany(t => t.Items));
            _context.ReturnTrips.RemoveRange(trips);
            await _context.SaveChangesAsync(ct);

            if (driverMessage == null || _notifications == null) return;
            try
            {
                var userId = await _context.Drivers.AsNoTracking().Where(d => d.Id == driverId).Select(d => d.UserId).FirstOrDefaultAsync(ct);
                var number = await _context.Returns.AsNoTracking().Where(r => r.Id == returnId).Select(r => r.ReturnNumber).FirstOrDefaultAsync(ct);
                if (userId is Guid u)
                    await _notifications.NotifyCustomerAsync(u, $"{driverMessage} ({number}) — لا تذهب للزبون لأجله", new { returnId });
            }
            catch { /* الإشعار لا يُفشل السحب */ }
        }

        // كل متاجر الإرجاع استلمت قطعها: الآن يُخصم من المتجر، ويُفتح ردّ المبلغ للزبون
        private async Task CompleteCustomerReturnAsync(ReturnTrip trip, CancellationToken ct)
        {
            var ret = await _context.Returns.FirstOrDefaultAsync(r => r.Id == trip.ReturnId, ct);
            if (ret == null || ret.ItemsReceivedAt != null) return;
            if (await _context.ReturnTrips.AnyAsync(t => t.ReturnId == ret.Id && t.Id != trip.Id && ReturnTripStatus.Open.Contains(t.Status), ct))
                return;
            ret.ItemsReceivedAt = DateTime.UtcNow;
            ret.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            if (_finance != null) await _finance.EnsureReturnEntriesAsync(ret.Id, ct);

            if (_notifications == null) return;
            try
            {
                await _notifications.NotifyCustomerAsync(ret.CustomerId,
                    $"وصلت القطع المُرجعة ({ret.ReturnNumber}) للمتجر — سيُردّ لك {ret.RefundAmount:N0} د.ع",
                    new { returnId = ret.Id, orderId = ret.OrderId });
                await _notifications.NotifyOpsAsync(NotificationCategory.Returns, NotificationType.RETURN,
                    $"وصلت قطع الإرجاع {ret.ReturnNumber} للمتجر — ردّ للزبون {ret.RefundAmount:N0} د.ع", new { returnId = ret.Id });
            }
            catch { /* الإشعار لا يُفشل الاستلام */ }
        }

        private async Task NotifyVendorsAsync(IEnumerable<ReturnTrip> trips)
        {
            if (_notifications == null) return;
            foreach (var t in trips)
            {
                try
                {
                    await _notifications.NotifyVendorAsync(t.VendorId, NotificationCategory.Returns, NotificationType.RETURN,
                        $"بضاعة ستعود إليك مع السائق ({t.Items.Sum(i => i.Quantity)} قطعة) — أكّد استلامها من «المرتجعات» حين تصل",
                        new { returnTripId = t.Id, orderId = t.OrderId });
                }
                catch { /* الإشعار لا يُفشل التسجيل */ }
            }
        }

        private IQueryable<ReturnTrip> Query() => _context.ReturnTrips.AsNoTracking();

        private static async Task<List<ReturnTripDto>> QueryAsync(IQueryable<ReturnTrip> query, CancellationToken ct)
        {
            var rows = await query
                .OrderByDescending(t => t.Status == ReturnTripStatus.WithDriver).ThenByDescending(t => t.CreatedAt)
                .Select(t => new
                {
                    t.Id, t.OrderId, t.Order.OrderNumber, t.SubOrder.SubOrderNumber, t.VendorId,
                    VendorName = t.Vendor.NameAr ?? t.Vendor.Name, VendorPhone = t.Vendor.Phone, VendorAddress = t.Vendor.Address,
                    t.DriverId, DriverName = t.Driver.FullName, DriverPhone = t.Driver.Phone,
                    t.Reason, t.Status, t.DeliveryFee, t.CreatedAt, t.ReceivedAt, t.PickedUpAt, t.ReturnId,
                    ReturnNumber = t.Return != null ? t.Return.ReturnNumber : null,
                    CustomerName = t.Order.Customer.FullName,
                    CustomerPhone = t.Order.Address != null && t.Order.Address.Phone != null ? t.Order.Address.Phone : t.Order.Customer.Phone,
                    Street = t.Order.Address != null ? t.Order.Address.StreetAddress : null,
                    Area = t.Order.Address != null ? t.Order.Address.Area : null,
                    City = t.Order.Address != null ? t.Order.Address.City : null,
                    Lat = t.Order.DeliveryLatitude, Lng = t.Order.DeliveryLongitude,
                    Items = t.Items.Select(i => new ReturnTripItemDto { ProductName = i.ProductName, Quantity = i.Quantity }).ToList(),
                })
                .ToListAsync(ct);
            return rows.Select(r => new ReturnTripDto
            {
                Id = r.Id, OrderId = r.OrderId, OrderNumber = r.OrderNumber, SubOrderNumber = r.SubOrderNumber,
                VendorId = r.VendorId, VendorName = r.VendorName ?? "", VendorPhone = r.VendorPhone, VendorAddress = r.VendorAddress,
                DriverId = r.DriverId, DriverName = r.DriverName ?? "", DriverPhone = r.DriverPhone,
                Reason = r.Reason, ReasonAr = ReasonAr(r.Reason), Status = r.Status, DeliveryFee = r.DeliveryFee,
                CreatedAt = r.CreatedAt, ReceivedAt = r.ReceivedAt, Items = r.Items,
                ReturnId = r.ReturnId, ReturnNumber = r.ReturnNumber, PickedUpAt = r.PickedUpAt,
                CustomerName = r.CustomerName, CustomerPhone = r.CustomerPhone,
                CustomerAddress = string.Join("، ", new[] { r.Street, r.Area, r.City }.Where(x => !string.IsNullOrWhiteSpace(x))),
                Latitude = r.Lat, Longitude = r.Lng,
            }).ToList();
        }

        public static string ReasonAr(string reason) =>
            reason == ReturnTripReason.DoorRefusal ? "رفض قطع عند الاستلام"
            : reason == ReturnTripReason.CustomerReturn ? "إرجاع من الزبون بعد الاستلام"
            : DeliveryFailureReason.Ar(reason);
    }
}
