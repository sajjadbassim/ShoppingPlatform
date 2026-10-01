// ⚠️ ملف مرجعي محفوظ للتكامل مع TikTok لاحقاً — ليس جزءاً من مشروع الـ API ولا يُترجَم.
// عند نقله إلى ShoppingPlatformAPI/ecommerce يحتاج مواءمة مع المشروع:
//   - الـ namespace (المشروع يستخدم ecommerce.* وليس WasitPlatform.*)
//   - StoreId و Id من نوع int، بينما معرّفات المتاجر في المشروع Guid (Vendor.Id)
//   - ClientSecret يُحفظ في user-secrets / متغيرات البيئة فقط، وليس في appsettings.json

using System.Text.Json.Serialization;

namespace WasitPlatform.TikTok;

// إعدادات تيك توك (تُقرأ من appsettings.json و user-secrets)
public class TikTokOptions
{
    public string ClientKey { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "";
    // الصفحة التي يعود إليها التاجر بعد الربط
    public string AfterConnectUrl { get; set; } = "/";
}

// جدول قاعدة البيانات: ربط كل متجر بحساب تيك توك
public class TikTokConnection
{
    public int Id { get; set; }
    public int StoreId { get; set; }
    public string OpenId { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public DateTimeOffset AccessTokenExpiresAt { get; set; }
    public DateTimeOffset RefreshTokenExpiresAt { get; set; }
    public string Scopes { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTimeOffset ConnectedAt { get; set; }
    public DateTimeOffset? LastSyncedAt { get; set; }
}

// رد تيك توك عند تبديل الكود بالتوكن
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
}

public class TikTokApiError
{
    [JsonPropertyName("code")] public string? Code { get; set; }
    [JsonPropertyName("message")] public string? Message { get; set; }
    [JsonPropertyName("log_id")] public string? LogId { get; set; }
}
