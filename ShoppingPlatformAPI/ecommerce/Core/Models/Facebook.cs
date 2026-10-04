using ecommerce.Core.Interfaces;

namespace ecommerce.Core.Models
{
    // صفحة فيسبوك المربوطة بمتجر (متجر واحد ↔ صفحة واحدة) عبر "تسجيل دخول فيسبوك للأعمال"
    // الإعدادات في Data/Configurations/FacebookConfiguration.cs
    public class FacebookConnection : IAuditableEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid VendorId { get; set; }

        // معرّف المستخدم الخاص بالتطبيق (app-scoped) — هو نفسه في طلبات Meta (إلغاء التفويض / حذف البيانات)
        public string FacebookUserId { get; set; } = "";

        public string PageId { get; set; } = "";
        public string? PageName { get; set; }
        public string? PageUsername { get; set; }
        public string? PagePictureUrl { get; set; }
        public string? PageLink { get; set; }
        public long? FollowersCount { get; set; }

        // توكن الصفحة المأخوذ من توكن مستخدم طويل الأمد لا ينتهي — يبطل فقط إن ألغى المستخدم الإذن
        // أو غيّر كلمة المرور أو فقد صلاحيته على الصفحة. مشفّر عبر Data Protection
        public string PageAccessTokenProtected { get; set; } = "";
        public string Scopes { get; set; } = "";

        // إعدادات التاجر
        public bool ShowOnStore { get; set; } = true;
        public bool AutoShowNewMedia { get; set; } = true;

        public DateTime ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        // آخر مزامنة للقائمة كاملة (الدورية/اليدوية) — فتح المتجر يجلب الأحدث فقط ولا يغيّره
        public DateTime? LastFullSyncedAt { get; set; }
        public string? LastSyncError { get; set; }

        // التوكن لم يعد صالحاً أو أُلغي الإذن — يلزم إعادة الربط
        public bool NeedsReconnect { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Vendor Vendor { get; set; } = null!;
        public virtual ICollection<FacebookMedia> Media { get; set; } = new List<FacebookMedia>();
    }

    // منشور من الصفحة: فيديو/ريلز، صورة، أو ألبوم — نسخة محلية تُحدَّث بالمزامنة
    public class FacebookMedia : IAuditableEntity
    {
        public const string TypeImage = "IMAGE";
        public const string TypeVideo = "VIDEO";
        public const string TypeCarousel = "CAROUSEL_ALBUM";

        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ConnectionId { get; set; }

        // معرّف الفيديو في فيسبوك للفيديو والريلز، ومعرّف المنشور للصور والألبومات
        public string ExternalId { get; set; } = "";

        public string MediaType { get; set; } = TypeImage;
        public bool IsReel { get; set; }
        public string? Caption { get; set; }

        // روابط الوسائط من فيسبوك مؤقتة — تُجدَّد بالمزامنة الدورية
        public string? MediaUrl { get; set; }
        public string? ThumbnailUrl { get; set; }
        public string? Permalink { get; set; }
        public int? DurationSeconds { get; set; }

        // عناصر الألبوم: JSON لقائمة InstagramMediaChild (نفس الشكل للمنصتين)
        public string? ChildrenJson { get; set; }

        public DateTime? PublishedAt { get; set; }

        public bool IsHidden { get; set; }
        public Guid? ProductId { get; set; }

        // لم يعد المنشور موجوداً في الصفحة
        public bool IsRemoved { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual FacebookConnection Connection { get; set; } = null!;
        public virtual Product? Product { get; set; }
    }

    // طلب ربط قيد التنفيذ: يربط state المرسَل لفيسبوك بالمتجر، صالح لمرة واحدة ولمدة قصيرة
    public class FacebookOAuthState
    {
        public string State { get; set; } = "";
        public Guid VendorId { get; set; }

        // بصمة (SHA-256) للقيمة المحفوظة في كوكي المتصفح — تمنع إكمال الربط من متصفح آخر
        public string NonceHash { get; set; } = "";

        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
