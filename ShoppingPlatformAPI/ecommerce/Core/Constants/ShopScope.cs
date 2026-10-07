namespace ecommerce.Core.Constants
{
    // قسما المتجر: السوبرماركت (منتجات فئة مُعلَّمة كسوبرماركت وفئاتها الفرعية) وبقية المنتجات.
    // يُستخدم لفلترة المنتجات (scope) ولتحديد صفحة أقسام الرئيسية وبانراتها (page). السلة مشتركة بينهما
    public static class ShopScope
    {
        public const string General = "general";
        public const string Grocery = "grocery";

        // قيمة غير معروفة أو فارغة = لا فلترة (null)، حتى تبقى واجهات الإدارة والتاجر كما هي
        public static string? Parse(string? value) => value?.Trim().ToLowerInvariant() switch
        {
            General => General,
            Grocery => Grocery,
            _ => null
        };

        // صفحة القسم/البانر: العامة افتراضياً
        public static string ParsePage(string? value) => Parse(value) ?? General;
    }
}
