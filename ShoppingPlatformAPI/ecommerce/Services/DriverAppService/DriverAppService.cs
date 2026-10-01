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
        Task UpdateLocationAsync(Guid userId, DriverLocationUpdateDto dto, CancellationToken ct = default);

        // للعمليات
        Task<DriverDto> SetAccountAsync(Guid driverId, string password, CancellationToken ct = default);
        Task<DriverCashDto> GetCashAsync(Guid driverId, CancellationToken ct = default);
        Task<int> SettleCashAsync(Guid driverId, Guid opsUserId, CancellationToken ct = default);
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

        public DriverAppService(AppDbContext context, IOpsService ops, IDriverTrackingService tracking, INotificationService? notifications = null,
            ecommerce.Services.FinanceService.IFinanceService? finance = null)
        {
            _finance = finance;
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
            var todayUtc = DateTime.UtcNow.Date;

            var activeOrders = await _context.SubOrders
                .Where(so => so.DriverId == driver.Id && so.Status == OrderStatus.OUT_FOR_DELIVERY)
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

            var cash = await _context.Orders
                .Where(o => o.CashCollectedByDriverId == driver.Id && o.CashSettledAt == null)
                .SumAsync(o => o.CashCollectedAmount ?? 0, ct);

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
                LastLocationAt = driver.LastLocationAt,
            };
        }

        public async Task<DriverProfileDto> SetWorkStatusAsync(Guid userId, string workStatus, CancellationToken ct = default)
        {
            if (!SelfStatuses.Contains(workStatus))
                throw new BusinessRuleException("حالة غير صالحة");

            var driver = await GetDriverAsync(userId, ct);
            var hasActive = await _context.SubOrders
                .AnyAsync(so => so.DriverId == driver.Id && so.Status == OrderStatus.OUT_FOR_DELIVERY, ct);
            if (hasActive)
                throw new BusinessRuleException("لديك طلبات قيد التوصيل — سلّمها أولاً");

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
                ? query.Where(so => (so.Status == OrderStatus.DELIVERED || so.Status == OrderStatus.DELIVERY_FAILED) && so.UpdatedAt >= since)
                : query.Where(so => so.Status == OrderStatus.OUT_FOR_DELIVERY);

            var subs = await query.ToListAsync(ct);
            var orderIds = subs.Select(s => s.OrderId).Distinct().ToList();

            // لحساب المبلغ: هل يحمل السائق الطلب كاملاً أم جزءاً منه؟
            var allSubs = await _context.SubOrders.AsNoTracking()
                .Where(so => orderIds.Contains(so.OrderId) && so.Status != OrderStatus.CANCELLED)
                .Select(so => new { so.OrderId, so.DriverId })
                .ToListAsync(ct);

            var payers = await GetPayersAsync(ct);
            var deliveredAt = history
                ? await _context.OrderStatusLogs.AsNoTracking()
                    .Where(l => l.SubOrderId != null && l.NewStatus == OrderStatus.DELIVERED && orderIds.Contains(l.SubOrder.OrderId))
                    .GroupBy(l => l.SubOrder.OrderId)
                    .Select(g => new { OrderId = g.Key, At = g.Max(l => l.CreatedAt) })
                    .ToDictionaryAsync(x => x.OrderId, x => x.At, ct)
                : new Dictionary<Guid, DateTime>();

            return subs
                .GroupBy(s => s.OrderId)
                .Select(g =>
                {
                    var dto = MapOrder(g.ToList(), allSubs.Where(a => a.OrderId == g.Key).All(a => a.DriverId == driver.Id), payers);
                    dto.DeliveredAt = deliveredAt.TryGetValue(g.Key, out var at) ? at : null;
                    return dto;
                })
                .OrderByDescending(o => history ? o.DeliveredAt : null)
                .ThenBy(o => o.AssignedAt)
                .ToList();
        }

        public async Task PickUpAsync(Guid userId, Guid subOrderId, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            var subOrder = await _context.SubOrders.FirstOrDefaultAsync(so => so.Id == subOrderId, ct);
            if (subOrder == null || subOrder.DriverId != driver.Id)
                throw new NotFoundException("الطلب غير موجود");
            if (subOrder.Status != OrderStatus.OUT_FOR_DELIVERY)
                throw new BusinessRuleException("هذا الطلب ليس قيد التوصيل");

            if (subOrder.PickedUpAt == null)
            {
                subOrder.PickedUpAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
                await Broadcast(driver.Id, driver.WorkStatus, "picked_up");
            }
        }

        public async Task<DriverOrderDto> DeliverAsync(Guid userId, Guid orderId, DriverDeliverDto dto, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            var mine = await _context.SubOrders
                .Include(so => so.Items)
                .Where(so => so.OrderId == orderId && so.DriverId == driver.Id && so.Status == OrderStatus.OUT_FOR_DELIVERY)
                .ToListAsync(ct);
            if (mine.Count == 0)
                throw new NotFoundException("الطلب غير موجود أو تم تسليمه");

            var order = await _context.Orders.AsNoTracking().FirstAsync(o => o.Id == orderId, ct);
            var carriesWholeOrder = !await _context.SubOrders
                .AnyAsync(so => so.OrderId == orderId && so.Status != OrderStatus.CANCELLED && so.DriverId != driver.Id, ct);

            // ===== الرفض الجزئي: تُخصم قيمة القطع المرفوضة من المبلغ وترجع للمتجر =====
            var refused = ValidateRefusal(mine, dto);
            var refusedValue = refused.Sum(r => r.Item.UnitPrice * r.Quantity);

            var payers = await GetPayersAsync(ct);
            var payer = payers.Partial;
            var fee = FeeOf(order, mine, carriesWholeOrder);
            var amount = AmountToCollect(order, mine, carriesWholeOrder);
            if (amount > 0) amount = Math.Max(0, amount - refusedValue - (refused.Count > 0 && payer != RefusalFeePayer.Customer ? fee : 0));

            if (amount > 0 && !dto.CashCollected)
                throw new BusinessRuleException($"أكّد استلام المبلغ ({amount:0.##} د.ع) من الزبون أولاً");

            Return? refusal = null;
            if (refused.Count > 0)
            {
                foreach (var r in refused) r.Item.RefusedQuantity += r.Quantity;
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
            if (amount > 0)
            {
                tracked.CashCollectedAmount = (tracked.CashCollectedAmount ?? 0) + amount;
                tracked.CashCollectedAt = DateTime.UtcNow;
                tracked.CashCollectedByDriverId = driver.Id;
                tracked.CashSettledAt = null;
            }
            var fullyDelivered = !await _context.SubOrders.AnyAsync(so => so.OrderId == orderId
                && so.Status != OrderStatus.CANCELLED && so.Status != OrderStatus.DELIVERED, ct);
            if (fullyDelivered && tracked.PaymentMethod == PaymentMethods.COD)
                tracked.PaymentStatus = PaymentStatus.Paid;
            await _context.SaveChangesAsync(ct);

            if (refusal != null) await NotifyRefusalAsync(order, refused, refusal);
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
            var result = MapOrder(delivered, carriesWholeOrder, payers);
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
            var mine = await _context.SubOrders.AsNoTracking()
                .Where(so => so.OrderId == orderId && so.DriverId == driver.Id && so.Status == OrderStatus.OUT_FOR_DELIVERY)
                .ToListAsync(ct);
            if (mine.Count == 0)
                throw new NotFoundException("الطلب غير موجود أو تم إغلاقه");

            var order = await _context.Orders.AsNoTracking().FirstAsync(o => o.Id == orderId, ct);
            var carriesWholeOrder = !await _context.SubOrders
                .AnyAsync(so => so.OrderId == orderId && so.Status != OrderStatus.CANCELLED && so.DriverId != driver.Id, ct);
            var payers = await GetPayersAsync(ct);
            var payer = payers.Full;
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
            if (feeCollected)
            {
                tracked.CashCollectedAmount = (tracked.CashCollectedAmount ?? 0) + fee;
                tracked.CashCollectedAt = DateTime.UtcNow;
                tracked.CashCollectedByDriverId = driver.Id;
                tracked.CashSettledAt = null;
            }
            await _context.SaveChangesAsync(ct);

            await NotifyFailureAsync(order, mine, dto.Reason, note);
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
            return MapOrder(failed, carriesWholeOrder, payers);
        }

        private async Task NotifyFailureAsync(Order order, List<SubOrder> subs, string reason, string? note)
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

        public async Task<DeliverySettingsDto> GetSettingsAsync(CancellationToken ct = default)
        {
            var s = await _context.DeliverySettings.AsNoTracking().FirstOrDefaultAsync(ct);
            return new DeliverySettingsDto
            {
                RefusalFeePayer = s?.RefusalFeePayer ?? RefusalFeePayer.Customer,
                PartialRefusalCustomerPays = s?.PartialRefusalCustomerPays ?? false,
                UpdatedAt = s?.UpdatedAt,
            };
        }

        public async Task<DeliverySettingsDto> UpdateSettingsAsync(DeliverySettingsDto dto, Guid userId, CancellationToken ct = default)
        {
            if (!RefusalFeePayer.All.Contains(dto.RefusalFeePayer))
                throw new BusinessRuleException("قيمة غير صالحة");
            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.RefusalFeePayer = dto.RefusalFeePayer;
            if (dto.PartialRefusalCustomerPays.HasValue) s.PartialRefusalCustomerPays = dto.PartialRefusalCustomerPays.Value;
            s.UpdatedAt = DateTime.UtcNow;
            s.UpdatedBy = userId;
            await _context.SaveChangesAsync(ct);
            return await GetSettingsAsync(ct);
        }

        public async Task UpdateLocationAsync(Guid userId, DriverLocationUpdateDto dto, CancellationToken ct = default)
        {
            var driver = await GetDriverAsync(userId, ct);
            await _tracking.UpdateLocationForDriverAsync(driver.Id, dto, ct);
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
            var items = await _context.Orders.AsNoTracking()
                .Where(o => o.CashCollectedByDriverId == driverId && o.CashSettledAt == null && o.CashCollectedAmount > 0)
                .OrderBy(o => o.CashCollectedAt)
                .Select(o => new DriverCashItemDto
                {
                    OrderId = o.Id,
                    OrderNumber = o.OrderNumber,
                    Amount = o.CashCollectedAmount ?? 0,
                    CollectedAt = o.CashCollectedAt ?? o.UpdatedAt,
                })
                .ToListAsync(ct);
            return new DriverCashDto { Items = items, Total = items.Sum(i => i.Amount) };
        }

        public async Task<int> SettleCashAsync(Guid driverId, Guid opsUserId, CancellationToken ct = default)
        {
            var orders = await _context.Orders
                .Where(o => o.CashCollectedByDriverId == driverId && o.CashSettledAt == null && o.CashCollectedAmount > 0)
                .ToListAsync(ct);
            var now = DateTime.UtcNow;
            foreach (var o in orders)
            {
                o.CashSettledAt = now;
                o.CashSettledBy = opsUserId;
            }
            await _context.SaveChangesAsync(ct);
            return orders.Count;
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

        private async Task<string> NextReturnNumberAsync(CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;
            var count = await _context.Returns.CountAsync(r => r.CreatedAt >= today, ct);
            return $"RET-{today:yyyyMMdd}-{count + 1:D4}";
        }

        private async Task NotifyRefusalAsync(Order order, List<(SubOrderItem Item, int Quantity)> refused, Return refusal)
        {
            if (_notifications == null) return;
            try
            {
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

        private static decimal FeeOf(Order order, IEnumerable<SubOrder> mine, bool carriesWholeOrder) =>
            carriesWholeOrder ? order.DeliveryFees : mine.Sum(s => s.DeliveryFee);

        // الطلب كاملاً معه: إجمالي الطلب (بعد الخصم). جزء منه فقط: قيمة أجزائه
        private static decimal AmountToCollect(Order order, IEnumerable<SubOrder> mine, bool carriesWholeOrder)
        {
            if (order.PaymentMethod != PaymentMethods.COD || order.PaymentStatus == PaymentStatus.Paid) return 0;
            return carriesWholeOrder ? order.TotalAmount : mine.Sum(s => s.Subtotal + s.DeliveryFee);
        }

        private static DriverOrderDto MapOrder(List<SubOrder> subs, bool carriesWholeOrder, (string Full, string Partial) payers)
        {
            var order = subs[0].Order;
            var a = order.Address;
            var details = a == null ? null : string.Join("، ", new[]
            {
                string.IsNullOrWhiteSpace(a.BuildingNumber) ? null : $"بناية {a.BuildingNumber}",
                string.IsNullOrWhiteSpace(a.FloorNumber) ? null : $"طابق {a.FloorNumber}",
                string.IsNullOrWhiteSpace(a.ApartmentNumber) ? null : $"شقة {a.ApartmentNumber}",
            }.Where(x => x != null));

            var pending = subs.Where(s => s.Status == OrderStatus.OUT_FOR_DELIVERY).ToList();
            return new DriverOrderDto
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Status = pending.Count > 0 ? OrderStatus.OUT_FOR_DELIVERY
                    : subs.All(s => s.Status == OrderStatus.DELIVERY_FAILED) ? OrderStatus.DELIVERY_FAILED : OrderStatus.DELIVERED,
                CustomerName = order.Customer?.FullName ?? "—",
                CustomerPhone = string.IsNullOrWhiteSpace(a?.Phone) ? order.Customer?.Phone : a!.Phone,
                Address = a == null ? "—" : string.Join("، ", new[] { a.StreetAddress, a.Area, a.City }.Where(x => !string.IsNullOrWhiteSpace(x))),
                AddressDetails = string.IsNullOrWhiteSpace(details) ? null : details,
                AddressNotes = a?.Notes,
                Latitude = order.DeliveryLatitude ?? a?.Latitude,
                Longitude = order.DeliveryLongitude ?? a?.Longitude,
                CustomerNotes = order.CustomerNotes,
                PaymentMethod = order.PaymentMethod,
                PaymentStatus = order.PaymentStatus,
                AmountToCollect = pending.Count > 0 ? AmountToCollect(order, pending, carriesWholeOrder) : 0,
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
                    Items = s.Items?.Select(i => new DriverItemDto
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
