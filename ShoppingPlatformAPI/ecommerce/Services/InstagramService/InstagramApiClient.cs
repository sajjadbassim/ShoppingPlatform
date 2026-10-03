using System.Text.Json;
using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.InstagramService
{
    // استدعاءات Instagram API with Instagram Login فقط — بدون منطق المنصة (منفصل ليسهل اختبار InstagramService).
    // تنبيه: إنستغرام يأخذ access_token و client_secret في رابط الطلب، لذلك سجلات HttpClient معطّلة لهذا العميل
    public interface IInstagramApiClient
    {
        string BuildAuthorizeUrl(string state);
        Task<InstagramShortToken> ExchangeCodeAsync(string code, CancellationToken ct = default);
        Task<InstagramTokenResponse> ExchangeForLongLivedTokenAsync(string shortLivedToken, CancellationToken ct = default);
        Task<InstagramTokenResponse> RefreshTokenAsync(string accessToken, CancellationToken ct = default);
        Task<InstagramProfile?> GetProfileAsync(string accessToken, CancellationToken ct = default);
        Task<InstagramMediaPage> ListMediaAsync(string accessToken, string? after, int limit, CancellationToken ct = default);
    }

    public static class InstagramLimits
    {
        // أكبر صفحة يقبلها /me/media
        public const int MediaPageSize = 100;
    }

    public class InstagramApiClient : IInstagramApiClient
    {
        public const string HttpClientName = "Instagram";

        private const string AuthorizeUrl = "https://www.instagram.com/oauth/authorize";
        private const string ShortTokenUrl = "https://api.instagram.com/oauth/access_token";
        private const string GraphHost = "https://graph.instagram.com";

        private const string ProfileFields = "user_id,username,name,account_type,profile_picture_url,followers_count,media_count";
        private const string MediaFields =
            "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count," +
            "children{media_type,media_url,thumbnail_url}";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
        };

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly InstagramOptions _options;
        private readonly ILogger<InstagramApiClient> _logger;

        public InstagramApiClient(IHttpClientFactory httpClientFactory, IOptions<InstagramOptions> options, ILogger<InstagramApiClient> logger)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
            _logger = logger;
        }

        private string GraphBase => string.IsNullOrWhiteSpace(_options.ApiVersion)
            ? GraphHost
            : GraphHost + "/" + _options.ApiVersion.Trim('/');

        public string BuildAuthorizeUrl(string state) =>
            AuthorizeUrl
            + "?client_id=" + Uri.EscapeDataString(_options.AppId)
            + "&redirect_uri=" + Uri.EscapeDataString(_options.RedirectUri)
            + "&response_type=code"
            + "&scope=" + Uri.EscapeDataString(_options.Scopes)
            + "&state=" + Uri.EscapeDataString(state);

        // الكود صالح لمرة واحدة — لا يُعاد الطلب
        public async Task<InstagramShortToken> ExchangeCodeAsync(string code, CancellationToken ct = default)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.AppId,
                ["client_secret"] = _options.AppSecret,
                ["grant_type"] = "authorization_code",
                ["redirect_uri"] = _options.RedirectUri,
                ["code"] = code
            });
            using var response = await client.PostAsync(ShortTokenUrl, content, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            var token = ParseShortToken(body);
            if (!response.IsSuccessStatusCode || token == null)
            {
                var (errorCode, message) = ParseOAuthError(body);
                _logger.LogError("Instagram code exchange failed ({Status}): {Code} {Message}", (int)response.StatusCode, errorCode, message);
                throw new InstagramApiException("تعذّر الحصول على إذن الوصول من إنستغرام", errorCode);
            }
            return token;
        }

        public Task<InstagramTokenResponse> ExchangeForLongLivedTokenAsync(string shortLivedToken, CancellationToken ct = default) =>
            GetTokenAsync(GraphHost + "/access_token?grant_type=ig_exchange_token"
                          + "&client_secret=" + Uri.EscapeDataString(_options.AppSecret)
                          + "&access_token=" + Uri.EscapeDataString(shortLivedToken), "long-lived token", ct);

        public Task<InstagramTokenResponse> RefreshTokenAsync(string accessToken, CancellationToken ct = default) =>
            GetTokenAsync(GraphHost + "/refresh_access_token?grant_type=ig_refresh_token"
                          + "&access_token=" + Uri.EscapeDataString(accessToken), "token refresh", ct);

        public async Task<InstagramProfile?> GetProfileAsync(string accessToken, CancellationToken ct = default)
        {
            var url = GraphBase + "/me?fields=" + Uri.EscapeDataString(ProfileFields)
                      + "&access_token=" + Uri.EscapeDataString(accessToken);
            using var response = await SendWithRetryAsync(url, "profile", ct);
            return await ReadOrThrowAsync<InstagramProfile>(response, "profile", ct);
        }

        public async Task<InstagramMediaPage> ListMediaAsync(string accessToken, string? after, int limit, CancellationToken ct = default)
        {
            var url = GraphBase + "/me/media?fields=" + Uri.EscapeDataString(MediaFields)
                      + "&limit=" + Math.Clamp(limit, 1, InstagramLimits.MediaPageSize)
                      + (string.IsNullOrEmpty(after) ? "" : "&after=" + Uri.EscapeDataString(after))
                      + "&access_token=" + Uri.EscapeDataString(accessToken);
            using var response = await SendWithRetryAsync(url, "media list", ct);
            return await ReadOrThrowAsync<InstagramMediaPage>(response, "media list", ct) ?? new InstagramMediaPage();
        }

        // ===================================
        // Helpers
        // ===================================
        private async Task<InstagramTokenResponse> GetTokenAsync(string url, string operation, CancellationToken ct)
        {
            using var response = await SendWithRetryAsync(url, operation, ct);
            var token = await ReadOrThrowAsync<InstagramTokenResponse>(response, operation, ct);
            if (string.IsNullOrEmpty(token?.AccessToken))
                throw new InstagramApiException("تعذّر الحصول على إذن الوصول من إنستغرام", "empty_token");
            return token;
        }

        // طلبات GET قراءة فقط (أو تجديد توكن يعيد نفس النتيجة): محاولة ثانية واحدة عند انقطاع الاتصال
        private async Task<HttpResponseMessage> SendWithRetryAsync(string url, string operation, CancellationToken ct)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    return await client.GetAsync(url, ct);
                }
                catch (Exception ex) when (attempt < 2 && !ct.IsCancellationRequested &&
                                           ex is HttpRequestException or TaskCanceledException)
                {
                    _logger.LogWarning("Instagram {Operation} attempt {Attempt} failed ({Error}), retrying", operation, attempt, ex.GetType().Name);
                    await Task.Delay(TimeSpan.FromMilliseconds(500), ct);
                }
            }
        }

        private async Task<T?> ReadOrThrowAsync<T>(HttpResponseMessage response, string operation, CancellationToken ct) where T : class
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw ToException(body, response, operation);
            try
            {
                return JsonSerializer.Deserialize<T>(body, JsonOptions);
            }
            catch (JsonException)
            {
                _logger.LogWarning("Instagram {Operation} returned invalid JSON ({Status})", operation, (int)response.StatusCode);
                throw new InstagramApiException($"رد غير صالح من إنستغرام ({operation})", "invalid_json");
            }
        }

        private InstagramApiException ToException(string body, HttpResponseMessage response, string operation)
        {
            InstagramGraphError? error = null;
            try { error = JsonSerializer.Deserialize<InstagramGraphErrorResponse>(body, JsonOptions)?.Error; }
            catch (JsonException) { }

            _logger.LogWarning("Instagram {Operation} failed ({Status}): {Code}/{Subcode} {Type} {Message} trace={TraceId}",
                operation, (int)response.StatusCode, error?.Code, error?.Subcode, error?.Type, error?.Message, error?.TraceId);

            // 190: التوكن غير صالح/منتهٍ/أُلغي. 10 و 200–299: صلاحية غير ممنوحة
            var requiresReconnect = error?.Code is 190 or 10 or >= 200 and <= 299
                                    || response.StatusCode == System.Net.HttpStatusCode.Unauthorized;
            var code = error?.Code is { } c ? c.ToString() : ((int)response.StatusCode).ToString();
            return new InstagramApiException($"فشل طلب إنستغرام ({operation})", code, requiresReconnect);
        }

        // الرد بإحدى صيغتين: { data: [ { access_token, user_id, permissions } ] } أو الحقول مباشرة.
        // permissions نص مفصول بفواصل أو مصفوفة، و user_id نص أو رقم
        public static InstagramShortToken? ParseShortToken(string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return null;
                if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
                    root = data[0];

                var accessToken = root.TryGetProperty("access_token", out var at) && at.ValueKind == JsonValueKind.String ? at.GetString() : null;
                var userId = root.TryGetProperty("user_id", out var uid)
                    ? uid.ValueKind switch
                    {
                        JsonValueKind.String => uid.GetString(),
                        JsonValueKind.Number => uid.GetRawText(),
                        _ => null
                    }
                    : null;
                var permissions = root.TryGetProperty("permissions", out var p)
                    ? p.ValueKind switch
                    {
                        JsonValueKind.String => p.GetString() ?? "",
                        JsonValueKind.Array => string.Join(',', p.EnumerateArray().Select(e => e.GetString()).Where(s => !string.IsNullOrEmpty(s))),
                        _ => ""
                    }
                    : "";

                return string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(userId)
                    ? null
                    : new InstagramShortToken(accessToken, userId, permissions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        // { error_type, code, error_message } أو { error: { code, message } }
        private static (string? Code, string? Message) ParseOAuthError(string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return (null, null);
                if (root.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.Object) root = e;
                var code = root.TryGetProperty("error_type", out var t) ? t.ToString()
                         : root.TryGetProperty("code", out var c) ? c.ToString() : null;
                var message = root.TryGetProperty("error_message", out var m) ? m.ToString()
                            : root.TryGetProperty("message", out var m2) ? m2.ToString() : null;
                return (code, message);
            }
            catch (JsonException)
            {
                return (null, null);
            }
        }
    }
}
