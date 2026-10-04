using System.Globalization;
using System.Text.Json.Serialization;
using ecommerce.Services.InstagramService;

namespace ecommerce.Services.FacebookService
{
    // ===================================
    // ردود Graph API (graph.facebook.com) كما هي (snake_case)
    // ===================================

    public class FacebookTokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("token_type")] public string? TokenType { get; set; }
        [JsonPropertyName("expires_in")] public long? ExpiresIn { get; set; }
    }

    public class FacebookUser
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
    }

    public class FacebookPicture
    {
        [JsonPropertyName("data")] public FacebookPictureData? Data { get; set; }
    }

    public class FacebookPictureData
    {
        [JsonPropertyName("url")] public string? Url { get; set; }
    }

    // صفحة يديرها المستخدم مع توكنها (من /me/accounts)
    public class FacebookPageAccount
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("picture")] public FacebookPicture? Picture { get; set; }
    }

    // debug_token: الصلاحيات الممنوحة وعلى أي صفحات (granular_scopes.target_ids)
    public class FacebookDebugTokenResponse
    {
        [JsonPropertyName("data")] public FacebookDebugTokenData? Data { get; set; }
    }

    public class FacebookDebugTokenData
    {
        [JsonPropertyName("is_valid")] public bool IsValid { get; set; }
        [JsonPropertyName("granular_scopes")] public List<FacebookGranularScope>? GranularScopes { get; set; }
    }

    public class FacebookGranularScope
    {
        [JsonPropertyName("scope")] public string? Scope { get; set; }
        [JsonPropertyName("target_ids")] public List<string>? TargetIds { get; set; }
    }

    public class FacebookPageInfo
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("username")] public string? Username { get; set; }
        [JsonPropertyName("link")] public string? Link { get; set; }
        [JsonPropertyName("followers_count")] public long? FollowersCount { get; set; }
        [JsonPropertyName("fan_count")] public long? FanCount { get; set; }
        [JsonPropertyName("picture")] public FacebookPicture? Picture { get; set; }
    }

    public class FacebookPermission
    {
        [JsonPropertyName("permission")] public string? Permission { get; set; }
        [JsonPropertyName("status")] public string? Status { get; set; }
    }

    // صفحة من قائمة: data + paging (نفس الشكل في كل قوائم Graph API)
    public class FacebookList<T>
    {
        [JsonPropertyName("data")] public List<T>? Data { get; set; }
        [JsonPropertyName("paging")] public InstagramPaging? Paging { get; set; }

        public string? NextCursor => Paging?.Next != null ? Paging.Cursors?.After : null;
    }

    public class FacebookApiVideo
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("created_time")] public string? CreatedTime { get; set; }
        [JsonPropertyName("permalink_url")] public string? PermalinkUrl { get; set; }
        [JsonPropertyName("source")] public string? Source { get; set; }
        [JsonPropertyName("length")] public double? Length { get; set; }
        [JsonPropertyName("picture")] public string? Picture { get; set; }
        [JsonPropertyName("thumbnails")] public FacebookList<FacebookThumbnail>? Thumbnails { get; set; }

        // الصورة المصغّرة المفضّلة، وإلا الأكبر، وإلا picture (صغيرة)
        public string? BestThumbnail =>
            Thumbnails?.Data?.FirstOrDefault(t => t.IsPreferred == true)?.Uri
            ?? Thumbnails?.Data?.OrderByDescending(t => t.Width ?? 0).FirstOrDefault()?.Uri
            ?? Picture;
    }

    public class FacebookThumbnail
    {
        [JsonPropertyName("uri")] public string? Uri { get; set; }
        [JsonPropertyName("is_preferred")] public bool? IsPreferred { get; set; }
        [JsonPropertyName("width")] public int? Width { get; set; }
    }

    public class FacebookApiPost
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("created_time")] public string? CreatedTime { get; set; }
        [JsonPropertyName("permalink_url")] public string? PermalinkUrl { get; set; }
        [JsonPropertyName("attachments")] public FacebookList<FacebookAttachment>? Attachments { get; set; }
    }

    public class FacebookAttachment
    {
        // photo | video | album | link ...
        [JsonPropertyName("media_type")] public string? MediaType { get; set; }
        [JsonPropertyName("type")] public string? Type { get; set; }
        [JsonPropertyName("media")] public FacebookAttachmentMedia? Media { get; set; }
        [JsonPropertyName("target")] public FacebookAttachmentTarget? Target { get; set; }
        [JsonPropertyName("subattachments")] public FacebookList<FacebookAttachment>? Subattachments { get; set; }
    }

    public class FacebookAttachmentMedia
    {
        [JsonPropertyName("image")] public FacebookAttachmentImage? Image { get; set; }
        [JsonPropertyName("source")] public string? Source { get; set; }
    }

    public class FacebookAttachmentImage
    {
        [JsonPropertyName("src")] public string? Src { get; set; }
    }

    public class FacebookAttachmentTarget
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
    }

    public static class FacebookGraph
    {
        // فيسبوك يرسل الوقت بصيغة 2024-07-17T12:00:00+0000
        public static DateTime? ParseTime(string? s)
        {
            if (string.IsNullOrEmpty(s)) return null;
            if (s.Length > 5 && (s[^5] == '+' || s[^5] == '-') && s[^4..].All(char.IsDigit))
                s = s[..^2] + ":" + s[^2..];
            return DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var v) ? v.UtcDateTime : null;
        }

        // روابط الفيديو تصل أحياناً نسبية (/page/videos/123/)
        public static string? AbsoluteUrl(string? url) =>
            string.IsNullOrEmpty(url) ? null
            : url.StartsWith('/') ? "https://www.facebook.com" + url
            : url;
    }

    // ===================================
    // خطأ من فيسبوك
    // ===================================
    public class FacebookApiException : Exception
    {
        public string? Code { get; }

        // التوكن غير صالح أو أُلغي الإذن — لا فائدة من إعادة المحاولة، يلزم إعادة الربط
        public bool RequiresReconnect { get; }

        public FacebookApiException(string message, string? code = null, bool requiresReconnect = false)
            : base(message)
        {
            Code = code;
            RequiresReconnect = requiresReconnect;
        }
    }
}
