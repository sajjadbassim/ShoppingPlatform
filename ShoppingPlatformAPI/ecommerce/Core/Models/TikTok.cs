using ecommerce.Core.Interfaces;

namespace ecommerce.Core.Models
{
    // حساب تيك توك المربوط بمتجر (متجر واحد ↔ حساب واحد)
    // الإعدادات في Data/Configurations/TikTokConfiguration.cs
    public class TikTokConnection : IAuditableEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid VendorId { get; set; }
        public string OpenId { get; set; } = "";

        // التوكنات مشفّرة عبر ASP.NET Data Protection (ITikTokTokenProtector) — لا تُخزَّن كنص صريح
        public string AccessTokenProtected { get; set; } = "";
        public string RefreshTokenProtected { get; set; } = "";
        public DateTime AccessTokenExpiresAt { get; set; }
        public DateTime RefreshTokenExpiresAt { get; set; }
        public string Scopes { get; set; } = "";

        // بيانات الحساب المعروضة (الإحصائيات تتوفر فقط إن مُنحت صلاحية user.info.stats)
        public string? DisplayName { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
        public string? ProfileUrl { get; set; }
        public long? FollowerCount { get; set; }
        public long? LikesCount { get; set; }
        public long? VideoCount { get; set; }

        // إعدادات التاجر
        public bool ShowOnStore { get; set; } = true;
        public bool AutoShowNewVideos { get; set; } = true;

        public DateTime ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public string? LastSyncError { get; set; }

        // انتهت صلاحية refresh token أو ألغى التاجر الإذن من تيك توك — يلزم إعادة الربط
        public bool NeedsReconnect { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Vendor Vendor { get; set; } = null!;
        public virtual ICollection<TikTokVideo> Videos { get; set; } = new List<TikTokVideo>();

        public bool HasScope(string scope) =>
            Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                  .Contains(scope, StringComparer.OrdinalIgnoreCase);
    }

    // فيديو من حساب المتجر — نسخة محلية تُحدَّث بالمزامنة، مع إعدادات التاجر (إخفاء / ربط بمنتج)
    public class TikTokVideo : IAuditableEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ConnectionId { get; set; }
        public string ExternalId { get; set; } = "";   // معرّف الفيديو في تيك توك

        public string? Title { get; set; }
        public string? CoverImageUrl { get; set; }       // روابط الغلاف من تيك توك مؤقتة — تُجدَّد بالمزامنة الدورية
        public string? ShareUrl { get; set; }
        public string? EmbedLink { get; set; }
        public int? DurationSeconds { get; set; }
        public long? ViewCount { get; set; }
        public long? LikeCount { get; set; }
        public DateTime? PublishedAt { get; set; }

        public bool IsHidden { get; set; }
        public Guid? ProductId { get; set; }

        // لم يعد الفيديو موجوداً في تيك توك (حُذف أو صار خاصاً)
        public bool IsRemoved { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual TikTokConnection Connection { get; set; } = null!;
        public virtual Product? Product { get; set; }
    }

    // منشور نشره التاجر من المنصة على تيك توك (فيديو واحد أو صور) — Direct Post.
    // لا جدولة: تيك توك لا يوفّرها عبر الـ API، والنشر فوري بضغطة التاجر نفسه
    public class TikTokPost : IAuditableEntity
    {
        public const string StatusScheduled = "SCHEDULED";
        public const string StatusPublishing = "PUBLISHING";
        public const string StatusPublished = "PUBLISHED";
        public const string StatusFailed = "FAILED";
        public const string StatusCancelled = "CANCELLED";

        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid VendorId { get; set; }
        public Guid? ProductId { get; set; }
        public Guid CreatedByUserId { get; set; }

        public string Caption { get; set; } = "";
        // روابط الوسائط المختارة (JSON): فيديو واحد، أو صور (حتى 35)
        public string SourceMediaJson { get; set; } = "[]";
        // صور JPEG المجهزة (JSON) — تُحذف بعد النشر
        public string? PreparedImagesJson { get; set; }
        public bool IsVideo { get; set; }

        // خيارات يقرّرها التاجر صراحةً (اشتراط تيك توك): الخصوصية بلا قيمة افتراضية
        public string PrivacyLevel { get; set; } = "";
        public bool AllowComment { get; set; }
        public bool AllowDuet { get; set; }
        public bool AllowStitch { get; set; }
        // الترويج لنشاطه التجاري (brand_organic_toggle)
        public bool PromotesOwnBusiness { get; set; }

        public string Status { get; set; } = StatusPublishing;
        public int Attempts { get; set; }
        public string? Error { get; set; }

        public string? PublishId { get; set; }
        public string? ExternalVideoId { get; set; }
        public DateTime? PublishedAt { get; set; }

        // تيك توك لا يدعم الجدولة: المنصة تحتفظ بالمنشور (SCHEDULED) وتنشره بنفسها عند هذا الموعد (UTC)
        public DateTime? ScheduledAt { get; set; }
        // بداية آخر محاولة نشر — منها تُحسب مهلة المعالجة (CreatedAt لا يصلح للمجدول ولا لإعادة المحاولة)
        public DateTime? PublishStartedAt { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Vendor Vendor { get; set; } = null!;
        public virtual Product? Product { get; set; }
    }

    // طلب ربط قيد التنفيذ: يربط state المرسَل لتيك توك بالمتجر، صالح لمرة واحدة ولمدة قصيرة
    public class TikTokOAuthState
    {
        public string State { get; set; } = "";
        public Guid VendorId { get; set; }

        // بصمة (SHA-256) للقيمة المحفوظة في كوكي المتصفح — تمنع إكمال الربط من متصفح آخر
        public string NonceHash { get; set; } = "";

        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
