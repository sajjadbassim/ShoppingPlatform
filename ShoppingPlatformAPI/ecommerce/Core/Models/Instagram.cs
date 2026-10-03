using ecommerce.Core.Interfaces;

namespace ecommerce.Core.Models
{
    // حساب إنستغرام (احترافي: Business أو Creator) المربوط بمتجر — متجر واحد ↔ حساب واحد
    // الإعدادات في Data/Configurations/InstagramConfiguration.cs
    public class InstagramConnection : IAuditableEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid VendorId { get; set; }

        // معرّف المستخدم الذي يعيده تبديل الكود — هو نفسه في طلبات Meta (إلغاء التفويض / حذف البيانات)
        public string InstagramUserId { get; set; } = "";
        // معرّف الحساب الاحترافي (user_id في /me) — قد يختلف عن السابق
        public string? AccountId { get; set; }

        // توكن طويل الأمد (60 يوماً، يُجدَّد بعد مرور 24 ساعة على إصداره) — مشفّر عبر Data Protection
        public string AccessTokenProtected { get; set; } = "";
        public DateTime AccessTokenIssuedAt { get; set; }
        public DateTime AccessTokenExpiresAt { get; set; }
        public string Scopes { get; set; } = "";

        public string? Username { get; set; }
        public string? Name { get; set; }
        public string? AccountType { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public long? FollowersCount { get; set; }
        public long? MediaCount { get; set; }

        // إعدادات التاجر
        public bool ShowOnStore { get; set; } = true;
        public bool AutoShowNewMedia { get; set; } = true;

        public DateTime ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        // آخر مزامنة للقائمة كاملة (الدورية/اليدوية) — فتح المتجر يجلب أحدث صفحة فقط ولا يغيّره
        public DateTime? LastFullSyncedAt { get; set; }
        public string? LastSyncError { get; set; }

        // انتهى التوكن أو ألغى التاجر التفويض من إنستغرام — يلزم إعادة الربط
        public bool NeedsReconnect { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Vendor Vendor { get; set; } = null!;
        public virtual ICollection<InstagramMedia> Media { get; set; } = new List<InstagramMedia>();
    }

    // منشور من حساب المتجر (صورة، فيديو/ريلز، أو ألبوم) — نسخة محلية تُحدَّث بالمزامنة
    public class InstagramMedia : IAuditableEntity
    {
        public const string TypeImage = "IMAGE";
        public const string TypeVideo = "VIDEO";
        public const string TypeCarousel = "CAROUSEL_ALBUM";

        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ConnectionId { get; set; }
        public string ExternalId { get; set; } = "";

        public string MediaType { get; set; } = TypeImage;   // IMAGE | VIDEO | CAROUSEL_ALBUM
        public string? MediaProductType { get; set; }        // FEED | REELS
        public string? Caption { get; set; }

        // روابط الوسائط من إنستغرام مؤقتة — تُجدَّد بالمزامنة الدورية
        public string? MediaUrl { get; set; }
        public string? ThumbnailUrl { get; set; }
        public string? Permalink { get; set; }

        // عناصر الألبوم: JSON لقائمة InstagramMediaChild
        public string? ChildrenJson { get; set; }

        public long? LikeCount { get; set; }
        public long? CommentsCount { get; set; }
        public DateTime? PublishedAt { get; set; }

        public bool IsHidden { get; set; }
        public Guid? ProductId { get; set; }

        // لم يعد المنشور موجوداً في إنستغرام (حُذف أو أُرشف)
        public bool IsRemoved { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual InstagramConnection Connection { get; set; } = null!;
        public virtual Product? Product { get; set; }
    }

    public class InstagramMediaChild
    {
        public string Type { get; set; } = InstagramMedia.TypeImage;
        public string? Url { get; set; }
        public string? ThumbnailUrl { get; set; }
    }

    // طلب ربط قيد التنفيذ: يربط state المرسَل لإنستغرام بالمتجر، صالح لمرة واحدة ولمدة قصيرة
    public class InstagramOAuthState
    {
        public string State { get; set; } = "";
        public Guid VendorId { get; set; }

        // بصمة (SHA-256) للقيمة المحفوظة في كوكي المتصفح — تمنع إكمال الربط من متصفح آخر
        public string NonceHash { get; set; } = "";

        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
