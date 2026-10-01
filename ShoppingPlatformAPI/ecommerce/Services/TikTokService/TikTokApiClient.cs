using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ecommerce.Core.Models;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.TikTokService
{
    // استدعاءات TikTok API v2 فقط — بدون أي منطق خاص بالمنصة (منفصل ليسهل اختبار TikTokService)
    public interface ITikTokApiClient
    {
        string BuildAuthorizeUrl(string state);
        Task<TikTokTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default);
        Task<TikTokTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
        Task RevokeAsync(string accessToken, CancellationToken ct = default);
        Task<TikTokUser?> GetUserInfoAsync(string accessToken, IEnumerable<string> fields, CancellationToken ct = default);
        Task<TikTokVideoListData> ListVideosAsync(string accessToken, long? cursor, int maxCount, CancellationToken ct = default);
    }

    public class TikTokApiClient : ITikTokApiClient
    {
        public const string HttpClientName = "TikTok";

        private const string AuthorizeUrl = "https://www.tiktok.com/v2/auth/authorize/";
        private const string TokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
        private const string RevokeUrl = "https://open.tiktokapis.com/v2/oauth/revoke/";
        private const string UserInfoUrl = "https://open.tiktokapis.com/v2/user/info/";
        private const string VideoListUrl = "https://open.tiktokapis.com/v2/video/list/";

        private const string VideoFields =
            "id,title,video_description,cover_image_url,share_url,embed_link,duration,create_time,view_count,like_count";

        // أكواد تعني أن التوكن لم يعد صالحاً
        private static readonly HashSet<string> ReconnectCodes = new(StringComparer.OrdinalIgnoreCase)
        {
            "access_token_invalid", "invalid_grant", "scope_not_authorized", "invalid_token"
        };

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly TikTokOptions _options;
        private readonly ILogger<TikTokApiClient> _logger;

        public TikTokApiClient(IHttpClientFactory httpClientFactory, IOptions<TikTokOptions> options, ILogger<TikTokApiClient> logger)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
            _logger = logger;
        }

        public string BuildAuthorizeUrl(string state) =>
            AuthorizeUrl
            + "?client_key=" + Uri.EscapeDataString(_options.ClientKey)
            + "&scope=" + Uri.EscapeDataString(_options.Scopes)
            + "&response_type=code"
            + "&redirect_uri=" + Uri.EscapeDataString(_options.RedirectUri)
            + "&state=" + Uri.EscapeDataString(state);

        public Task<TikTokTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default) =>
            RequestTokenAsync(new Dictionary<string, string>
            {
                ["client_key"] = _options.ClientKey,
                ["client_secret"] = _options.ClientSecret,
                ["code"] = code,
                ["grant_type"] = "authorization_code",
                ["redirect_uri"] = _options.RedirectUri
            }, ct);

        public Task<TikTokTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default) =>
            RequestTokenAsync(new Dictionary<string, string>
            {
                ["client_key"] = _options.ClientKey,
                ["client_secret"] = _options.ClientSecret,
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken
            }, ct);

        public async Task RevokeAsync(string accessToken, CancellationToken ct = default)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_key"] = _options.ClientKey,
                ["client_secret"] = _options.ClientSecret,
                ["token"] = accessToken
            });
            using var response = await client.PostAsync(RevokeUrl, content, ct);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("TikTok revoke returned {Status}", (int)response.StatusCode);
        }

        public async Task<TikTokUser?> GetUserInfoAsync(string accessToken, IEnumerable<string> fields, CancellationToken ct = default)
        {
            var url = UserInfoUrl + "?fields=" + Uri.EscapeDataString(string.Join(',', fields));
            using var response = await SendWithRetryAsync(() =>
            {
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                return request;
            }, "user info", ct);
            var result = await ReadJsonAsync<TikTokUserInfoResponse>(response, ct);
            ThrowIfError(result?.Error, response, "user info");
            return result?.Data?.User;
        }

        public async Task<TikTokVideoListData> ListVideosAsync(string accessToken, long? cursor, int maxCount, CancellationToken ct = default)
        {
            object body = cursor.HasValue
                ? new { max_count = Math.Clamp(maxCount, 1, 20), cursor = cursor.Value }
                : new { max_count = Math.Clamp(maxCount, 1, 20) };

            // قراءة فقط — إعادة المحاولة آمنة
            using var response = await SendWithRetryAsync(() =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, VideoListUrl + "?fields=" + VideoFields)
                {
                    Content = JsonContent.Create(body)
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                return request;
            }, "video list", ct);
            var result = await ReadJsonAsync<TikTokVideoListResponse>(response, ct);
            ThrowIfError(result?.Error, response, "video list");
            return result?.Data ?? new TikTokVideoListData();
        }

        // ===================================
        // Helpers
        // ===================================

        // الاتصال بـ TikTok API غير مستقر أحياناً (مهلة الاتصال أو انقطاعه): محاولة ثانية واحدة
        // لطلبات القراءة فقط. تبديل الكود بالتوكن لا يُعاد لأن الكود صالح لمرة واحدة
        private async Task<HttpResponseMessage> SendWithRetryAsync(
            Func<HttpRequestMessage> createRequest, string operation, CancellationToken ct)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            for (var attempt = 1; ; attempt++)
            {
                using var request = createRequest();
                try
                {
                    return await client.SendAsync(request, ct);
                }
                catch (Exception ex) when (attempt < 2 && !ct.IsCancellationRequested &&
                                           ex is HttpRequestException or TaskCanceledException)
                {
                    _logger.LogWarning("TikTok {Operation} attempt {Attempt} failed ({Error}), retrying", operation, attempt, ex.GetType().Name);
                    await Task.Delay(TimeSpan.FromMilliseconds(500), ct);
                }
            }
        }
        private async Task<TikTokTokenResponse> RequestTokenAsync(Dictionary<string, string> form, CancellationToken ct)
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var content = new FormUrlEncodedContent(form);
            using var response = await client.PostAsync(TokenUrl, content, ct);
            var token = await ReadJsonAsync<TikTokTokenResponse>(response, ct);

            if (!response.IsSuccessStatusCode || string.IsNullOrEmpty(token?.AccessToken))
            {
                _logger.LogError("TikTok token request failed ({Status}): {Error} {Description}",
                    (int)response.StatusCode, token?.Error, token?.ErrorDescription);
                throw new TikTokApiException(
                    "تعذّر الحصول على إذن الوصول من تيك توك",
                    token?.Error,
                    requiresReconnect: token?.Error is { } err && ReconnectCodes.Contains(err));
            }

            return token!;
        }

        private void ThrowIfError(TikTokApiError? error, HttpResponseMessage response, string operation)
        {
            var failed = (error?.Code is { } code && !string.Equals(code, "ok", StringComparison.OrdinalIgnoreCase))
                         || !response.IsSuccessStatusCode;
            if (!failed) return;

            _logger.LogWarning("TikTok {Operation} failed ({Status}): {Code} {Message} log_id={LogId}",
                operation, (int)response.StatusCode, error?.Code, error?.Message, error?.LogId);

            var requiresReconnect = response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                                    || (error?.Code is { } c && ReconnectCodes.Contains(c));
            throw new TikTokApiException($"فشل طلب تيك توك ({operation})", error?.Code, requiresReconnect);
        }

        private async Task<T?> ReadJsonAsync<T>(HttpResponseMessage response, CancellationToken ct) where T : class
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            try
            {
                return JsonSerializer.Deserialize<T>(body);
            }
            catch (JsonException)
            {
                _logger.LogWarning("TikTok returned invalid JSON ({Status})", (int)response.StatusCode);
                return null;
            }
        }
    }
}
