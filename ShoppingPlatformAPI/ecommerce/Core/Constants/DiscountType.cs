namespace ecommerce.Core.Constants
{
    public static class DiscountType
    {
        public const string PERCENTAGE = "percentage"; // نسبة مئوية
        public const string FIXED = "fixed";      // مبلغ ثابت

        public static readonly string[] All = { PERCENTAGE, FIXED };
    }
}