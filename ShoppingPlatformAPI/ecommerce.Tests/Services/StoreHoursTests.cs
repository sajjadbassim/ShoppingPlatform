using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;

namespace ecommerce.Tests.Services
{
    // أوقات عمل المتجر بتوقيت بغداد (UTC+3)
    public class StoreHoursTests
    {
        // الأحد 2026-10-04 بتوقيت بغداد الساعة المعطاة ← UTC
        private static DateTime BaghdadSunday(int hour, int minute = 0) => new DateTime(2026, 10, 4, hour, minute, 0, DateTimeKind.Utc).AddHours(-3);

        private static Vendor WithHours(string json, bool accepting = true) =>
            new() { Name = "s", NameAr = "s", IsAcceptingOrders = accepting, WorkingHours = StoreHours.Normalize(json) };

        private const string Daily9To22 = """
            [{"day":0,"open":"09:00","close":"22:00"},{"day":1,"open":"09:00","close":"22:00"},{"day":2,"open":"09:00","close":"22:00"},
             {"day":3,"open":"09:00","close":"22:00"},{"day":4,"open":"09:00","close":"22:00"},{"day":5,"closed":true},{"day":6,"open":"09:00","close":"22:00"}]
            """;

        [Fact]
        public void NoSchedule_IsAlwaysOpen() =>
            Assert.True(StoreHours.IsOpen(new Vendor { IsAcceptingOrders = true }, BaghdadSunday(3)));

        [Fact]
        public void ManualPause_ClosesEvenWithinHours()
        {
            var (open, message) = StoreHours.Status(WithHours(Daily9To22, accepting: false), BaghdadSunday(12));
            Assert.False(open);
            Assert.Contains("لا يستقبل", message);
        }

        [Theory]
        [InlineData(8, 59, false)]
        [InlineData(9, 0, true)]
        [InlineData(21, 59, true)]
        [InlineData(22, 0, false)]
        public void WithinDailyWindow(int hour, int minute, bool expected) =>
            Assert.Equal(expected, StoreHours.IsOpen(WithHours(Daily9To22), BaghdadSunday(hour, minute)));

        [Fact]
        public void BeforeOpening_SaysOpensToday()
        {
            var (_, message) = StoreHours.Status(WithHours(Daily9To22), BaghdadSunday(7));
            Assert.Equal("مغلق الآن — يفتح اليوم الساعة 9:00 ص", message);
        }

        [Fact]
        public void AfterClosing_SaysOpensTomorrow()
        {
            var (_, message) = StoreHours.Status(WithHours(Daily9To22), BaghdadSunday(23));
            Assert.Equal("مغلق الآن — يفتح غداً الساعة 9:00 ص", message);
        }

        [Fact]
        public void ClosedDay_SkipsToNextOpenDay()
        {
            // الخميس 23:00 ← الجمعة مغلق ← يفتح السبت
            var thursdayNight = BaghdadSunday(23).AddDays(4);
            var (open, message) = StoreHours.Status(WithHours(Daily9To22), thursdayNight);
            Assert.False(open);
            Assert.Equal("مغلق الآن — يفتح يوم السبت الساعة 9:00 ص", message);
        }

        [Fact]
        public void OvernightHours_SpanMidnight()
        {
            // السبت 18:00 ← الأحد 02:00
            var vendor = WithHours("""[{"day":6,"open":"18:00","close":"02:00"}]""");
            Assert.True(StoreHours.IsOpen(vendor, BaghdadSunday(1, 30)));      // الأحد 01:30 = امتداد السبت
            Assert.False(StoreHours.IsOpen(vendor, BaghdadSunday(2, 0)));
            Assert.True(StoreHours.IsOpen(vendor, BaghdadSunday(19).AddDays(-1)));  // السبت 19:00
        }

        [Fact]
        public void SameOpenAndClose_IsOpenAllDay() =>
            Assert.True(StoreHours.IsOpen(WithHours("""[{"day":0,"open":"00:00","close":"00:00"}]"""), BaghdadSunday(3)));

        [Fact]
        public void InvalidSchedules_AreRejected()
        {
            Assert.Throws<BusinessRuleException>(() => StoreHours.Normalize("not json"));
            Assert.Throws<BusinessRuleException>(() => StoreHours.Normalize("""[{"day":0,"open":"9am","close":"22:00"}]"""));
            Assert.Throws<BusinessRuleException>(() => StoreHours.Normalize("""[{"day":0,"open":"09:00","close":"22:00"},{"day":0,"closed":true}]"""));
            Assert.Throws<BusinessRuleException>(() => StoreHours.Normalize("""[{"day":7,"open":"09:00","close":"22:00"}]"""));
            Assert.Null(StoreHours.Normalize(""));
        }
    }
}
