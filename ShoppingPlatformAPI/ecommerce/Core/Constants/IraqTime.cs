namespace ecommerce.Core.Constants
{
    // توقيت بغداد (UTC+3 طوال السنة، بلا توقيت صيفي) — للعرض ولحدود «اليوم» في الإحصاءات
    public static class IraqTime
    {
        public static readonly TimeSpan Offset = TimeSpan.FromHours(3);

        public static DateTime FromUtc(DateTime utc) => utc + Offset;

        // بداية يوم بغداد الحالي بتوقيت UTC (للمقارنة مع التواريخ المخزّنة بـ UTC)
        public static DateTime TodayStartUtc => (DateTime.UtcNow + Offset).Date - Offset;

        // بداية شهر بغداد الحالي بتوقيت UTC
        public static DateTime MonthStartUtc
        {
            get
            {
                var local = DateTime.UtcNow + Offset;
                return new DateTime(local.Year, local.Month, 1, 0, 0, 0, DateTimeKind.Utc) - Offset;
            }
        }

        // بداية يوم بغداد (تاريخ محلي) بتوقيت UTC
        public static DateTime DayStartUtc(DateTime localDate) => DateTime.SpecifyKind(localDate.Date, DateTimeKind.Utc) - Offset;
    }
}
