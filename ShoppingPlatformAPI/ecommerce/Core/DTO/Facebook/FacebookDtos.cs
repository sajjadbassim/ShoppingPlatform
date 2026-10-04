namespace ecommerce.Core.DTO.Facebook
{
    // ===================================
    // لوحة التاجر — المنشورات نفسها تُعاد كـ SocialFeedItemDto
    // ===================================
    public class FacebookStatusDto
    {
        // مفاتيح فيسبوك مضبوطة في إعدادات الخادم
        public bool Configured { get; set; }
        public bool Connected { get; set; }
        public bool NeedsReconnect { get; set; }
        public FacebookPageDto? Account { get; set; }
        public FacebookSettingsDto? Settings { get; set; }
        public DateTime? ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public string? LastSyncError { get; set; }
        public List<string> Scopes { get; set; } = new();
    }

    public class FacebookPageDto
    {
        public string? PageId { get; set; }
        public string? Name { get; set; }
        public string? Username { get; set; }
        public string? PictureUrl { get; set; }
        public string? Link { get; set; }
        public long? FollowersCount { get; set; }
    }

    public class FacebookSettingsDto
    {
        public bool ShowOnStore { get; set; }
        public bool AutoShowNewMedia { get; set; }
    }

    public class FacebookSettingsUpdateDto
    {
        public bool? ShowOnStore { get; set; }
        public bool? AutoShowNewMedia { get; set; }
    }

    public class FacebookConnectUrlDto
    {
        public string AuthorizeUrl { get; set; } = "";
    }

    // التاجر يدير أكثر من صفحة: يختار واحدة بعد العودة من فيسبوك
    public class FacebookPageOptionDto
    {
        public string Id { get; set; } = "";
        public string? Name { get; set; }
        public string? PictureUrl { get; set; }
    }

    public class FacebookSelectPageDto
    {
        public string SelectionId { get; set; } = "";
        public string PageId { get; set; } = "";
    }
}
