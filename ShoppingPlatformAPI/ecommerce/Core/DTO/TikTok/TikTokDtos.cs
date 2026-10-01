namespace ecommerce.Core.DTO.TikTok
{
    // ===================================
    // لوحة التاجر
    // ===================================
    public class TikTokStatusDto
    {
        // مفاتيح تيك توك مضبوطة في إعدادات الخادم
        public bool Configured { get; set; }
        public bool Connected { get; set; }
        public bool NeedsReconnect { get; set; }
        public TikTokAccountDto? Account { get; set; }
        public TikTokSettingsDto? Settings { get; set; }
        public DateTime? ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public string? LastSyncError { get; set; }
        public List<string> Scopes { get; set; } = new();
    }

    public class TikTokAccountDto
    {
        public string? DisplayName { get; set; }
        public string? Username { get; set; }
        public string? AvatarUrl { get; set; }
        public string? ProfileUrl { get; set; }
        public long? FollowerCount { get; set; }
        public long? LikesCount { get; set; }
        public long? VideoCount { get; set; }
    }

    public class TikTokSettingsDto
    {
        public bool ShowOnStore { get; set; }
        public bool AutoShowNewVideos { get; set; }
    }

    public class TikTokSettingsUpdateDto
    {
        public bool? ShowOnStore { get; set; }
        public bool? AutoShowNewVideos { get; set; }
    }

    public class TikTokConnectUrlDto
    {
        public string AuthorizeUrl { get; set; } = "";
    }

    public class TikTokVideoDto
    {
        public Guid Id { get; set; }
        public string ExternalId { get; set; } = "";
        public string? Title { get; set; }
        public string? CoverImageUrl { get; set; }
        public string? ShareUrl { get; set; }
        public string? EmbedLink { get; set; }
        public int? DurationSeconds { get; set; }
        public long? ViewCount { get; set; }
        public long? LikeCount { get; set; }
        public DateTime? PublishedAt { get; set; }
        public bool IsHidden { get; set; }
        public TikTokLinkedProductDto? Product { get; set; }
    }

    public class TikTokLinkedProductDto
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? NameAr { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public string? PrimaryImageUrl { get; set; }
        public bool IsAvailable { get; set; }
    }

    // الحقول غير المُرسلة لا تتغير. RemoveProduct=true يفك ربط المنتج
    public class TikTokVideoUpdateDto
    {
        public bool? IsHidden { get; set; }
        public Guid? ProductId { get; set; }
        public bool RemoveProduct { get; set; }
    }

    // ===================================
    // العرض العام في صفحة المتجر
    // ===================================
    // صفحة "ريلز": فيديوهات كل المتاجر المربوطة، مع بيانات المتجر لكل فيديو
    public class TikTokReelDto : TikTokVideoDto
    {
        public TikTokReelStoreDto Store { get; set; } = new();
    }

    public class TikTokReelStoreDto
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? NameAr { get; set; }
        public string? LogoUrl { get; set; }
    }

    public class TikTokReelsPageDto
    {
        public List<TikTokReelDto> Items { get; set; } = new();
        public int Page { get; set; }
        public bool HasMore { get; set; }
    }

    public class TikTokStoreFeedDto
    {
        public bool Enabled { get; set; }
        public TikTokAccountDto? Account { get; set; }
        public List<TikTokVideoDto> Videos { get; set; } = new();
    }
}
