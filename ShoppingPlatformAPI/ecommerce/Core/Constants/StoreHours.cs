using System.Globalization;
using System.Text.Json;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;

namespace ecommerce.Core.Constants
{
    // أوقات عمل المتجر بتوقيت بغداد: جدول أسبوعي (JSON في Vendor.WorkingHours) + مفتاح يدوي لإيقاف الطلبات.
    // بلا جدول = مفتوح دائماً. الإغلاق بعد منتصف الليل مدعوم (فتح 18:00، إغلاق 02:00)، وفتح = إغلاق يعني 24 ساعة
    public static class StoreHours
    {
        public const int BaghdadOffsetHours = 3;

        // Day: رقم يوم الأسبوع كما في DayOfWeek (0 = الأحد)
        public record DayHours(int Day, bool Closed, string? Open, string? Close);

        private static readonly string[] DayNames = { "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت" };
        private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };

        public static List<DayHours>? Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<DayHours>>(json, Json); }
            catch (JsonException) { return null; }
        }

        // يتحقق من الجدول القادم من التاجر ويعيده بصيغة موحدة — null يعني بلا جدول (مفتوح دائماً)
        public static string? Normalize(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            var days = Parse(json) ?? throw new BusinessRuleException("صيغة أوقات العمل غير صحيحة");
            if (days.Count == 0) return null;
            if (days.Any(d => d.Day is < 0 or > 6) || days.Select(d => d.Day).Distinct().Count() != days.Count)
                throw new BusinessRuleException("أيام أوقات العمل غير صحيحة");
            foreach (var d in days.Where(d => !d.Closed))
                if (TimeOf(d.Open) == null || TimeOf(d.Close) == null)
                    throw new BusinessRuleException($"اكتب وقت الفتح والإغلاق ليوم {DayNames[d.Day]} بصيغة 09:00");
            return JsonSerializer.Serialize(days.OrderBy(d => d.Day).ToList(), Json);
        }

        // الحالة الآن للطلب الفوري: مفتاح الإيقاف اليدوي ثم الجدول
        public static (bool IsOpen, string? Message) Status(Vendor vendor, DateTime utcNow)
        {
            if (!vendor.IsAcceptingOrders)
                return (false, "المتجر لا يستقبل طلبات حالياً");
            if (IsScheduledOpenAt(vendor, utcNow))
                return (true, null);

            var next = NextOpeningUtc(vendor, utcNow);
            if (next == null) return (false, "مغلق حالياً");
            var localNext = next.Value.AddHours(BaghdadOffsetHours);
            var offset = (localNext.Date - utcNow.AddHours(BaghdadOffsetHours).Date).Days;
            var when = offset switch { 0 => "اليوم", 1 => "غداً", _ => $"يوم {DayNames[(int)localNext.DayOfWeek]}" };
            return (false, $"مغلق الآن — يفتح {when} الساعة {Format(localNext.TimeOfDay)}");
        }

        public static bool IsOpen(Vendor vendor, DateTime utcNow) => Status(vendor, utcNow).IsOpen;

        // الجدول وحده (بلا مفتاح الإيقاف): هل يعمل المتجر في هذه اللحظة؟ — للمواعيد المستقبلية مثل توصيل السوبرماركت
        public static bool IsScheduledOpenAt(Vendor vendor, DateTime utc)
        {
            var days = Parse(vendor.WorkingHours);
            if (days == null || days.Count == 0) return true;

            var local = utc.AddHours(BaghdadOffsetHours);
            var now = local.TimeOfDay;
            var today = (int)local.DayOfWeek;
            DayHours? For(int day) => days.FirstOrDefault(d => d.Day == ((day % 7) + 7) % 7 && !d.Closed);

            // اليوم، أو امتداد أمس بعد منتصف الليل
            if (For(today) is { } t && TimeOf(t.Open) is { } open && TimeOf(t.Close) is { } close)
            {
                if (open == close) return true;
                if (open < close ? now >= open && now < close : now >= open) return true;
            }
            return For(today - 1) is { } y && TimeOf(y.Open) is { } yOpen && TimeOf(y.Close) is { } yClose
                && yOpen > yClose && now < yClose;
        }

        // موعد الفتح التالي (UTC) إن كان المتجر مغلقاً حسب جدوله الآن — null إن كان مفتوحاً، أو بلا جدول، أو بلا أي يوم عمل
        public static DateTime? NextOpeningUtc(Vendor vendor, DateTime utcNow)
        {
            if (IsScheduledOpenAt(vendor, utcNow)) return null;
            var days = Parse(vendor.WorkingHours);
            if (days == null) return null;

            var local = utcNow.AddHours(BaghdadOffsetHours);
            for (var offset = 0; offset <= 7; offset++)
            {
                var date = local.Date.AddDays(offset);
                var entry = days.FirstOrDefault(d => d.Day == (int)date.DayOfWeek && !d.Closed);
                if (entry == null || TimeOf(entry.Open) is not { } open) continue;
                var opening = date + open;
                if (opening <= local) continue;
                return DateTime.SpecifyKind(opening.AddHours(-BaghdadOffsetHours), DateTimeKind.Utc);
            }
            return null;
        }

        private static TimeSpan? TimeOf(string? hhmm) =>
            TimeSpan.TryParseExact(hhmm?.Trim(), new[] { @"hh\:mm", @"h\:mm" }, CultureInfo.InvariantCulture, out var t) && t < TimeSpan.FromDays(1)
                ? t : null;

        // 9:00 ص / 9:30 م
        private static string Format(TimeSpan t)
        {
            var h = t.Hours % 12 == 0 ? 12 : t.Hours % 12;
            return $"{h}:{t.Minutes:D2} {(t.Hours < 12 ? "ص" : "م")}";
        }
    }
}
