using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Instagram
{
    // ما تحتاجه شاشة «انشر على إنستغرام»: الحساب، صور المنتج، نص مقترح، وحصة النشر اليومية
    public class InstagramPublishOptionsDto
    {
        public bool PublishingEnabled { get; set; }
        public bool Connected { get; set; }
        public bool NeedsReconnect { get; set; }
        public bool CanPublish { get; set; }
        public string? Username { get; set; }
        public string? ProfilePictureUrl { get; set; }

        public Guid ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public string? StoreName { get; set; }
        public string? StoreLogoUrl { get; set; }
        public List<string> Images { get; set; } = new();
        public string SuggestedCaption { get; set; } = "";

        // حصة إنستغرام: عدد المنشورات عبر الـ API خلال آخر 24 ساعة (null إن تعذّر جلبها)
        public int? QuotaUsage { get; set; }
        public int? QuotaTotal { get; set; }
    }

    public class CreateInstagramPostDto
    {
        [Required]
        public Guid ProductId { get; set; }

        // الوسائط المختارة بالترتيب (1–10): صور المنتج أو صور/فيديو رفعها التاجر (/api/social/publish/uploads)
        [Required, MinLength(1), MaxLength(10)]
        public List<string> Images { get; set; } = new();

        [Required, MaxLength(2200)]
        public string Caption { get; set; } = "";

        // فارغ = النشر الآن
        public DateTime? ScheduledAt { get; set; }
    }

    public class InstagramPostDto
    {
        public Guid Id { get; set; }
        public Guid? ProductId { get; set; }
        public string? ProductName { get; set; }
        public string Caption { get; set; } = "";
        public List<string> Images { get; set; } = new();
        public string Status { get; set; } = "";
        public DateTime ScheduledAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public string? Permalink { get; set; }
        public string? Error { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
