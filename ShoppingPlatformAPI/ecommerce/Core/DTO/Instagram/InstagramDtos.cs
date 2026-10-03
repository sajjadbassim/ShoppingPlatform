namespace ecommerce.Core.DTO.Instagram
{
    // ===================================
    // لوحة التاجر — المنشورات نفسها تُعاد كـ SocialFeedItemDto
    // ===================================
    public class InstagramStatusDto
    {
        // مفاتيح إنستغرام مضبوطة في إعدادات الخادم
        public bool Configured { get; set; }
        public bool Connected { get; set; }
        public bool NeedsReconnect { get; set; }
        public InstagramAccountDto? Account { get; set; }
        public InstagramSettingsDto? Settings { get; set; }
        public DateTime? ConnectedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }
        public string? LastSyncError { get; set; }
        public List<string> Scopes { get; set; } = new();
    }

    public class InstagramAccountDto
    {
        public string? Username { get; set; }
        public string? Name { get; set; }
        public string? AccountType { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? ProfileUrl { get; set; }
        public long? FollowersCount { get; set; }
        public long? MediaCount { get; set; }
    }

    public class InstagramSettingsDto
    {
        public bool ShowOnStore { get; set; }
        public bool AutoShowNewMedia { get; set; }
    }

    public class InstagramSettingsUpdateDto
    {
        public bool? ShowOnStore { get; set; }
        public bool? AutoShowNewMedia { get; set; }
    }

    public class InstagramConnectUrlDto
    {
        public string AuthorizeUrl { get; set; } = "";
    }
}
