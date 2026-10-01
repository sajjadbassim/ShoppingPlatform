using System.Text.Json.Serialization;

namespace ecommerce.Services.TikTokService
{
    // ===================================
    // ردود TikTok API v2 كما هي (snake_case)
    // ===================================

    // رد تيك توك عند تبديل الكود بالتوكن أو تجديده
    public class TikTokTokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("expires_in")] public int ExpiresIn { get; set; }
        [JsonPropertyName("refresh_token")] public string? RefreshToken { get; set; }
        [JsonPropertyName("refresh_expires_in")] public int RefreshExpiresIn { get; set; }
        [JsonPropertyName("open_id")] public string? OpenId { get; set; }
        [JsonPropertyName("scope")] public string? Scope { get; set; }
        [JsonPropertyName("error")] public string? Error { get; set; }
        [JsonPropertyName("error_description")] public string? ErrorDescription { get; set; }
    }

    public class TikTokApiError
    {
        [JsonPropertyName("code")] public string? Code { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("log_id")] public string? LogId { get; set; }
    }

    // رد تيك توك لبيانات المستخدم
    public class TikTokUserInfoResponse
    {
        [JsonPropertyName("data")] public TikTokUserInfoData? Data { get; set; }
        [JsonPropertyName("error")] public TikTokApiError? Error { get; set; }
    }

    public class TikTokUserInfoData
    {
        [JsonPropertyName("user")] public TikTokUser? User { get; set; }
    }

    public class TikTokUser
    {
        [JsonPropertyName("open_id")] public string? OpenId { get; set; }
        [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
        [JsonPropertyName("avatar_url")] public string? AvatarUrl { get; set; }
        [JsonPropertyName("username")] public string? Username { get; set; }
        [JsonPropertyName("profile_deep_link")] public string? ProfileDeepLink { get; set; }
        [JsonPropertyName("follower_count")] public long? FollowerCount { get; set; }
        [JsonPropertyName("likes_count")] public long? LikesCount { get; set; }
        [JsonPropertyName("video_count")] public long? VideoCount { get; set; }
    }

    // رد تيك توك لقائمة الفيديوهات
    public class TikTokVideoListResponse
    {
        [JsonPropertyName("data")] public TikTokVideoListData? Data { get; set; }
        [JsonPropertyName("error")] public TikTokApiError? Error { get; set; }
    }

    public class TikTokVideoListData
    {
        [JsonPropertyName("videos")] public List<TikTokApiVideo>? Videos { get; set; }
        [JsonPropertyName("cursor")] public long Cursor { get; set; }
        [JsonPropertyName("has_more")] public bool HasMore { get; set; }
    }

    public class TikTokApiVideo
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("title")] public string? Title { get; set; }
        [JsonPropertyName("video_description")] public string? VideoDescription { get; set; }
        [JsonPropertyName("cover_image_url")] public string? CoverImageUrl { get; set; }
        [JsonPropertyName("share_url")] public string? ShareUrl { get; set; }
        [JsonPropertyName("embed_link")] public string? EmbedLink { get; set; }
        [JsonPropertyName("duration")] public int? Duration { get; set; }
        [JsonPropertyName("create_time")] public long? CreateTime { get; set; }
        [JsonPropertyName("view_count")] public long? ViewCount { get; set; }
        [JsonPropertyName("like_count")] public long? LikeCount { get; set; }
    }

    // ===================================
    // خطأ من تيك توك
    // ===================================
    public class TikTokApiException : Exception
    {
        public string? Code { get; }

        // التوكن غير صالح أو أُلغي الإذن — لا فائدة من إعادة المحاولة، يلزم إعادة الربط
        public bool RequiresReconnect { get; }

        public TikTokApiException(string message, string? code = null, bool requiresReconnect = false)
            : base(message)
        {
            Code = code;
            RequiresReconnect = requiresReconnect;
        }
    }
}
