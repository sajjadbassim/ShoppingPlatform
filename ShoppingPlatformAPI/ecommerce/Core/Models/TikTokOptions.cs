namespace ecommerce.Core.Models
{
    // إعدادات تيك توك — القسم "TikTok" في appsettings.
    // ClientSecret في user-secrets (التطوير) أو متغير البيئة TikTok__ClientSecret (الإنتاج) فقط.
    public class TikTokOptions
    {
        public const string SectionName = "TikTok";

        public string ClientKey { get; set; } = "";
        public string ClientSecret { get; set; } = "";

        // يجب أن يطابق حرفياً الرابط المسجّل في TikTok for Developers (HTTPS)، مثل:
        // https://your-domain/api/tiktok/callback
        public string RedirectUri { get; set; } = "";

        // الصفحة التي يعود إليها التاجر بعد الربط (يُضاف لها ?tiktok=connected|error)
        public string AfterConnectUrl { get; set; } = "/vendor/social";

        // الصلاحيات المطلوبة — يجب أن تكون مفعّلة للتطبيق في بوابة المطوّرين.
        // أضف user.info.profile,user.info.stats لعرض اسم المستخدم وعدد المتابعين
        public string Scopes { get; set; } = "user.info.basic,video.list";

        // الحد الأقصى للفيديوهات المحفوظة لكل متجر، وفترة المزامنة الدورية
        public int MaxVideos { get; set; } = 60;
        // المزامنة في الخلفية: كل حساب يُحدَّث إن مضى على آخر مزامنة له هذه المدة
        public int SyncIntervalMinutes { get; set; } = 15;

        // فتح فيديوهات المتجر أو صفحة ريلز يزامن الحساب إن مضت هذه المدة على آخر مزامنة.
        // هي الحد الفعلي لطلبات تيك توك من الزوار (مزامنة واحدة لكل متجر خلالها مهما كثر الزوار)
        public int StoreRefreshSeconds { get; set; } = 60;

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(ClientKey) &&
            !string.IsNullOrWhiteSpace(ClientSecret) &&
            !string.IsNullOrWhiteSpace(RedirectUri);
    }
}
