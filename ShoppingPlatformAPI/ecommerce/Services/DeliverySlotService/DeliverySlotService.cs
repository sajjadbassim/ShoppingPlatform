using System.Globalization;
using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.DeliverySlotService
{
    public class DeliverySlotDto
    {
        public DateTime Start { get; set; }     // UTC
        public DateTime End { get; set; }       // UTC
        public string DayLabel { get; set; } = "";   // اليوم | غداً | اسم اليوم
        public string TimeLabel { get; set; } = "";  // 4:00 م – 6:00 م
    }

    public class DeliverySlotsResponseDto
    {
        public bool Enabled { get; set; }
        public List<DeliverySlotDto> Slots { get; set; } = new();
    }

    public class GrocerySlotSettingsDto
    {
        public bool Enabled { get; set; }
        public int StartHour { get; set; }
        public int EndHour { get; set; }
        public int SlotMinutes { get; set; }
        public int LeadMinutes { get; set; }
        public int Days { get; set; }
    }

    public interface IDeliverySlotService
    {
        // stores: متاجر السوبرماركت في السلة — يُعرض الموعد فقط إن كانت كلها تعمل في بدايته (أوقات العمل)
        Task<DeliverySlotsResponseDto> GetSlotsAsync(IReadOnlyCollection<Vendor>? stores = null, CancellationToken ct = default);
        // الفترة المختارة عند الدفع: null إن كانت المواعيد معطّلة، وخطأ إن لم تكن من الفترات المتاحة الآن
        Task<DeliverySlotDto?> ResolveAsync(DateTime? start, IReadOnlyCollection<Vendor>? stores = null, CancellationToken ct = default);
        // متاجر السوبرماركت في سلة المستخدم (لعرض المواعيد في صفحة الدفع)
        Task<List<Vendor>> GroceryStoresInCartAsync(Guid userId, CancellationToken ct = default);
        Task<GrocerySlotSettingsDto> GetSettingsAsync(CancellationToken ct = default);
        Task<GrocerySlotSettingsDto> SaveSettingsAsync(GrocerySlotSettingsDto dto, Guid userId, CancellationToken ct = default);
    }

    // مواعيد توصيل السوبرماركت: فترات ثابتة الطول بتوقيت بغداد، تبدأ بعد مهلة تحضير من الآن
    public class DeliverySlotService : IDeliverySlotService
    {
        private static readonly string[] DayNames = { "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت" };

        private readonly AppDbContext _context;
        private readonly TimeProvider _time;

        public DeliverySlotService(AppDbContext context, TimeProvider? time = null)
        {
            _context = context;
            _time = time ?? TimeProvider.System;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public async Task<DeliverySlotsResponseDto> GetSlotsAsync(IReadOnlyCollection<Vendor>? stores = null, CancellationToken ct = default)
        {
            var settings = await LoadAsync(ct);
            return new DeliverySlotsResponseDto
            {
                Enabled = settings.GrocerySlotsEnabled,
                Slots = settings.GrocerySlotsEnabled ? Available(settings, stores) : new()
            };
        }

        public async Task<DeliverySlotDto?> ResolveAsync(DateTime? start, IReadOnlyCollection<Vendor>? stores = null, CancellationToken ct = default)
        {
            var settings = await LoadAsync(ct);
            if (!settings.GrocerySlotsEnabled) return null;
            if (start == null)
                throw new BusinessRuleException("اختر موعد توصيل لمنتجات السوبرماركت");

            var wanted = DateTime.SpecifyKind(start.Value.ToUniversalTime(), DateTimeKind.Utc);
            return Available(settings, stores).FirstOrDefault(s => Math.Abs((s.Start - wanted).TotalMinutes) < 1)
                ?? throw new BusinessRuleException("موعد التوصيل المختار لم يعد متاحاً — اختر موعداً آخر");
        }

        // فترات المنصة التي تعمل فيها كل متاجر السوبرماركت المعنية عند بدايتها (متجر مغلق يوم الجمعة لا تظهر له مواعيد الجمعة)
        private List<DeliverySlotDto> Available(DeliverySettings settings, IReadOnlyCollection<Vendor>? stores)
        {
            var slots = Generate(settings, Now);
            return stores is { Count: > 0 }
                ? slots.Where(s => stores.All(v => StoreHours.IsScheduledOpenAt(v, s.Start))).ToList()
                : slots;
        }

        public async Task<List<Vendor>> GroceryStoresInCartAsync(Guid userId, CancellationToken ct = default)
        {
            var groceryIds = await CategoryVisibility.GetGroceryCategoryIdsAsync(_context);
            if (groceryIds.Count == 0) return new();
            var vendorIds = await _context.CartItems.AsNoTracking()
                .Where(i => i.Cart.UserId == userId && i.Product.CategoryId != null && groceryIds.Contains(i.Product.CategoryId.Value))
                .Select(i => i.Product.VendorId)
                .Distinct()
                .ToListAsync(ct);
            return await _context.Vendors.AsNoTracking().Where(v => vendorIds.Contains(v.Id)).ToListAsync(ct);
        }

        public async Task<GrocerySlotSettingsDto> GetSettingsAsync(CancellationToken ct = default)
        {
            var s = await LoadAsync(ct);
            return new GrocerySlotSettingsDto
            {
                Enabled = s.GrocerySlotsEnabled, StartHour = s.GrocerySlotStartHour, EndHour = s.GrocerySlotEndHour,
                SlotMinutes = s.GrocerySlotMinutes, LeadMinutes = s.GrocerySlotLeadMinutes, Days = s.GrocerySlotDays,
            };
        }

        public async Task<GrocerySlotSettingsDto> SaveSettingsAsync(GrocerySlotSettingsDto dto, Guid userId, CancellationToken ct = default)
        {
            if (dto.StartHour is < 0 or > 23 || dto.EndHour is < 1 or > 24 || dto.EndHour <= dto.StartHour)
                throw new BusinessRuleException("ساعة البداية يجب أن تكون قبل ساعة النهاية (0–24)");
            if (dto.SlotMinutes is < 30 or > 480)
                throw new BusinessRuleException("طول الفترة بين 30 و480 دقيقة");
            if (dto.SlotMinutes > (dto.EndHour - dto.StartHour) * 60)
                throw new BusinessRuleException("طول الفترة أكبر من ساعات التوصيل");
            if (dto.LeadMinutes is < 0 or > 1440)
                throw new BusinessRuleException("مهلة التحضير بين 0 و1440 دقيقة");
            if (dto.Days is < 1 or > 7)
                throw new BusinessRuleException("عدد الأيام بين 1 و7");

            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.GrocerySlotsEnabled = dto.Enabled;
            s.GrocerySlotStartHour = dto.StartHour;
            s.GrocerySlotEndHour = dto.EndHour;
            s.GrocerySlotMinutes = dto.SlotMinutes;
            s.GrocerySlotLeadMinutes = dto.LeadMinutes;
            s.GrocerySlotDays = dto.Days;
            s.UpdatedAt = Now;
            s.UpdatedBy = userId;
            await _context.SaveChangesAsync(ct);
            return await GetSettingsAsync(ct);
        }

        private async Task<DeliverySettings> LoadAsync(CancellationToken ct) =>
            await _context.DeliverySettings.AsNoTracking().FirstOrDefaultAsync(ct) ?? new DeliverySettings();

        public static List<DeliverySlotDto> Generate(DeliverySettings s, DateTime utcNow)
        {
            var slots = new List<DeliverySlotDto>();
            // إعدادات تالفة قديمة لا تُسقط صفحة الدفع: نعود للقيم الافتراضية
            var (startHour, endHour, length, lead, days) =
                (s.GrocerySlotStartHour, s.GrocerySlotEndHour, s.GrocerySlotMinutes, s.GrocerySlotLeadMinutes, s.GrocerySlotDays);
            if (startHour < 0 || endHour > 24 || endHour <= startHour || length < 30 || length > (endHour - startHour) * 60)
                (startHour, endHour, length) = (10, 22, 120);
            lead = Math.Clamp(lead, 0, 1440);
            days = Math.Clamp(days, 1, 7);

            var localNow = utcNow.AddHours(StoreHours.BaghdadOffsetHours);
            var earliest = localNow.AddMinutes(lead);

            for (var d = 0; d < days; d++)
            {
                var date = localNow.Date.AddDays(d);
                for (var minute = startHour * 60; minute + length <= endHour * 60; minute += length)
                {
                    var localStart = date.AddMinutes(minute);
                    if (localStart < earliest) continue;
                    var localEnd = localStart.AddMinutes(length);
                    slots.Add(new DeliverySlotDto
                    {
                        Start = DateTime.SpecifyKind(localStart.AddHours(-StoreHours.BaghdadOffsetHours), DateTimeKind.Utc),
                        End = DateTime.SpecifyKind(localEnd.AddHours(-StoreHours.BaghdadOffsetHours), DateTimeKind.Utc),
                        DayLabel = d == 0 ? "اليوم" : d == 1 ? "غداً" : DayNames[(int)date.DayOfWeek],
                        TimeLabel = $"{Clock(localStart)} – {Clock(localEnd)}",
                    });
                }
            }
            return slots;
        }

        // 16:00 → 4:00 م
        public static string Clock(DateTime local)
        {
            var hour = local.Hour % 12 == 0 ? 12 : local.Hour % 12;
            return $"{hour}:{local.Minute.ToString("00", CultureInfo.InvariantCulture)} {(local.Hour < 12 ? "ص" : "م")}";
        }

        // للعرض في الإشعارات وسجل الطلب: «اليوم 4:00 م – 6:00 م» أو «الخميس 10/9 …»
        public static string Describe(DateTime startUtc, DateTime endUtc)
        {
            var start = startUtc.AddHours(StoreHours.BaghdadOffsetHours);
            var end = endUtc.AddHours(StoreHours.BaghdadOffsetHours);
            return $"{DayNames[(int)start.DayOfWeek]} {start.ToString("d/M", CultureInfo.InvariantCulture)} {Clock(start)} – {Clock(end)}";
        }
    }
}
