namespace ecommerce.Core.Models
{
    // إعدادات فيسبوك (تسجيل دخول فيسبوك للأعمال) — القسم "Facebook" في appsettings.
    // AppId و AppSecret من "إعدادات التطبيق ← أساسي" (غير مفاتيح إنستغرام).
    // ConfigId: معرّف "التكوين" في تسجيل دخول فيسبوك للأعمال (رمز وصول مستخدم + أصل الصفحات +
    // الصلاحيتان pages_show_list و pages_read_engagement).
    // AppSecret في user-secrets (التطوير) أو متغير البيئة Facebook__AppSecret (الإنتاج) فقط.
    public class FacebookOptions
    {
        public const string SectionName = "Facebook";

        public string AppId { get; set; } = "";
        public string AppSecret { get; set; } = "";
        public string ConfigId { get; set; } = "";

        // يجب أن يطابق حرفياً "محددات URI لإعادة توجيه OAuth الصالحة" في تطبيق Meta (HTTPS)، مثل:
        // https://your-domain/api/integrations/facebook/callback
        public string RedirectUri { get; set; } = "";

        // الصفحة التي يعود إليها التاجر بعد الربط (يُضاف لها ?facebook=connected|choose|error)
        public string AfterConnectUrl { get; set; } = "/vendor/social";

        // رابط التطبيق العميق الذي يعود إليه المتصفح بعد موافقة فيسبوك عند الربط من تطبيق الموبايل
        public string AppReturnUrl { get; set; } = "wasit-seller://social";

        // فارغ = بدون رقم إصدار (إصدار التطبيق الافتراضي). مثال: v23.0
        public string ApiVersion { get; set; } = "";

        // الحد الأقصى للمنشورات المحفوظة لكل صفحة (100 في كل طلب)
        public int MaxMedia { get; set; } = 1000;
        // المزامنة الكاملة في الخلفية: كل صفحة تُحدَّث إن مضت هذه المدة على آخر مزامنة كاملة
        public int SyncIntervalMinutes { get; set; } = 15;
        // فتح المتجر أو ريلز يجلب الأحدث إن مضت هذه المدة على آخر مزامنة
        public int StoreRefreshSeconds { get; set; } = 120;

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(AppId) &&
            !string.IsNullOrWhiteSpace(AppSecret) &&
            !string.IsNullOrWhiteSpace(ConfigId) &&
            !string.IsNullOrWhiteSpace(RedirectUri);
    }
}
