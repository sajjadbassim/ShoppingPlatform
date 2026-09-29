namespace ecommerce.Core.Constants
{
    public static class PromotionTargetType
    {
        public const string PRODUCT = "product";  // منتج محدد
        public const string CATEGORY = "category"; // تصنيف كامل
        public const string VENDOR = "vendor";   // بائع كامل
        public const string ALL = "all";      // كل المنتجات

        public static readonly string[] All = { PRODUCT, CATEGORY, VENDOR, ALL };
    }
}
