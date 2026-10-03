using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.FinanceService
{
    public static class LedgerType
    {
        public const string Sale = "SALE";                       // + قيمة القطع المُسلَّمة
        public const string Commission = "COMMISSION";           // − عمولة المنصة
        public const string VendorCoupon = "VENDOR_COUPON";       // − كوبون خاص بالمتجر
        public const string RefusalFee = "REFUSAL_FEE";           // − أجرة توصيل على المتجر عند الرفض
        public const string Return = "RETURN";                    // − قطع أُرجعت بعد الاستلام
        public const string ReturnCommission = "RETURN_COMMISSION"; // + العمولة عن القطع المُرجعة
        public const string Payout = "PAYOUT";                    // − ما حوّلته الإدارة للمتجر
        public const string Adjustment = "ADJUSTMENT";            // ± تسوية يدوية

        public static string Ar(string t) => t switch
        {
            Sale => "مبيعات",
            Commission => "عمولة المنصة",
            VendorCoupon => "كوبون المتجر",
            RefusalFee => "أجرة توصيل (رفض)",
            Return => "إرجاع",
            ReturnCommission => "استرداد عمولة",
            Payout => "دفعة للمتجر",
            Adjustment => "تسوية",
            _ => t,
        };
    }

    public static class CommissionType
    {
        public const string Percentage = "PERCENTAGE";   // نسبة من قيمة المنتجات
        public const string Fixed = "FIXED";             // مبلغ ثابت عن كل طلب مُسلَّم
    }

    // ===== DTOs =====
    public class CommissionDto
    {
        public string Type { get; set; } = CommissionType.Percentage;
        public decimal Value { get; set; }
        public bool IsDefault { get; set; }     // يتبع الإعداد العام
    }

    public class VendorBalanceDto
    {
        public Guid VendorId { get; set; }
        public string VendorName { get; set; } = "";
        public decimal Sales { get; set; }
        public decimal Commission { get; set; }      // صافي (بعد استرداد عمولة المرتجعات)
        public decimal Deductions { get; set; }      // كوبونات + أجرة رفض + مرتجعات + تسويات سالبة
        public decimal Payouts { get; set; }
        public decimal Balance { get; set; }         // ما تدين به المنصة للمتجر الآن
        public DateTime? LastPayoutAt { get; set; }
        public CommissionDto CommissionRule { get; set; } = new();   // قاعدة العمولة الحالية
    }

    public class LedgerEntryDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; } = "";
        public string TypeAr { get; set; } = "";
        public decimal Amount { get; set; }
        public decimal RunningBalance { get; set; }
        public string? OrderNumber { get; set; }
        public Guid? OrderId { get; set; }
        public string? Description { get; set; }
        public string? Reference { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class VendorStatementDto
    {
        public VendorBalanceDto Summary { get; set; } = new();
        public List<LedgerEntryDto> Entries { get; set; } = new();   // الأحدث أولاً
    }

    public interface IFinanceService
    {
        Task EnsureSubOrderEntriesAsync(Guid subOrderId, CancellationToken ct = default);
        Task EnsureReturnEntriesAsync(Guid returnId, CancellationToken ct = default);
        Task<int> BackfillAsync(CancellationToken ct = default);

        Task<List<VendorBalanceDto>> GetBalancesAsync(CancellationToken ct = default);
        Task<VendorStatementDto> GetStatementAsync(Guid vendorId, int take = 500, CancellationToken ct = default);
        Task<LedgerEntryDto> RecordPayoutAsync(Guid vendorId, decimal amount, string? reference, string? note, Guid adminId, CancellationToken ct = default);
        Task<LedgerEntryDto> RecordAdjustmentAsync(Guid vendorId, decimal amount, string note, Guid adminId, CancellationToken ct = default);

        Task<CommissionDto> GetDefaultCommissionAsync(CancellationToken ct = default);
        Task<CommissionDto> SetDefaultCommissionAsync(CommissionDto dto, Guid adminId, CancellationToken ct = default);
        Task<CommissionDto> SetVendorCommissionAsync(Guid vendorId, CommissionDto? dto, CancellationToken ct = default);
    }

    public class FinanceService : IFinanceService
    {
        private readonly AppDbContext _context;

        public FinanceService(AppDbContext context) => _context = context;

        private static decimal Money(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);   // الدينار بلا كسور

        // ===================================
        // العمولة
        // ===================================
        public async Task<CommissionDto> GetDefaultCommissionAsync(CancellationToken ct = default)
        {
            var s = await _context.DeliverySettings.AsNoTracking().FirstOrDefaultAsync(ct);
            return new CommissionDto
            {
                Type = s?.DefaultCommissionType ?? CommissionType.Percentage,
                Value = s?.DefaultCommissionValue ?? 0,
                IsDefault = true,
            };
        }

        public async Task<CommissionDto> SetDefaultCommissionAsync(CommissionDto dto, Guid adminId, CancellationToken ct = default)
        {
            Validate(dto);
            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.DefaultCommissionType = dto.Type;
            s.DefaultCommissionValue = dto.Value;
            s.UpdatedAt = DateTime.UtcNow;
            s.UpdatedBy = adminId;
            await _context.SaveChangesAsync(ct);
            return await GetDefaultCommissionAsync(ct);
        }

        // null = يعود للإعداد العام
        public async Task<CommissionDto> SetVendorCommissionAsync(Guid vendorId, CommissionDto? dto, CancellationToken ct = default)
        {
            var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.Id == vendorId, ct)
                ?? throw new NotFoundException("المتجر غير موجود");
            if (dto != null) Validate(dto);
            vendor.CommissionType = dto?.Type;
            vendor.CommissionValue = dto?.Value;
            await _context.SaveChangesAsync(ct);
            return await CommissionForAsync(vendor, ct);
        }

        private static void Validate(CommissionDto dto)
        {
            if (dto.Type == CommissionType.Percentage && (dto.Value < 0 || dto.Value > 100))
                throw new BusinessRuleException("النسبة بين 0 و100");
            if (dto.Type == CommissionType.Fixed && (dto.Value < 0 || dto.Value > 10_000_000))
                throw new BusinessRuleException("المبلغ الثابت غير صالح");
            if (dto.Type != CommissionType.Percentage && dto.Type != CommissionType.Fixed)
                throw new BusinessRuleException("نوع العمولة غير صالح");
        }

        private async Task<CommissionDto> CommissionForAsync(Vendor vendor, CancellationToken ct) =>
            vendor.CommissionType != null && vendor.CommissionValue != null
                ? new CommissionDto { Type = vendor.CommissionType, Value = vendor.CommissionValue.Value, IsDefault = false }
                : await GetDefaultCommissionAsync(ct);

        private static decimal CommissionOn(CommissionDto c, decimal sale) =>
            sale <= 0 ? 0 : c.Type == CommissionType.Fixed ? Math.Min(c.Value, sale) : Money(sale * c.Value / 100m);

        private static string CommissionLabel(CommissionDto c) =>
            c.Type == CommissionType.Fixed ? $"{c.Value:0.##} د.ع عن الطلب" : $"{c.Value:0.##}%";

        // ===================================
        // الحركات التلقائية — كل نوع مرة واحدة (فهرس فريد يمنع التكرار)
        // ===================================
        public async Task EnsureSubOrderEntriesAsync(Guid subOrderId, CancellationToken ct = default)
        {
            var sub = await _context.SubOrders
                .Include(s => s.Items)
                .Include(s => s.Order)
                .Include(s => s.Vendor)
                .FirstOrDefaultAsync(s => s.Id == subOrderId, ct);
            if (sub?.Order == null || sub.Vendor == null) return;

            var existing = await _context.VendorLedgerEntries
                .Where(e => e.SubOrderId == subOrderId && e.ReturnId == null)
                .Select(e => e.Type).ToListAsync(ct);
            var order = sub.Order;
            var label = $"طلب {order.OrderNumber}";
            var add = new List<VendorLedgerEntry>();

            void Add(string type, decimal amount, string? description = null)
            {
                if (existing.Contains(type) || amount == 0) return;
                add.Add(new VendorLedgerEntry
                {
                    VendorId = sub.VendorId, Type = type, Amount = Money(amount),
                    OrderId = order.Id, SubOrderId = sub.Id, Description = description ?? label,
                });
            }

            if (sub.Status == OrderStatus.DELIVERED)
            {
                // القطع المرفوضة عند الباب لا تُحسب مبيعات
                var sale = sub.Items?.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity)) ?? sub.Subtotal;
                var commission = await CommissionForAsync(sub.Vendor, ct);
                Add(LedgerType.Sale, sale);
                Add(LedgerType.Commission, -CommissionOn(commission, sale), $"{label} — عمولة {CommissionLabel(commission)}");

                // كوبون خاص بهذا المتجر = خصم على المتجر (الكوبون العام والنقاط على المنصة)
                if (!string.IsNullOrEmpty(order.CouponCode) && order.DiscountAmount > 0)
                {
                    var couponVendor = await _context.Coupons.AsNoTracking()
                        .Where(c => c.Code == order.CouponCode).Select(c => c.VendorId).FirstOrDefaultAsync(ct);
                    if (couponVendor == sub.VendorId)
                        Add(LedgerType.VendorCoupon, -Math.Min(order.DiscountAmount, sale), $"{label} — كوبون {order.CouponCode}");
                }

                // رفض جزئي والأجرة على المتجر
                if (order.RefusalFeePayer == RefusalFeePayer.Vendor && sub.Items?.Any(i => i.RefusedQuantity > 0) == true)
                    Add(LedgerType.RefusalFee, -sub.DeliveryFee, $"{label} — أجرة توصيل (رفض جزئي)");
            }
            else if (sub.Status == OrderStatus.DELIVERY_FAILED && sub.FailureReason == DeliveryFailureReason.CustomerRefused
                     && order.RefusalFeePayer == RefusalFeePayer.Vendor)
            {
                Add(LedgerType.RefusalFee, -sub.DeliveryFee, $"{label} — أجرة توصيل (رفض كامل)");
            }

            await SaveAsync(add, ct);
        }

        // إرجاع بعد الاستلام (موافق عليه): تُخصم قيمته من متجر كل قطعة وتُستردّ عمولتها بنفس نسبة الطلب
        public async Task EnsureReturnEntriesAsync(Guid returnId, CancellationToken ct = default)
        {
            var ret = await _context.Returns.Include(r => r.Items).Include(r => r.Order)
                .FirstOrDefaultAsync(r => r.Id == returnId, ct);
            if (ret == null || ret.IsDoorRefusal) return;   // الرفض عند الباب مستثنى من المبيعات أصلاً
            if (ret.Status != ReturnStatus.APPROVED && ret.Status != ReturnStatus.COMPLETED) return;

            var productIds = ret.Items.Select(i => i.ProductId).Distinct().ToList();
            var vendorOf = await _context.Products.AsNoTracking().Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.VendorId, ct);

            var existing = await _context.VendorLedgerEntries.Where(e => e.ReturnId == returnId)
                .Select(e => new { e.VendorId, e.Type }).ToListAsync(ct);
            var add = new List<VendorLedgerEntry>();

            foreach (var g in ret.Items.Where(i => vendorOf.ContainsKey(i.ProductId)).GroupBy(i => vendorOf[i.ProductId]))
            {
                var value = g.Sum(i => i.UnitPrice * i.Quantity);
                var sub = await _context.SubOrders.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.OrderId == ret.OrderId && s.VendorId == g.Key, ct);
                var label = $"إرجاع {ret.ReturnNumber} — طلب {ret.Order?.OrderNumber}";

                if (!existing.Any(e => e.VendorId == g.Key && e.Type == LedgerType.Return))
                    add.Add(new VendorLedgerEntry { VendorId = g.Key, Type = LedgerType.Return, Amount = -Money(value), OrderId = ret.OrderId, SubOrderId = sub?.Id, ReturnId = ret.Id, Description = label });

                // العمولة المُستردّة بنسبة ما أُخذ فعلاً على هذا الطلب
                if (sub != null && !existing.Any(e => e.VendorId == g.Key && e.Type == LedgerType.ReturnCommission))
                {
                    var taken = await _context.VendorLedgerEntries.AsNoTracking()
                        .Where(e => e.SubOrderId == sub.Id && e.ReturnId == null && (e.Type == LedgerType.Sale || e.Type == LedgerType.Commission))
                        .Select(e => new { e.Type, e.Amount }).ToListAsync(ct);
                    var sale = taken.Where(t => t.Type == LedgerType.Sale).Sum(t => t.Amount);
                    var commission = -taken.Where(t => t.Type == LedgerType.Commission).Sum(t => t.Amount);
                    var refund = sale > 0 ? Money(commission * Math.Min(1, value / sale)) : 0;
                    if (refund > 0)
                        add.Add(new VendorLedgerEntry { VendorId = g.Key, Type = LedgerType.ReturnCommission, Amount = refund, OrderId = ret.OrderId, SubOrderId = sub.Id, ReturnId = ret.Id, Description = label });
                }
            }
            await SaveAsync(add, ct);
        }

        private async Task SaveAsync(List<VendorLedgerEntry> add, CancellationToken ct)
        {
            if (add.Count == 0) return;
            _context.VendorLedgerEntries.AddRange(add);
            try { await _context.SaveChangesAsync(ct); }
            catch (DbUpdateException)
            {
                // سُجّلت بالتوازي من مكان آخر — الفهرس الفريد منع التكرار
                foreach (var e in add) _context.Entry(e).State = EntityState.Detached;
            }
        }

        // احتساب كل الطلبات السابقة بالقواعد نفسها (آمن للتكرار)
        public async Task<int> BackfillAsync(CancellationToken ct = default)
        {
            var subs = await _context.SubOrders.AsNoTracking()
                .Where(s => s.Status == OrderStatus.DELIVERED || s.Status == OrderStatus.DELIVERY_FAILED)
                .Select(s => s.Id).ToListAsync(ct);
            foreach (var id in subs) await EnsureSubOrderEntriesAsync(id, ct);

            var returns = await _context.Returns.AsNoTracking()
                .Where(r => !r.IsDoorRefusal && (r.Status == ReturnStatus.APPROVED || r.Status == ReturnStatus.COMPLETED))
                .Select(r => r.Id).ToListAsync(ct);
            foreach (var id in returns) await EnsureReturnEntriesAsync(id, ct);
            return subs.Count + returns.Count;
        }

        // ===================================
        // الأرصدة والكشوف
        // ===================================
        public async Task<List<VendorBalanceDto>> GetBalancesAsync(CancellationToken ct = default)
        {
            var vendors = await _context.Vendors.AsNoTracking().ToListAsync(ct);
            var sums = await _context.VendorLedgerEntries.AsNoTracking()
                .GroupBy(e => new { e.VendorId, e.Type })
                .Select(g => new { g.Key.VendorId, g.Key.Type, Sum = g.Sum(e => e.Amount) })
                .ToListAsync(ct);
            var lastPayout = await _context.VendorLedgerEntries.AsNoTracking()
                .Where(e => e.Type == LedgerType.Payout)
                .GroupBy(e => e.VendorId).Select(g => new { VendorId = g.Key, At = g.Max(e => e.CreatedAt) })
                .ToDictionaryAsync(x => x.VendorId, x => x.At, ct);
            var defaults = await GetDefaultCommissionAsync(ct);

            return vendors.Select(v =>
            {
                decimal S(string t) => sums.Where(x => x.VendorId == v.Id && x.Type == t).Sum(x => x.Sum);
                var adjustments = S(LedgerType.Adjustment);
                return new VendorBalanceDto
                {
                    VendorId = v.Id,
                    VendorName = v.NameAr ?? v.Name,
                    Sales = S(LedgerType.Sale),
                    Commission = -(S(LedgerType.Commission) + S(LedgerType.ReturnCommission)),
                    Deductions = -(S(LedgerType.VendorCoupon) + S(LedgerType.RefusalFee) + S(LedgerType.Return) + Math.Min(0, adjustments)),
                    Payouts = -S(LedgerType.Payout),
                    Balance = sums.Where(x => x.VendorId == v.Id).Sum(x => x.Sum),
                    LastPayoutAt = lastPayout.TryGetValue(v.Id, out var at) ? at : null,
                    CommissionRule = v.CommissionType != null && v.CommissionValue != null
                        ? new CommissionDto { Type = v.CommissionType, Value = v.CommissionValue.Value }
                        : defaults,
                };
            }).OrderByDescending(b => b.Balance).ToList();
        }

        public async Task<VendorStatementDto> GetStatementAsync(Guid vendorId, int take = 500, CancellationToken ct = default)
        {
            var summary = (await GetBalancesAsync(ct)).FirstOrDefault(b => b.VendorId == vendorId)
                ?? throw new NotFoundException("المتجر غير موجود");

            var entries = await _context.VendorLedgerEntries.AsNoTracking()
                .Where(e => e.VendorId == vendorId)
                // الحركات المسجّلة في نفس اللحظة (بيع الطلب وعمولته) تُرتَّب بتسلسلها المنطقي لا عشوائياً،
                // فيبقى الرصيد الجاري صحيحاً، وبعد العكس تظهر الأحدث أولاً حتى داخل الطلب الواحد
                .OrderBy(e => e.CreatedAt)
                .ThenBy(e => e.Type == LedgerType.Sale ? 0
                           : e.Type == LedgerType.Commission ? 1
                           : e.Type == LedgerType.VendorCoupon ? 2
                           : e.Type == LedgerType.RefusalFee ? 3
                           : e.Type == LedgerType.Return ? 4
                           : e.Type == LedgerType.ReturnCommission ? 5 : 6)
                .ThenBy(e => e.Id)
                .Select(e => new { e, OrderNumber = e.OrderId == null ? null : _context.Orders.Where(o => o.Id == e.OrderId).Select(o => o.OrderNumber).FirstOrDefault() })
                .ToListAsync(ct);

            decimal running = 0;
            var list = entries.Select(x =>
            {
                running += x.e.Amount;
                return new LedgerEntryDto
                {
                    Id = x.e.Id, Type = x.e.Type, TypeAr = LedgerType.Ar(x.e.Type), Amount = x.e.Amount,
                    RunningBalance = running, OrderId = x.e.OrderId, OrderNumber = x.OrderNumber,
                    Description = x.e.Description, Reference = x.e.Reference, CreatedAt = x.e.CreatedAt,
                };
            }).ToList();
            list.Reverse();
            return new VendorStatementDto { Summary = summary, Entries = list.Take(take).ToList() };
        }

        // ===================================
        // الدفعات والتسويات (الإدارة)
        // ===================================
        public async Task<LedgerEntryDto> RecordPayoutAsync(Guid vendorId, decimal amount, string? reference, string? note, Guid adminId, CancellationToken ct = default)
        {
            if (amount <= 0) throw new BusinessRuleException("المبلغ يجب أن يكون أكبر من صفر");
            if (!await _context.Vendors.AnyAsync(v => v.Id == vendorId, ct)) throw new NotFoundException("المتجر غير موجود");
            return await AddManualAsync(vendorId, LedgerType.Payout, -Money(amount),
                string.IsNullOrWhiteSpace(note) ? "دفعة للمتجر" : note.Trim(), reference?.Trim(), adminId, ct);
        }

        public async Task<LedgerEntryDto> RecordAdjustmentAsync(Guid vendorId, decimal amount, string note, Guid adminId, CancellationToken ct = default)
        {
            if (amount == 0) throw new BusinessRuleException("المبلغ لا يمكن أن يكون صفراً");
            if (string.IsNullOrWhiteSpace(note)) throw new BusinessRuleException("اكتب سبب التسوية");
            if (!await _context.Vendors.AnyAsync(v => v.Id == vendorId, ct)) throw new NotFoundException("المتجر غير موجود");
            return await AddManualAsync(vendorId, LedgerType.Adjustment, Money(amount), note.Trim(), null, adminId, ct);
        }

        private async Task<LedgerEntryDto> AddManualAsync(Guid vendorId, string type, decimal amount, string description, string? reference, Guid adminId, CancellationToken ct)
        {
            var e = new VendorLedgerEntry { VendorId = vendorId, Type = type, Amount = amount, Description = description, Reference = reference, CreatedBy = adminId };
            _context.VendorLedgerEntries.Add(e);
            await _context.SaveChangesAsync(ct);
            return new LedgerEntryDto { Id = e.Id, Type = type, TypeAr = LedgerType.Ar(type), Amount = amount, Description = description, Reference = reference, CreatedAt = e.CreatedAt };
        }
    }
}
