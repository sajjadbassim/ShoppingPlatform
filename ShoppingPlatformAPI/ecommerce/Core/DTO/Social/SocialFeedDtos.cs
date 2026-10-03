namespace ecommerce.Core.DTO.Social
{
    // ===================================
    // عنصر موحّد من أي منصة (تيك توك / إنستغرام) — يُعرض في تبويب المتجر وصفحة ريلز ولوحة التاجر.
    // أسماء الحقول المشتركة مطابقة لـ TikTokVideoDto ليعمل نفس العارض في الواجهة
    // ===================================
    public static class SocialPlatforms
    {
        public const string TikTok = "tiktok";
        public const string Instagram = "instagram";
    }

    public static class SocialMediaTypes
    {
        public const string Video = "video";
        public const string Image = "image";
        public const string Carousel = "carousel";
    }

    public class SocialFeedItemDto
    {
        public Guid Id { get; set; }
        public string Platform { get; set; } = SocialPlatforms.TikTok;
        public string ExternalId { get; set; } = "";
        public string MediaType { get; set; } = SocialMediaTypes.Video;

        public string? Title { get; set; }
        public string? CoverImageUrl { get; set; }
        public string? ShareUrl { get; set; }

        // تيك توك: مشغّل iframe. إنستغرام: رابط الفيديو المباشر (mp4) وعناصر الألبوم
        public string? EmbedLink { get; set; }
        public string? VideoUrl { get; set; }
        public List<SocialMediaChildDto> Children { get; set; } = new();

        public int? DurationSeconds { get; set; }
        public long? ViewCount { get; set; }
        public long? LikeCount { get; set; }
        public long? CommentsCount { get; set; }
        public DateTime? PublishedAt { get; set; }
        public bool IsHidden { get; set; }
        public SocialLinkedProductDto? Product { get; set; }

        // صفحة ريلز فقط: المتجر صاحب العنصر
        public SocialStoreDto? Store { get; set; }
    }

    public class SocialMediaChildDto
    {
        public string MediaType { get; set; } = SocialMediaTypes.Image;
        public string? Url { get; set; }
        public string? ThumbnailUrl { get; set; }
    }

    public class SocialLinkedProductDto
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? NameAr { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public string? PrimaryImageUrl { get; set; }
        public bool IsAvailable { get; set; }
    }

    public class SocialStoreDto
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? NameAr { get; set; }
        public string? LogoUrl { get; set; }
    }

    public class SocialAccountDto
    {
        public string Platform { get; set; } = SocialPlatforms.TikTok;
        public string? DisplayName { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
        public string? ProfileUrl { get; set; }
    }

    // تبويب المحتوى في صفحة المتجر: الحسابات الظاهرة + العناصر من كلها، الأحدث أولاً
    public class SocialStoreFeedDto
    {
        public List<SocialAccountDto> Accounts { get; set; } = new();
        public List<SocialFeedItemDto> Items { get; set; } = new();
    }

    public class SocialReelsPageDto
    {
        public List<SocialFeedItemDto> Items { get; set; } = new();
        public int Page { get; set; }
        public bool HasMore { get; set; }
    }

    // الحقول غير المُرسلة لا تتغير. RemoveProduct=true يفك ربط المنتج
    public class SocialMediaUpdateDto
    {
        public bool? IsHidden { get; set; }
        public Guid? ProductId { get; set; }
        public bool RemoveProduct { get; set; }
    }
}
