using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ecommerce.Services.InstagramService
{
    // ===================================
    // ردود Instagram API (graph.instagram.com) كما هي (snake_case)
    // ===================================

    // نتيجة تبديل الكود: توكن قصير الأمد (ساعة واحدة) ومعرّف المستخدم والصلاحيات الممنوحة
    public record InstagramShortToken(string AccessToken, string UserId, string Permissions);

    // التوكن طويل الأمد (التبديل أو التجديد)
    public class InstagramTokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("token_type")] public string? TokenType { get; set; }
        [JsonPropertyName("expires_in")] public long ExpiresIn { get; set; }
    }

    public class InstagramProfile
    {
        [JsonPropertyName("user_id")][JsonConverter(typeof(FlexibleStringConverter))] public string? UserId { get; set; }
        [JsonPropertyName("username")] public string? Username { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("account_type")] public string? AccountType { get; set; }
        [JsonPropertyName("profile_picture_url")] public string? ProfilePictureUrl { get; set; }
        [JsonPropertyName("followers_count")] public long? FollowersCount { get; set; }
        [JsonPropertyName("media_count")] public long? MediaCount { get; set; }
    }

    public class InstagramMediaPage
    {
        [JsonPropertyName("data")] public List<InstagramApiMedia>? Data { get; set; }
        [JsonPropertyName("paging")] public InstagramPaging? Paging { get; set; }

        // صفحة تالية موجودة فقط إن أعاد إنستغرام رابط next ومؤشر after
        public string? NextCursor => Paging?.Next != null ? Paging.Cursors?.After : null;
    }

    public class InstagramPaging
    {
        [JsonPropertyName("cursors")] public InstagramCursors? Cursors { get; set; }
        [JsonPropertyName("next")] public string? Next { get; set; }
    }

    public class InstagramCursors
    {
        [JsonPropertyName("after")] public string? After { get; set; }
    }

    public class InstagramApiMedia
    {
        [JsonPropertyName("id")][JsonConverter(typeof(FlexibleStringConverter))] public string? Id { get; set; }
        [JsonPropertyName("caption")] public string? Caption { get; set; }
        [JsonPropertyName("media_type")] public string? MediaType { get; set; }
        [JsonPropertyName("media_product_type")] public string? MediaProductType { get; set; }
        [JsonPropertyName("media_url")] public string? MediaUrl { get; set; }
        [JsonPropertyName("thumbnail_url")] public string? ThumbnailUrl { get; set; }
        [JsonPropertyName("permalink")] public string? Permalink { get; set; }
        [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }
        [JsonPropertyName("like_count")] public long? LikeCount { get; set; }
        [JsonPropertyName("comments_count")] public long? CommentsCount { get; set; }
        [JsonPropertyName("children")] public InstagramChildren? Children { get; set; }

        // إنستغرام يرسل الوقت بصيغة 2024-07-17T12:00:00+0000 (المنطقة بدون نقطتين)
        public DateTime? PublishedAtUtc =>
            !string.IsNullOrEmpty(Timestamp) &&
            DateTimeOffset.TryParse(NormalizeOffset(Timestamp), CultureInfo.InvariantCulture, DateTimeStyles.None, out var value)
                ? value.UtcDateTime
                : null;

        // +0000 ← +00:00
        private static string NormalizeOffset(string s) =>
            s.Length > 5 && (s[^5] == '+' || s[^5] == '-') && s[^4..].All(char.IsDigit)
                ? s[..^2] + ":" + s[^2..]
                : s;
    }

    public class InstagramChildren
    {
        [JsonPropertyName("data")] public List<InstagramApiChild>? Data { get; set; }
    }

    public class InstagramApiChild
    {
        [JsonPropertyName("media_type")] public string? MediaType { get; set; }
        [JsonPropertyName("media_url")] public string? MediaUrl { get; set; }
        [JsonPropertyName("thumbnail_url")] public string? ThumbnailUrl { get; set; }
    }

    public class InstagramGraphErrorResponse
    {
        [JsonPropertyName("error")] public InstagramGraphError? Error { get; set; }
    }

    public class InstagramGraphError
    {
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("type")] public string? Type { get; set; }
        [JsonPropertyName("code")] public int? Code { get; set; }
        [JsonPropertyName("error_subcode")] public int? Subcode { get; set; }
        [JsonPropertyName("fbtrace_id")] public string? TraceId { get; set; }
    }

    // المعرّفات تصل أحياناً كنص وأحياناً كرقم
    public class FlexibleStringConverter : JsonConverter<string?>
    {
        public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType switch
            {
                JsonTokenType.String => reader.GetString(),
                JsonTokenType.Number => reader.TryGetInt64(out var n) ? n.ToString(CultureInfo.InvariantCulture) : reader.GetDouble().ToString(CultureInfo.InvariantCulture),
                JsonTokenType.Null => null,
                _ => throw new JsonException("Unexpected token for id")
            };

        public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value);
    }

    // ===================================
    // خطأ من إنستغرام
    // ===================================
    public class InstagramApiException : Exception
    {
        public string? Code { get; }

        // التوكن غير صالح أو أُلغي الإذن — لا فائدة من إعادة المحاولة، يلزم إعادة الربط
        public bool RequiresReconnect { get; }

        public InstagramApiException(string message, string? code = null, bool requiresReconnect = false)
            : base(message)
        {
            Code = code;
            RequiresReconnect = requiresReconnect;
        }
    }
}
