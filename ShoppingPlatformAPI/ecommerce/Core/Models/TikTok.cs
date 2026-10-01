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
