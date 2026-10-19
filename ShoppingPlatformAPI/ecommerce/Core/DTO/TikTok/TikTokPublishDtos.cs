using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.TikTok
{
    // ما تحتاجه شاشة «انشر على تيك توك»: الحساب وخياراته من تيك توك (الخصوصية والتفاعل)، وصور المنتج، ونص مقترح
    public class TikTokPublishOptionsDto
    {
        public bool PublishingEnabled { get; set; }
        public bool Connected { get; set; }
        public bool NeedsReconnect { get; set; }
        public bool CanPublish { get; set; }
        public string? Username { get; set; }
        public string? Nickname { get; set; }
        public string? AvatarUrl { get; set; }

        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public string? StoreName { get; set; }
        public List<string> Images { get; set; } = new();
        public string SuggestedCaption { get; set; } = "";

        // من creator_info: مستويات الخصوصية المسموحة لهذا الحساب الآن (لا قيمة افتراضية — يختار التاجر)
        public List<string> PrivacyOptions { get; set; } = new();
        public bool CommentDisabled { get; set; }
        public bool DuetDisabled { get; set; }
        public bool StitchDisabled { get; set; }
        public int MaxVideoDurationSeconds { get; set; }
    }

    public class CreateTikTokPostDto
    {
        [Required]
        public Guid ProductId { get; set; }

        // فيديو واحد، أو صور من 1 إلى 35 — لا خلط بينهما (قيد تيك توك)
        [Required, MinLength(1), MaxLength(35)]
        public List<string> Media { get; set; } = new();

        [Required, MaxLength(2200)]
        public string Caption { get; set; } = "";

        // يختارها التاجر صراحةً من خيارات حسابه (PUBLIC_TO_EVERYONE | MUTUAL_FOLLOW_FRIENDS | FOLLOWER_OF_CREATOR | SELF_ONLY)
        [Required]
        public string PrivacyLevel { get; set; } = "";

        public bool AllowComment { get; set; }
        public bool AllowDuet { get; set; }
        public bool AllowStitch { get; set; }

        // ترويج لنشاطه التجاري — يُرسَل لتيك توك فيظهر وسم «ترويج»
        public bool PromotesOwnBusiness { get; set; }

        // إقرار التاجر بموافقته على نشر المحتوى على حسابه (اشتراط تيك توك)
        public bool Consent { get; set; }

        // يُنشر عند هذا الموعد (حتى 30 يوماً)؛ فارغ = النشر الآن
        public DateTime? ScheduledAt { get; set; }
    }

    public class TikTokPostDto
    {
        public Guid Id { get; set; }
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public string Caption { get; set; } = "";
        public List<string> Media { get; set; } = new();
        public bool IsVideo { get; set; }
        public string PrivacyLevel { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime? ScheduledAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public string? Error { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
