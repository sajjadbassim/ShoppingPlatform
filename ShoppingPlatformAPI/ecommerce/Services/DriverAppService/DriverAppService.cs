using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.DriverTrackingService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.DriverAppService
{
    // لوحة السائق: كل العمليات هنا تخص السائق المرتبط بحساب المستخدم الحالي فقط
    public interface IDriverAppService
    {
        Task<DriverProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default);
        Task<DriverProfileDto> SetWorkStatusAsync(Guid userId, string workStatus, CancellationToken ct = default);
        Task<List<DriverOrderDto>> GetOrdersAsync(Guid userId, bool history, CancellationToken ct = default);
        Task PickUpAsync(Guid userId, Guid subOrderId, CancellationToken ct = default);
        Task<DriverOrderDto> DeliverAsync(Guid userId, Guid orderId, DriverDeliverDto dto, CancellationToken ct = default);
        Task<DriverOrderDto> FailAsync(Guid userId, Guid orderId, DriverFailDto dto, CancellationToken ct = default);
        Task<string> GetRefusalFeePayerAsync(CancellationToken ct = default);
        Task<DeliverySettingsDto> GetSettingsAsync(CancellationToken ct = default);
        Task<DeliverySettingsDto> UpdateSettingsAsync(DeliverySettingsDto dto, Guid userId, CancellationToken ct = default);
        Task<bool> UpdateLocationAsync(Guid userId, DriverLocationUpdateDto dto, CancellationToken ct = default);

        // للعمليات
        Task<DriverDto> SetAccountAsync(Guid driverId, string password, CancellationToken ct = default);
        Task<DriverCashDto> GetCashAsync(Guid driverId, CancellationToken ct = default);
        Task<DriverCashDto> GetMyCashAsync(Guid userId, CancellationToken ct = default);
        Task<List<DriverCashCustodyDto>> GetCashCustodyAsync(CancellationToken ct = default);
        Task<OrderRefusalFeeDto> GetRefusalFeeAsync(Guid orderId, CancellationToken ct = default);
        Task<OrderRefusalFeeDto> SetRefusalFeeOverrideAsync(Guid orderId, string? payer, string? reason, Guid userId, CancellationToken ct = default);
        Task<List<ReturnTripDto>> GetMyReturnTripsAsync(Guid userId, bool history = false, CancellationToken ct = default);
        Task CollectCustomerReturnAsync(Guid userId, Guid returnId, CancellationToken ct = default);
        Task FailCustomerReturnPickupAsync(Guid userId, Guid returnId, string? note, CancellationToken ct = default);
        Task<(int Orders, decimal Amount)> SettleCashAsync(Guid driverId, Guid opsUserId, decimal? expectedAmount = null, CancellationToken ct = default);
    }

    public class DriverAppService : IDriverAppService
    {
        private const int HistoryDays = 7;
        private static readonly string[] SelfStatuses = { DriverWorkStatus.Available, DriverWorkStatus.Break, DriverWorkStatus.Offline };

        private readonly AppDbContext _context;
        private readonly IOpsService _ops;
        private readonly IDriverTrackingService _tracking;
        private readonly INotificationService? _notifications;
        private readonly ecommerce.Services.FinanceService.IFinanceService? _finance;
        private readonly ecommerce.Services.ReturnTripService.IReturnTripService? _returnTrips;

        private readonly ecommerce.Services.ILoyaltyService? _loyalty;

        public DriverAppService(AppDbContext context, IOpsService ops, IDriverTrackingService tracking, INotificationService? notifications = null,
            ecommerce.Services.FinanceService.IFinanceService? finance = null,
            ecommerce.Services.ReturnTripService.IReturnTripService? returnTrips = null,
            ecommerce.Services.ILoyaltyService? loyalty = null)
        {
            _loyalty = loyalty;
            _finance = finance;
            _returnTrips = returnTrips;
            _context = context;
            _ops = ops;
            _tracking = tracking;
            _notifications = notifications;
        }

        // ===================================
        // الملف الشخصي والحالة
        // ===================================
        public async Task<DriverProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            var todayUtc = IraqTime.TodayStartUtc;   // «اليوم» بتوقيت بغداد

            var activeOrders = await _context.SubOrders
                .Where(so => so.DriverId == driver.Id && DriverTrip.Statuses.Contains(so.Status))
                .Select(so => so.OrderId).Distinct().CountAsync(ct);

            // «يوصل» بلا أي طلب معه: حالة عالقة (سُلّم أو أُلغي من العمليات) — يعود متاحاً
            if (activeOrders == 0 && driver.WorkStatus == DriverWorkStatus.Delivering)
            {
                driver.WorkStatus = DriverWorkStatus.Available;
                driver.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
                await Broadcast(driver.Id, driver.WorkStatus, "work_status");
            }

            var deliveredToday = await _context.OrderStatusLogs
                .Where(l => l.ChangedBy == userId && l.NewStatus == OrderStatus.DELIVERED && l.SubOrderId != null && l.CreatedAt >= todayUtc)
                .Select(l => l.SubOrder.OrderId).Distinct().CountAsync(ct);

            var cash = await _context.DriverCashEntries
                .Where(e => e.DriverId == driver.Id && e.SettledAt == null)
                .SumAsync(e => e.Amount, ct);

            return new DriverProfileDto
            {
                DriverId = driver.Id,
                FullName = driver.FullName,
                Phone = driver.Phone,
                VehicleType = driver.VehicleType,
                WorkStatus = driver.WorkStatus,
                Rating = driver.Rating,
                TotalDeliveries = driver.TotalDeliveries,
                DeliveredToday = deliveredToday,
                ActiveOrders = activeOrders,
                CashInHand = cash,
                OpenReturnTrips = _returnTrips == null ? 0 : await _returnTrips.CountOpenForDriverAsync(driver.Id, ct),
                LastLocationAt = driver.LastLocationAt,
            };
        }

        public async Task<DriverProfileDto> SetWorkStatusAsync(Guid userId, string workStatus, CancellationToken ct = default)
        {
            if (!SelfStatuses.Contains(workStatus))
                throw new BusinessRuleException("حالة غير صالحة");

            var driver = await GetDriverAsync(userId, ct);
            var active = await _context.SubOrders
                .Where(so => so.DriverId == driver.Id && DriverTrip.Statuses.Contains(so.Status))
                .Select(so => so.PickedUpAt).ToListAsync(ct);
            // طلب معيَّن لم يُستلم بعد: «سلّمها» مضللة — يستلمه أو تعيده العمليات لغيره
            if (active.Any(p => p != null))
                throw new BusinessRuleException("لديك طلبات قيد التوصيل — سلّمها أولاً");
            if (active.Count > 0)
                throw new BusinessRuleException("لديك طلبات معيَّنة لك لم تستلمها بعد — استلمها، أو اطلب من العمليات إعادة تعيينها قبل تغيير حالتك");
            if (workStatus == DriverWorkStatus.Offline && _returnTrips != null && await _returnTrips.CountOpenForDriverAsync(driver.Id, ct) > 0)
                throw new BusinessRuleException("معك بضاعة مرتجعة لم تُسلَّم لمتاجرها — أرجعها قبل إنهاء العمل");

            driver.WorkStatus = workStatus;
            driver.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            await Broadcast(driver.Id, workStatus, "work_status");
            return await GetProfileAsync(userId, ct);
        }

        // ===================================
        // الطلبات
        // ===================================
        public async Task<List<DriverOrderDto>> GetOrdersAsync(Guid userId, bool history, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            var since = DateTime.UtcNow.AddDays(-HistoryDays);

            var query = _context.SubOrders
                .AsNoTracking()
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.AttributeValues).ThenInclude(av => av.AttributeValue)
                .Where(so => so.DriverId == driver.Id);

            query = history
                // الفاشل يبقى في السجل بعد أن يستلم المتجر بضاعته (يصبح «ملغى» لكن له FailedAt) — أجرة رفضه قد تكون مع السائق
                ? query.Where(so => (so.Status == OrderStatus.DELIVERED || so.Status == OrderStatus.DELIVERY_FAILED
                        || so.Status == OrderStatus.CANCELLED && so.FailedAt != null) && so.UpdatedAt >= since)
                : query.Where(so => DriverTrip.Statuses.Contains(so.Status));

            var subs = await query.ToListAsync(ct);
            var orderIds = subs.Select(s => s.OrderId).Distinct().ToList();

            // لحساب المبلغ: هل يحمل السائق الطلب كاملاً أم جزءاً منه؟ ونصيب كل جزء من خصم الطلب
            var allSubs = await _context.SubOrders.AsNoTracking()
                .Where(so => orderIds.Contains(so.OrderId) && so.Status != OrderStatus.CANCELLED)
                .Select(so => new { so.Id, so.OrderId })
                .ToListAsync(ct);
            var shares = await DiscountSharesAsync(orderIds, ct);

            var payers = await GetPayersAsync(ct);
            var deliveredAt = history
                ? await _context.OrderStatusLogs.AsNoTracking()
                    .Where(l => l.SubOrderId != null && l.NewStatus == OrderStatus.DELIVERED && orderIds.Contains(l.SubOrder.OrderId))
                    .GroupBy(l => l.SubOrder.OrderId)
                    .Select(g => new { OrderId = g.Key, At = g.Max(l => l.CreatedAt) })
                    .ToDictionaryAsync(x => x.OrderId, x => x.At, ct)
                : new Dictionary<Guid, DateTime>();

            // في السجل: ما قبضه هذا السائق نفسه من الطلب (الموزّع على سائقين لكلٍّ نصيبه)
            var myCash = history
                ? await _context.DriverCashEntries.AsNoTracking()
                    .Where(e => e.DriverId == driver.Id && orderIds.Contains(e.OrderId))
                    .GroupBy(e => e.OrderId).Select(g => new { OrderId = g.Key, Amount = g.Sum(e => e.Amount) })
                    .ToDictionaryAsync(x => x.OrderId, x => x.Amount, ct)
                : new Dictionary<Guid, decimal>();

            return subs
                .GroupBy(s => s.OrderId)
                .Select(g =>
                {
                    var ids = g.Select(s => s.Id).ToHashSet();
                    var dto = MapOrder(g.ToList(), allSubs.Where(a => a.OrderId == g.Key).All(a => ids.Contains(a.Id)), payers, shares);
                    dto.DeliveredAt = deliveredAt.TryGetValue(g.Key, out var at) ? at : null;
                    if (history) dto.CashCollectedAmount = myCash.TryGetValue(g.Key, out var cash) ? cash : null;
                    return dto;
                })
                .OrderByDescending(o => history ? o.DeliveredAt : null)
                .ThenBy(o => o.AssignedAt)
                .ToList();
        }

        public async Task PickUpAsync(Guid userId, Guid subOrderId, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            await using var orderLock = await OrderLock.ForSubOrderAsync(_context, subOrderId, ct);
            var subOrder = await _context.SubOrders.FirstOrDefaultAsync(so => so.Id == subOrderId, ct);
            if (subOrder == null || subOrder.DriverId != driver.Id)
                throw new NotFoundException("الطلب غير موجود");
            if (!DriverTrip.IsOpen(subOrder))
                throw new BusinessRuleException("هذا الطلب ليس قيد التوصيل");

            // الاستلام من المتجر هو ما يجعل الجزء «في الطريق» (التعيين يبقيه «جاهز للاستلام»).
            // حالة الطلب الرئيسي تتبعه، و«في الطريق إليك» يصل الزبون حين يخرج كل ما بقي من طلبه
            if (subOrder.Status == OrderStatus.READY)
            {
                await _ops.MarkPickedUpByDriverAsync(subOrder, userId);
                await Broadcast(driver.Id, driver.WorkStatus, "picked_up");
            }
        }

        public async Task<DriverOrderDto> DeliverAsync(Guid userId, Guid orderId, DriverDeliverDto dto, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            // ضغطة «تم التسليم» مرتين: الثانية تنتظر الأولى فلا تجد ما تسلّمه (لا نقد مكرر)
            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId, ct);
            var mine = await _context.SubOrders
                .Include(so => so.Items)
                .Where(so => so.OrderId == orderId && so.DriverId == driver.Id && DriverTrip.Statuses.Contains(so.Status))
                .ToListAsync(ct);
            if (mine.Count == 0)
                throw new NotFoundException("الطلب غير موجود أو تم تسليمه");

            // التسليم بعد استلام البضاعة من كل متجر — وإلا لا شيء يثبت أن السائق مرّ بالمتجر
            RequirePickedUp(mine);

            var order = await _context.Orders.AsNoTracking().FirstAsync(o => o.Id == orderId, ct);
            var carriesWholeOrder = await CarriesWholeOrderAsync(orderId, mine, ct);
            var shares = await DiscountSharesAsync(new[] { orderId }, ct);

            // ===== الرفض الجزئي: تُخصم قيمة القطع المرفوضة من المبلغ وترجع للمتجر =====
            var refused = ValidateRefusal(mine, dto);
            // القطع المرفوضة تأخذ نصيبها من خصم جزئها (كوبون/نقاط): الزبون يدفع ثمن ما احتفظ به بعد خصمه هو فقط —
            // وإلا يضيف قطعة غالية ليكبر خصم الكوبون ثم يرفضها ويبقى الخصم كله على ما احتفظ به
            var refusedBySub = refused.GroupBy(r => r.Item.SubOrderId).ToDictionary(g => g.Key, g =>
            {
                var sub = mine.First(s => s.Id == g.Key);
                var value = g.Sum(r => r.Item.UnitPrice * r.Quantity);
                var (coupon, points) = OrderTotals.RefusedShare(sub, value);
                return (Sub: sub, Value: value, Coupon: coupon, Points: points);
            });
            var refusedNet = refusedBySub.Values.Sum(x => x.Value - x.Coupon - x.Points);

            var payers = await GetPayersAsync(ct);
            var payer = ForOrder(order, payers).Partial;
            var fee = FeeOf(order, mine, carriesWholeOrder);
            var amount = AmountToCollect(order, mine, carriesWholeOrder, shares);
            if (amount > 0) amount = Math.Max(0, amount - refusedNet - (refused.Count > 0 && payer != RefusalFeePayer.Customer ? fee : 0));

            if (amount > 0 && !dto.CashCollected)
                throw new BusinessRuleException($"أكّد استلام المبلغ ({amount:0.##} د.ع) من الزبون أولاً");

            Return? refusal = null;
            if (refused.Count > 0)
            {
                foreach (var r in refused) r.Item.RefusedQuantity += r.Quantity;
                foreach (var x in refusedBySub.Values)
                {
                    x.Sub.RefusedAmount += x.Value;
                    x.Sub.CouponShare -= x.Coupon;
                    x.Sub.PointsShare -= x.Points;
                }
                // الأجرة على المتجر/المنصة: لا تُحتسب على الزبون لأجزاء هذه التوصيلة (نفس ما طُرح من المبلغ أعلاه)
                if (payer != RefusalFeePayer.Customer)
                    foreach (var m in mine) m.RefusalFeeWaived = true;
                refusal = new Return
                {
                    ReturnNumber = await NextReturnNumberAsync(ct),
                    OrderId = orderId,
                    CustomerId = order.CustomerId,
                    // واقعة حدثت أمام السائق — لا تحتاج مراجعة، والإدارة تعيد القطع للمخزون من صفحة الإرجاعات
                    Status = ReturnStatus.APPROVED,
                    IsDoorRefusal = true,
                    Reason = dto.RefusalReason!,
                    Details = $"رفض عند الاستلام — سجّله السائق {driver.FullName}" + (string.IsNullOrWhiteSpace(dto.RefusalNote) ? "" : $": {dto.RefusalNote.Trim()}"),
                    ReviewedBy = userId,
                    ReviewedAt = DateTime.UtcNow,
                    Items = refused.Select(r => new ReturnItem
                    {
                        ProductId = r.Item.ProductId,
                        VariantId = r.Item.VariantId,
                        ProductName = r.Item.ProductNameAr ?? r.Item.ProductName,
                        Quantity = r.Quantity,
                        UnitPrice = r.Item.UnitPrice,
                    }).ToList(),
                };
                _context.Returns.Add(refusal);
                await _context.SaveChangesAsync(ct);
            }

            await _ops.MarkDeliveredByDriverAsync(orderId, driver.Id, userId);

            // تسجيل النقد، واعتبار الطلب مدفوعاً عند اكتمال تسليمه
            var tracked = await _context.Orders.FirstAsync(o => o.Id == orderId, ct);
            if (refused.Count > 0 && fee > 0)
            {
                tracked.RefusalFeeAmount = fee;
                tracked.RefusalFeePayer = payer;
            }
            if (amount > 0) RecordCash(tracked, driver.Id, amount, DriverCashKind.Delivery);
            var allSubs = await _context.SubOrders.Where(so => so.OrderId == orderId).ToListAsync(ct);
            // خصم القطع المرفوضة خرج من جزئها، والإجمالي يصير ما دفعه الزبون: إجماليات الطلب وسجل الكوبون يتبعانه
            if (refused.Count > 0) OrderTotals.Recalculate(tracked, allSubs);
            var fullyDelivered = allSubs.All(so => so.Status == OrderStatus.CANCELLED || so.Status == OrderStatus.DELIVERED);
            if (fullyDelivered && tracked.PaymentMethod == PaymentMethods.COD)
                tracked.PaymentStatus = PaymentStatus.Paid;
            OrderTotals.SyncPayment(tracked);
            await _context.SaveChangesAsync(ct);
            // نقاط القطع المرفوضة (إن لم يبقَ جزء مفتوح يحملها) تعود للزبون
            if (refused.Count > 0 && _loyalty != null && OrderTotals.UnusedPoints(tracked) > 0)
                await _loyalty.RefundUnusedPointsAsync(orderId);

            if (refusal != null)
            {
                if (_returnTrips != null) await _returnTrips.CreateForRefusalAsync(orderId, driver.Id, refusal.Id, refused, ct);
                await NotifyRefusalAsync(order, refused, refusal, amount);
            }
            if (_finance != null) foreach (var m in mine) await _finance.EnsureSubOrderEntriesAsync(m.Id, ct);
            var after = await _context.Drivers.AsNoTracking().Where(d => d.Id == driver.Id).Select(d => d.WorkStatus).FirstAsync(ct);
            await Broadcast(driver.Id, after, "delivered");
            var mineIds = mine.Select(m => m.Id).ToList();

            var delivered = await _context.SubOrders.AsNoTracking()
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items)
                .Where(so => mineIds.Contains(so.Id))
                .ToListAsync(ct);
            var result = MapOrder(delivered, carriesWholeOrder, payers, shares);
            result.DeliveredAt = DateTime.UtcNow;
            return result;
        }

        // ===================================
        // تعذّر التسليم: رفض كامل / لا يرد / عنوان خاطئ — يرجع الطلب مع السائق وتقرر العمليات (إعادة محاولة أو إلغاء)
        // ===================================
        public async Task<DriverOrderDto> FailAsync(Guid userId, Guid orderId, DriverFailDto dto, CancellationToken ct = default)
        {
            if (!DeliveryFailureReason.All.Contains(dto.Reason))
                throw new BusinessRuleException("اختر سبب تعذّر التسليم");

            var driver = await GetDriverAsync(userId, ct);
            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId, ct);
            var mine = await _context.SubOrders.AsNoTracking()
                .Where(so => so.OrderId == orderId && so.DriverId == driver.Id && DriverTrip.Statuses.Contains(so.Status))
                .ToListAsync(ct);
            if (mine.Count == 0)
                throw new NotFoundException("الطلب غير موجود أو تم إغلاقه");
            // الرفض / لا يرد / عنوان خاطئ تحدث عند الزبون، أي بعد الاستلام. «سبب آخر» قد يسبق الاستلام (مشكلة في المتجر مثلاً)
            if (dto.Reason != DeliveryFailureReason.Other) RequirePickedUp(mine);

            var order = await _context.Orders.AsNoTracking().FirstAsync(o => o.Id == orderId, ct);
            var carriesWholeOrder = await CarriesWholeOrderAsync(orderId, mine, ct);
            var payers = await GetPayersAsync(ct);
            var payer = ForOrder(order, payers).Full;
            var fee = FeeOf(order, mine, carriesWholeOrder);
            var refused = dto.Reason == DeliveryFailureReason.CustomerRefused;

            // الأجرة على الزبون يجمعها السائق فقط إن رفض الزبون وهو حاضر (لا يرد/عنوان خاطئ = لا أحد ليدفع)
            var feeCollected = refused && payer == RefusalFeePayer.Customer && dto.FeeCollected && fee > 0
                && order.PaymentMethod == PaymentMethods.COD;
            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();

            await _ops.MarkFailedByDriverAsync(orderId, driver.Id, userId, dto.Reason, note);

            var tracked = await _context.Orders.FirstAsync(o => o.Id == orderId, ct);
            if (refused && fee > 0)
            {
                tracked.RefusalFeeAmount = fee;
                tracked.RefusalFeePayer = payer;
            }
            if (feeCollected) RecordCash(tracked, driver.Id, fee, DriverCashKind.RefusalFee);
            // لا إعادة محاولة: الجزء الفاشل لا يُحسب على الزبون من الآن — الإجمالي والدفع ونقاطه لا تنتظر استلام المتجر
            var allSubs = await _context.SubOrders.Where(so => so.OrderId == orderId).ToListAsync(ct);
            OrderTotals.Recalculate(tracked, allSubs);
            OrderTotals.SyncPayment(tracked);
            await _context.SaveChangesAsync(ct);
            if (_loyalty != null && OrderTotals.UnusedPoints(tracked) > 0)
                await _loyalty.RefundUnusedPointsAsync(orderId);
            if (_returnTrips != null)
                await _returnTrips.CreateForFailureAsync(orderId, driver.Id, mine.Select(m => m.Id).ToList(), dto.Reason, ct);

            var partial = allSubs.Any(s => OrderTotals.Counts(s));
            await NotifyFailureAsync(order, mine, dto.Reason, note, partial, feeCollected ? fee : 0);
            if (_finance != null) foreach (var m in mine) await _finance.EnsureSubOrderEntriesAsync(m.Id, ct);
            var after = await _context.Drivers.AsNoTracking().Where(d => d.Id == driver.Id).Select(d => d.WorkStatus).FirstAsync(ct);
            await Broadcast(driver.Id, after, "failed");

            var failedIds = mine.Select(m => m.Id).ToList();
            var failed = await _context.SubOrders.AsNoTracking()
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items)
                .Where(so => failedIds.Contains(so.Id))
                .ToListAsync(ct);
            return MapOrder(failed, carriesWholeOrder, payers, await DiscountSharesAsync(new[] { orderId }, ct));
        }

        private async Task NotifyFailureAsync(Order order, List<SubOrder> subs, string reason, string? note, bool partial, decimal feePaid)
        {
            if (_notifications == null) return;
            var text = DeliveryFailureReason.Ar(reason) + (note != null ? $": {note}" : "");
            try
            {
                foreach (var vendorId in subs.Select(s => s.VendorId).Distinct())
                    await _notifications.NotifyVendorAsync(vendorId, NotificationCategory.OrderUpdates, NotificationType.ORDER_STATUS,
                        $"تعذّر تسليم الطلب {order.OrderNumber} ({text}) — يعود مع السائق", new { orderId = order.Id });
                await _notifications.NotifyAdminsAsync(NotificationCategory.NewOrders, NotificationType.ORDER_STATUS,
                    $"تعذّر تسليم الطلب {order.OrderNumber}: {text}", new { orderId = order.Id });
                await _notifications.NotifyOpsAsync(NotificationCategory.NewOrders, NotificationType.ORDER_STATUS,
                    $"تعذّر تسليم الطلب {order.OrderNumber}: {text}", new { orderId = order.Id });
                // طلب متعدد المتاجر سُلّم بعضه: الزبون يعرف ما لم يصله وأنه لا يدفع ثمنه (رسالة الحالة العامة «تم التوصيل» لا تكفي)
                if (partial)
                {
                    var vendorIds = subs.Select(s => s.VendorId).Distinct().ToList();
                    var names = await _context.Vendors.AsNoTracking().Where(v => vendorIds.Contains(v.Id))
                        .Select(v => v.NameAr ?? v.Name).ToListAsync();
                    await _notifications.NotifyCustomerAsync(order.CustomerId,
                        $"لم يُسلَّم جزء طلبك {order.OrderNumber} من {string.Join("، ", names)} ({DeliveryFailureReason.Ar(reason)}) — يعود للمتجر ولا تدفع ثمنه" +
                        (feePaid > 0 ? $"، ودفعت أجرة توصيله {feePaid:N0} د.ع" : ""),
                        new { orderId = order.Id });
                }
            }
            catch { /* الإشعار لا يُفشل العملية */ }
        }

        // ===================================
        // إعدادات التوصيل
        // ===================================
        public async Task<string> GetRefusalFeePayerAsync(CancellationToken ct = default) =>
            (await GetPayersAsync(ct)).Full;

        // (الرفض الكامل، الرفض الجزئي)
        private async Task<(string Full, string Partial)> GetPayersAsync(CancellationToken ct)
        {
            var s = await _context.DeliverySettings.AsNoTracking()
                .Select(x => new { x.RefusalFeePayer, x.PartialRefusalCustomerPays }).FirstOrDefaultAsync(ct);
            var full = s?.RefusalFeePayer ?? RefusalFeePayer.Customer;
            return (full, s?.PartialRefusalCustomerPays == true ? RefusalFeePayer.Customer : full);
        }

        // استثناء العمليات لهذا الطلب يتقدّم على الإعداد العام — للرفض الكامل والجزئي معاً
        private static (string Full, string Partial) ForOrder(Order order, (string Full, string Partial) payers)
            => order.RefusalFeePayerOverride is { } p ? (p, p) : payers;

        // ===================================
        // استثناء أجرة الرفض لطلب واحد (العمليات) — قبل أن يسجّل السائق الرفض فقط:
        // بعده يكون الزبون قد دفع أو لم يدفع نقداً أمام السائق، فالتغيير يصير ردّ مال يدوياً لا استثناءً
        // ===================================
        public async Task<OrderRefusalFeeDto> SetRefusalFeeOverrideAsync(Guid orderId, string? payer, string? reason, Guid userId, CancellationToken ct = default)
        {
            if (payer != null && !RefusalFeePayer.All.Contains(payer))
                throw new BusinessRuleException("اختر من يتحمّل الأجرة");
            var why = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
            if (payer != null && why == null)
                throw new BusinessRuleException("اكتب سبب الاستثناء");
            if (why?.Length > 300)
                throw new BusinessRuleException("السبب طويل — 300 حرف كحد أقصى");

            await using var orderLock = await OrderLock.ForOrderAsync(_context, orderId, ct);
            var order = await _context.Orders.Include(o => o.SubOrders)
                .FirstOrDefaultAsync(o => o.Id == orderId, ct)
                ?? throw new NotFoundException("الطلب غير موجود");
            var open = order.SubOrders.Where(s => s.Status != OrderStatus.DELIVERED && s.Status != OrderStatus.CANCELLED
                && s.Status != OrderStatus.DELIVERY_FAILED).ToList();
            if (open.Count == 0)
                throw new BusinessRuleException("انتهى توصيل هذا الطلب — الاستثناء يُضبط قبل أن يسجّل السائق الرفض");

            var before = order.RefusalFeePayerOverride;
            order.RefusalFeePayerOverride = payer;
            order.RefusalFeeOverrideReason = payer == null ? null : why;
            order.RefusalFeeOverrideBy = payer == null ? null : userId;
            order.RefusalFeeOverrideAt = payer == null ? null : DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);

            // السائق الذي يحمل الطلب يُنبَّه كي لا يطلب الأجرة من الزبون بحسب ما رآه قبل التغيير
            if (before != payer && _notifications != null)
            {
                var full = ForOrder(order, await GetPayersAsync(ct)).Full;
                var driverIds = open.Where(s => s.DriverId != null).Select(s => s.DriverId!.Value).Distinct().ToList();
                var users = await _context.Drivers.AsNoTracking().Where(d => driverIds.Contains(d.Id) && d.UserId != null)
                    .Select(d => d.UserId!.Value).ToListAsync(ct);
                foreach (var u in users)
                {
                    try
                    {
                        await _notifications.NotifyCustomerAsync(u,
                            $"الطلب {order.OrderNumber}: إن رفضه الزبون فأجرة التوصيل على {RefusalFeePayer.Ar(full)}", new { orderId });
                    }
                    catch { /* الإشعار لا يُفشل الحفظ */ }
                }
            }
            return await GetRefusalFeeAsync(orderId, ct);
        }

        public async Task<OrderRefusalFeeDto> GetRefusalFeeAsync(Guid orderId, CancellationToken ct = default)
        {
            var o = await _context.Orders.AsNoTracking().Where(x => x.Id == orderId)
                .Select(x => new { x.RefusalFeePayerOverride, x.RefusalFeeOverrideReason, x.RefusalFeeOverrideAt })
                .FirstOrDefaultAsync(ct) ?? throw new NotFoundException("الطلب غير موجود");
            var (full, partial) = await GetPayersAsync(ct);
            return new OrderRefusalFeeDto
            {
                DefaultFullPayer = full,
                DefaultPartialPayer = partial,
                OverridePayer = o.RefusalFeePayerOverride,
                OverrideReason = o.RefusalFeeOverrideReason,
                OverrideAt = o.RefusalFeeOverrideAt,
            };
        }

        public async Task<DeliverySettingsDto> GetSettingsAsync(CancellationToken ct = default)
        {
            var s = await _context.DeliverySettings.AsNoTracking().FirstOrDefaultAsync(ct);
            return new DeliverySettingsDto
            {
                RefusalFeePayer = s?.RefusalFeePayer ?? RefusalFeePayer.Customer,
                PartialRefusalCustomerPays = s?.PartialRefusalCustomerPays ?? false,
                ReturnPickupFeePayer = s?.ReturnPickupFeePayer ?? RefusalFeePayer.Customer,
                UpdatedAt = s?.UpdatedAt,
            };
        }

        public async Task<DeliverySettingsDto> UpdateSettingsAsync(DeliverySettingsDto dto, Guid userId, CancellationToken ct = default)
        {
            if (!RefusalFeePayer.All.Contains(dto.RefusalFeePayer)
                || (dto.ReturnPickupFeePayer != null && !RefusalFeePayer.All.Contains(dto.ReturnPickupFeePayer)))
                throw new BusinessRuleException("قيمة غير صالحة");
            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.RefusalFeePayer = dto.RefusalFeePayer;
            if (dto.PartialRefusalCustomerPays.HasValue) s.PartialRefusalCustomerPays = dto.PartialRefusalCustomerPays.Value;
            if (dto.ReturnPickupFeePayer != null) s.ReturnPickupFeePayer = dto.ReturnPickupFeePayer;
            s.UpdatedAt = DateTime.UtcNow;
            s.UpdatedBy = userId;
            await _context.SaveChangesAsync(ct);
            return await GetSettingsAsync(ct);
        }

        public async Task<bool> UpdateLocationAsync(Guid userId, DriverLocationUpdateDto dto, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            return await _tracking.UpdateLocationForDriverAsync(driver.Id, dto, ct);
        }

        // ===================================
        // للعمليات: الحساب والنقد
        // ===================================
        public async Task<DriverDto> SetAccountAsync(Guid driverId, string password, CancellationToken ct = default)
        {
            var driver = await _context.Drivers.Include(d => d.User).FirstOrDefaultAsync(d => d.Id == driverId, ct)
                ?? throw new NotFoundException("السائق غير موجود");

            if (driver.User != null)
            {
                // إعادة تعيين كلمة المرور
                driver.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
                driver.User.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var existing = await _context.Users.FirstOrDefaultAsync(u => u.Phone == driver.Phone, ct);
                if (existing != null)
                    throw new BusinessRuleException("رقم هاتف السائق مسجّل بحساب آخر — غيّر رقمه أولاً");

                // يُضاف صراحةً: المعرّف مولَّد مسبقاً فيعدّه EF تعديلاً لو أُضيف عبر الملاحة فقط
                var user = new User
                {
                    Phone = driver.Phone,
                    FullName = driver.FullName,
                    // الإيميل فريد: إن كان مستخدماً لحساب آخر يبقى حساب السائق بلا إيميل
                    Email = await EmailFreeAsync(driver.Email, ct),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    Role = UserRoles.Driver,
                    IsActive = driver.Status == DriverStatus.Active,
                };
                _context.Users.Add(user);
                driver.UserId = user.Id;
            }
            await _context.SaveChangesAsync(ct);

            return new DriverDto
            {
                Id = driver.Id, FullName = driver.FullName, Phone = driver.Phone, Email = driver.Email,
                VehicleType = driver.VehicleType, WorkArea = driver.WorkArea, Status = driver.Status,
                WorkStatus = driver.WorkStatus, Rating = driver.Rating, TotalDeliveries = driver.TotalDeliveries,
                CreatedAt = driver.CreatedAt, HasAccount = true,
            };
        }

        private async Task<string> EmailFreeAsync(string? raw, CancellationToken ct)
        {
            var email = EmailAddress.Normalize(raw);
            if (email.Length == 0) return "";
            var taken = await _context.Users.AnyAsync(u => u.Email != null && u.Email.Trim().ToLower() == email, ct);
            return taken ? "" : email;
        }

        public async Task<DriverCashDto> GetCashAsync(Guid driverId, CancellationToken ct = default)
        {
            if (!await _context.Drivers.AnyAsync(d => d.Id == driverId, ct))
                throw new NotFoundException("السائق غير موجود");
            // ما جمعه هذا السائق نفسه فقط — في الطلب الموزّع على سائقين لكلٍّ نصيبه
            var items = await _context.DriverCashEntries.AsNoTracking()
                .Where(e => e.DriverId == driverId && e.SettledAt == null)
                .GroupBy(e => new { e.OrderId, e.Order.OrderNumber })
                .Select(g => new DriverCashItemDto
                {
                    OrderId = g.Key.OrderId,
                    OrderNumber = g.Key.OrderNumber,
                    Amount = g.Sum(e => e.Amount),
                    CollectedAt = g.Max(e => e.CollectedAt),
                })
                .ToListAsync(ct);
            items = items.Where(i => i.Amount != 0).OrderBy(i => i.CollectedAt).ToList();
            return new DriverCashDto { Items = items, Total = items.Sum(i => i.Amount) };
        }

        // كل السائقين الذين معهم نقد لم يُسلَّم — الأكبر مبلغاً أولاً
        public async Task<List<DriverCashCustodyDto>> GetCashCustodyAsync(CancellationToken ct = default)
        {
            var rows = await _context.DriverCashEntries.AsNoTracking()
                .Where(e => e.SettledAt == null)
                .GroupBy(e => new { e.DriverId, e.Driver.FullName, e.Driver.Phone })
                .Select(g => new DriverCashCustodyDto
                {
                    DriverId = g.Key.DriverId,
                    DriverName = g.Key.FullName,
                    Phone = g.Key.Phone,
                    Total = g.Sum(e => e.Amount),
                    Orders = g.Select(e => e.OrderId).Distinct().Count(),
                    OldestCollectedAt = g.Min(e => e.CollectedAt),
                })
                .ToListAsync(ct);
            return rows.Where(r => r.Total != 0).OrderByDescending(r => r.Total).ToList();
        }

        // السائق يرى تفصيل النقد الذي بعهدته لكل طلب — نفس ما تراه العمليات عند التسوية
        public async Task<DriverCashDto> GetMyCashAsync(Guid userId, CancellationToken ct = default)
            => await GetCashAsync((await GetDriverAsync(userId, ct)).Id, ct);

        // البضاعة المرتجعة التي معه: محطة لكل متجر (المتجر يؤكد الاستلام)
        public async Task<List<ReturnTripDto>> GetMyReturnTripsAsync(Guid userId, bool history = false, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            if (_returnTrips == null) return new();
            return history
                ? await _returnTrips.GetClosedForDriverAsync(driver.Id, 200, ct)
                : await _returnTrips.GetOpenForDriverAsync(driver.Id, ct);
        }

        // مرتجع بعد الاستلام: أخذ القطع من الزبون، أو تعذّر أخذها
        public async Task CollectCustomerReturnAsync(Guid userId, Guid returnId, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            if (_returnTrips != null) await _returnTrips.CollectCustomerReturnAsync(driver.Id, returnId, ct);
        }

        public async Task FailCustomerReturnPickupAsync(Guid userId, Guid returnId, string? note, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            if (_returnTrips != null) await _returnTrips.FailCustomerReturnPickupAsync(driver.Id, returnId, note, ct);
        }

        // الكل أو لا شيء: تُسوّى القيود التي عُرضت على موظف العمليات بالضبط. إن قبض السائق نقداً جديداً
        // والنافذة مفتوحة يتغيّر المجموع فتُرفض التسوية ويُعاد العرض — لا يُسجَّل استلام نقد لم يُعدّ.
        // (قيد يُكتب بعد القراءة أدناه لا يُسوّى، فيبقى معلّقاً للتسوية القادمة)
        public async Task<(int Orders, decimal Amount)> SettleCashAsync(Guid driverId, Guid opsUserId, decimal? expectedAmount = null, CancellationToken ct = default)
        {
            if (!await _context.Drivers.AnyAsync(d => d.Id == driverId, ct))
                throw new NotFoundException("السائق غير موجود");
            if (expectedAmount is not decimal expected)
                throw new BusinessRuleException("أرسل المبلغ الذي استلمته من السائق");
            if (expected <= 0)
                throw new BusinessRuleException("المبلغ المستلم غير صالح");
            // تسويتان متزامنتان (نقرتان، موظفان): الثانية تنتظر فتجد لا شيء — لا إيصالان لنفس النقد
            await using var driverLock = await OrderLock.ForDriverAsync(_context, driverId, ct);
            var entries = await _context.DriverCashEntries
                .Where(e => e.DriverId == driverId && e.SettledAt == null)
                .ToListAsync(ct);
            var amount = entries.Sum(e => e.Amount);
            if (entries.Count == 0 || amount <= 0)
                throw new BusinessRuleException("لا يوجد نقد لدى السائق لتسويته");
            if (expected != amount)
                throw new ConflictException($"تغيّر النقد لدى السائق إلى {amount:N0} د.ع — راجع القائمة وأعد التسوية");
            var now = DateTime.UtcNow;
            foreach (var e in entries)
            {
                e.SettledAt = now;
                e.SettledBy = opsUserId;
            }
            // الطلب «سُلّم نقده» حين لا يبقى من نقده شيء معلّق (طلب موزّع على سائقين ينتظر الاثنين)
            var orderIds = entries.Select(e => e.OrderId).Distinct().ToList();
            var stillOpen = await _context.DriverCashEntries
                .Where(e => orderIds.Contains(e.OrderId) && e.SettledAt == null && e.DriverId != driverId)
                .Select(e => e.OrderId).Distinct().ToListAsync(ct);
            foreach (var order in await _context.Orders.Where(o => orderIds.Contains(o.Id) && !stillOpen.Contains(o.Id)).ToListAsync(ct))
            {
                order.CashSettledAt = now;
                order.CashSettledBy = opsUserId;
            }
            await _context.SaveChangesAsync(ct);
            return (entries.Select(e => e.OrderId).Distinct().Count(), amount);
        }

        // ===================================
        // Helpers
        // ===================================
        private async Task<Driver> GetDriverAsync(Guid userId, CancellationToken ct)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId, ct)
                ?? throw new ForbiddenException("هذا الحساب غير مرتبط بسائق");
            if (driver.Status != DriverStatus.Active)
                throw new ForbiddenException("حساب السائق موقوف — تواصل مع العمليات");
            return driver;
        }

        private static List<(SubOrderItem Item, int Quantity)> ValidateRefusal(List<SubOrder> mine, DriverDeliverDto dto)
        {
            var lines = (dto.RefusedItems ?? new())
                .Where(r => r.Quantity > 0)
                .GroupBy(r => r.SubOrderItemId)
                .Select(g => (Id: g.Key, Quantity: g.Sum(x => x.Quantity)))
                .ToList();
            if (lines.Count == 0) return new();

            if (string.IsNullOrWhiteSpace(dto.RefusalReason) || !ReturnReason.All.Contains(dto.RefusalReason))
                throw new BusinessRuleException("اختر سبب الرفض");

            var items = mine.SelectMany(so => so.Items).ToDictionary(i => i.Id);
            var result = new List<(SubOrderItem, int)>();
            foreach (var (id, qty) in lines)
            {
                if (!items.TryGetValue(id, out var item))
                    throw new BusinessRuleException("قطعة غير موجودة في هذا الطلب");
                if (qty > item.Quantity - item.RefusedQuantity)
                    throw new BusinessRuleException($"الكمية المرفوضة من «{item.ProductNameAr ?? item.ProductName}» أكبر من المطلوبة");
                result.Add((item, qty));
            }

            // رفض كل شيء ليس «تسليماً» — يُعالج مع العمليات
            var remaining = items.Values.Sum(i => i.Quantity - i.RefusedQuantity) - result.Sum(r => r.Item2);
            if (remaining <= 0)
                throw new BusinessRuleException("رفض الزبون الطلب كاملاً — تواصل مع العمليات بدل تسجيل التسليم");
            return result;
        }

        private Task Broadcast(Guid driverId, string workStatus, string reason) =>
            _notifications?.NotifyDriverUpdatedAsync(driverId, workStatus, reason) ?? Task.CompletedTask;

        private Task<string> NextReturnNumberAsync(CancellationToken ct) =>
            DailyNumberGenerator.NextAsync(_context, "RET", _context.Returns.Select(r => r.ReturnNumber), ct);

        private async Task NotifyRefusalAsync(Order order, List<(SubOrderItem Item, int Quantity)> refused, Return refusal, decimal paid)
        {
            if (_notifications == null) return;
            try
            {
                // الزبون: ما رجع مع السائق وما دفعه فعلاً (لا رسالة «تم التوصيل» فقط)
                var all = string.Join("، ", refused.Select(r => $"{r.Item.ProductNameAr ?? r.Item.ProductName} ×{r.Quantity}"));
                await _notifications.NotifyCustomerAsync(order.CustomerId,
                    $"تم توصيل طلبك {order.OrderNumber} — رجع مع السائق: {all}" + (paid > 0 ? $" — المبلغ المدفوع {paid:N0} د.ع" : ""),
                    new { orderId = order.Id, returnId = refusal.Id });
                foreach (var group in refused.GroupBy(r => r.Item.SubOrderId))
                {
                    var vendorId = await _context.SubOrders.Where(s => s.Id == group.Key).Select(s => s.VendorId).FirstAsync();
                    var names = string.Join("، ", group.Select(r => $"{r.Item.ProductNameAr ?? r.Item.ProductName} ×{r.Quantity}"));
                    await _notifications.NotifyVendorAsync(vendorId, NotificationCategory.Returns, NotificationType.RETURN,
                        $"رفض الزبون عند الاستلام ({order.OrderNumber}): {names} — ترجع مع السائق",
                        new { orderId = order.Id, returnId = refusal.Id });
                }
                await _notifications.NotifyAdminsAsync(NotificationCategory.Returns, NotificationType.RETURN,
                    $"رفض جزئي عند الاستلام: {order.OrderNumber} ({refusal.ReturnNumber})", new { returnId = refusal.Id });
            }
            catch { /* الإشعار لا يُفشل التسليم */ }
        }

        private static void RequirePickedUp(IEnumerable<SubOrder> mine)
        {
            if (mine.Any(so => so.PickedUpAt == null))
                throw new BusinessRuleException("سجّل استلام الطلب من كل المتاجر أولاً");
        }

        // نقد بيد هذا السائق: سطر خاص به (للتسوية)، ومجموع الطلب للعرض
        private void RecordCash(Order order, Guid driverId, decimal amount, string kind)
        {
            var now = DateTime.UtcNow;
            _context.DriverCashEntries.Add(new DriverCashEntry { OrderId = order.Id, DriverId = driverId, Amount = amount, Kind = kind, CollectedAt = now });
            order.CashCollectedAmount = (order.CashCollectedAmount ?? 0) + amount;
            order.CashCollectedAt = now;
            order.CashCollectedByDriverId = driverId;
        }

        private async Task<Dictionary<Guid, decimal>> DiscountSharesAsync(IEnumerable<Guid> orderIds, CancellationToken ct)
        {
            var ids = orderIds.Distinct().ToList();
            var orders = await _context.Orders.AsNoTracking()
                .Where(o => ids.Contains(o.Id) && o.DiscountAmount > 0)
                .Include(o => o.SubOrders)
                .ToListAsync(ct);
            return orders.SelectMany(o => OrderTotals.DiscountShares(o, o.SubOrders)).ToDictionary(x => x.Key, x => x.Value);
        }

        private static decimal FeeOf(Order order, IEnumerable<SubOrder> mine, bool carriesWholeOrder) =>
            carriesWholeOrder ? order.DeliveryFees : mine.Sum(s => s.DeliveryFee);

        // يحمل الطلب كاملاً = كل أجزائه غير الملغاة معه في هذه الرحلة. جزء سُلّم في رحلة سابقة (ولو معه هو)
        // أو مع سائق آخر أو تعذّر تسليمه يعني أن ما معه يُحسب بقيمته فقط — وإلا يُطلب إجمالي الطلب مرة ثانية
        private async Task<bool> CarriesWholeOrderAsync(Guid orderId, IEnumerable<SubOrder> mine, CancellationToken ct)
        {
            var ids = mine.Select(m => m.Id).ToList();
            return !await _context.SubOrders
                .AnyAsync(so => so.OrderId == orderId && so.Status != OrderStatus.CANCELLED && !ids.Contains(so.Id), ct);
        }

        // الطلب كاملاً معه: إجمالي الطلب (بعد الخصم). جزء منه فقط: قيمة أجزائه بعد نصيبها من الخصم —
        // فمجموع ما يجمعه السائقون = إجمالي الطلب
        private static decimal AmountToCollect(Order order, IEnumerable<SubOrder> mine, bool carriesWholeOrder, IReadOnlyDictionary<Guid, decimal> shares)
        {
            if (order.PaymentMethod != PaymentMethods.COD || order.PaymentStatus == PaymentStatus.Paid) return 0;
            return carriesWholeOrder ? order.TotalAmount : mine.Sum(s => s.Subtotal + s.DeliveryFee - shares.GetValueOrDefault(s.Id));
        }

        private static DriverOrderDto MapOrder(List<SubOrder> subs, bool carriesWholeOrder, (string Full, string Partial) payers, IReadOnlyDictionary<Guid, decimal> shares)
        {
            var order = subs[0].Order;
            payers = ForOrder(order, payers);
            var a = order.Address;
            var details = a == null ? null : string.Join("، ", new[]
            {
                string.IsNullOrWhiteSpace(a.BuildingNumber) ? null : $"بناية {a.BuildingNumber}",
                string.IsNullOrWhiteSpace(a.FloorNumber) ? null : $"طابق {a.FloorNumber}",
                string.IsNullOrWhiteSpace(a.ApartmentNumber) ? null : $"شقة {a.ApartmentNumber}",
            }.Where(x => x != null));

            // جزء التوصيلة المفتوح (معيَّن أو استلمه): الطلب عند السائق «قيد التوصيل» واستلام كل متجر في Stores
            var pending = subs.Where(DriverTrip.IsOpen).ToList();
            return new DriverOrderDto
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Status = pending.Count > 0 ? OrderStatus.OUT_FOR_DELIVERY
                    : subs.All(s => s.Status == OrderStatus.DELIVERY_FAILED || s.FailedAt != null && s.Status == OrderStatus.CANCELLED)
                        ? OrderStatus.DELIVERY_FAILED : OrderStatus.DELIVERED,
                AllPickedUp = pending.All(s => s.PickedUpAt != null),
                CustomerName = order.Customer?.FullName ?? "—",
                CustomerPhone = string.IsNullOrWhiteSpace(a?.Phone) ? order.Customer?.Phone : a!.Phone,
                Address = a == null ? "—" : string.Join("، ", new[] { a.StreetAddress, a.Area, a.City }.Where(x => !string.IsNullOrWhiteSpace(x))),
                AddressDetails = string.IsNullOrWhiteSpace(details) ? null : details,
                AddressNotes = a?.Notes,
                Latitude = order.DeliveryLatitude ?? a?.Latitude,
                Longitude = order.DeliveryLongitude ?? a?.Longitude,
                ZoneName = order.DeliveryZoneName,
                CustomerNotes = order.CustomerNotes,
                DeliverySlotStart = order.DeliverySlotStart,
                DeliverySlotEnd = order.DeliverySlotEnd,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                AmountToCollect = pending.Count > 0 ? AmountToCollect(order, pending, carriesWholeOrder, shares) : 0,
                DeliveryFee = FeeOf(order, subs, carriesWholeOrder),
                RefusalFeePayer = payers.Full,
                PartialRefusalFeePayer = payers.Partial,
                CashCollectedAmount = order.CashCollectedAmount,
                AssignedAt = subs.Min(s => s.AssignedAt ?? s.UpdatedAt),
                Stores = subs.Select(s => new DriverStopDto
                {
                    SubOrderId = s.Id,
                    SubOrderNumber = s.SubOrderNumber,
                    VendorName = s.Vendor?.NameAr ?? s.Vendor?.Name ?? "—",
                    VendorPhone = s.Vendor?.Phone,
                    VendorAddress = s.Vendor?.Address,
                    ItemsCount = s.Items?.Sum(i => i.Quantity) ?? 0,
                    Status = s.Status,
                    PickedUpAt = s.PickedUpAt,
                    KeptAmount = OrderTotals.Kept(s),
                    CouponShare = s.CouponShare,
                    PointsShare = s.PointsShare,
                    // القطعة التي أزالها المتجر لعدم توفرها (كمية 0) لا تظهر للسائق
                    Items = s.Items?.Where(i => i.Quantity > 0).Select(i => new DriverItemDto
                    {
                        SubOrderItemId = i.Id,
                        Name = i.ProductNameAr ?? i.ProductName,
                        Variant = i.Variant?.AttributeValues == null ? null : string.Join(" · ",
                            i.Variant.AttributeValues.Select(av => av.AttributeValue?.ValueAr ?? av.AttributeValue?.Value).Where(v => !string.IsNullOrWhiteSpace(v))) is { Length: > 0 } v ? v : null,
                        ImageUrl = i.ProductImageUrl,
                        Quantity = i.Quantity,
                        RefusedQuantity = i.RefusedQuantity,
                        UnitPrice = i.UnitPrice,
                    }).ToList() ?? new(),
                }).ToList(),
            };
        }
    }
}
