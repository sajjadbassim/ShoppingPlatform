namespace ecommerce.Core.Models
{
    // إعدادات إنستغرام (Instagram API with Instagram Login) — القسم "Instagram" في appsettings.
    // AppId و AppSecret هما "Instagram app ID/secret" من صفحة إعداد Instagram في تطبيق Meta (ليسا معرّف تطبيق فيسبوك).
    // AppSecret في user-secrets (التطوير) أو متغير البيئة Instagram__AppSecret (الإنتاج) فقط.
    public class InstagramOptions
    {
        public const string SectionName = "Instagram";

        public string AppId { get; set; } = "";
        public string AppSecret { get; set; } = "";

        // يجب أن يطابق حرفياً الرابط المسجّل في تطبيق Meta (HTTPS)، مثل:
        // https://your-domain/api/instagram/callback
        public string RedirectUri { get; set; } = "";

        // الصفحة التي يعود إليها التاجر بعد الربط (يُضاف لها ?instagram=connected|error)
        public string AfterConnectUrl { get; set; } = "/vendor/social";

        public string Scopes { get; set; } = "instagram_business_basic";

        // فارغ = بدون رقم إصدار (إصدار التطبيق الافتراضي). مثال: v23.0
        public string ApiVersion { get; set; } = "";

        // الحد الأقصى للمنشورات المحفوظة لكل متجر (100 في كل طلب لإنستغرام ⇒ حتى 10 طلبات للحساب الكبير).
        // القائمة كاملة تُجلب في المزامنة الدورية واليدوية وعند الربط؛ فتح المتجر/ريلز يجلب أحدث 100 فقط
        public int MaxMedia { get; set; } = 1000;
        // المزامنة في الخلفية: كل حساب يُحدَّث إن مضى على آخر مزامنة له هذه المدة
        public int SyncIntervalMinutes { get; set; } = 15;

        // فتح المتجر أو صفحة ريلز يزامن الحساب إن مضت هذه المدة على آخر مزامنة
        // (حدود طلبات إنستغرام أضيق من تيك توك)
        public int StoreRefreshSeconds { get; set; } = 120;

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(AppId) &&
            !string.IsNullOrWhiteSpace(AppSecret) &&
            !string.IsNullOrWhiteSpace(RedirectUri);
    }
}
