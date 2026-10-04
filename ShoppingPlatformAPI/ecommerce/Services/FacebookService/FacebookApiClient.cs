using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ecommerce.Core.Models;
using ecommerce.Services.InstagramService;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.FacebookService
{
    // استدعاءات Graph API لصفحات فيسبوك فقط — بدون منطق المنصة (منفصل ليسهل اختبار FacebookService).
    // كل طلب بتوكن يحمل appsecret_proof (توقيع التوكن بمفتاح التطبيق). التوكنات في رابط الطلب،
    // لذلك سجلات HttpClient معطّلة لهذا العميل
    public interface IFacebookApiClient
    {
        string BuildAuthorizeUrl(string state);
        Task<FacebookTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default);
        Task<FacebookTokenResponse> ExchangeForLongLivedTokenAsync(string shortLivedToken, CancellationToken ct = default);
        Task<FacebookUser?> GetMeAsync(string userToken, CancellationToken ct = default);
        Task<List<string>> GetGrantedPermissionsAsync(string userToken, CancellationToken ct = default);
        Task<List<FacebookPageAccount>> GetPagesAsync(string userToken, CancellationToken ct = default);
        // معرّفات الصفحات التي منحها المستخدم (من التوكن نفسه) — احتياط عندما لا تعيد /me/accounts شيئاً
        Task<List<string>> GetGrantedPageIdsAsync(string userToken, CancellationToken ct = default);
        Task<FacebookPageAccount?> GetPageWithTokenAsync(string pageId, string userToken, CancellationToken ct = default);
        Task<FacebookPageInfo?> GetPageAsync(string pageId, string pageToken, CancellationToken ct = default);
        Task<FacebookList<FacebookApiVideo>> ListVideosAsync(string pageId, string pageToken, bool reels, string? after, int limit, CancellationToken ct = default);
        Task<FacebookList<FacebookApiPost>> ListPostsAsync(string pageId, string pageToken, string? after, int limit, CancellationToken ct = default);
    }

    public static class FacebookLimits
    {
        public const int PageSize = 100;
    }

    public class FacebookApiClient : IFacebookApiClient
    {
        public const string HttpClientName = "Facebook";

        private const string GraphHost = "https://graph.facebook.com";
        private const string DialogHost = "https://www.facebook.com";

        private const string VideoFields = "id,description,created_time,permalink_url,source,length,picture,thumbnails{uri,is_preferred,width}";
        private const string PostFields =
            "id,message,created_time,permalink_url," +
            "attachments{media_type,type,media,target{id},subattachments{media_type,type,media,target{id}}}";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
        };

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly FacebookOptions _options;
        private readonly ILogger<FacebookApiClient> _logger;

        public FacebookApiClient(IHttpClientFactory httpClientFactory, IOptions<FacebookOptions> options, ILogger<FacebookApiClient> logger)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
            _logger = logger;
        }

        private string Version => string.IsNullOrWhiteSpace(_options.ApiVersion) ? "" : "/" + _options.ApiVersion.Trim('/');
        private string Graph => GraphHost + Version;

        // تسجيل دخول فيسبوك للأعمال: config_id بدل scope (الصلاحيات والأصول محددة في "التكوين")
        public string BuildAuthorizeUrl(string state) =>
            DialogHost + Version + "/dialog/oauth"
            + "?client_id=" + Uri.EscapeDataString(_options.AppId)
            + "&redirect_uri=" + Uri.EscapeDataString(_options.RedirectUri)
            + "&state=" + Uri.EscapeDataString(state)
            + "&config_id=" + Uri.EscapeDataString(_options.ConfigId)
            + "&response_type=code"
            + "&override_default_response_type=true";

        // الكود صالح لمرة واحدة — لا يُعاد الطلب
        public async Task<FacebookTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default)
        {
            var url = Graph + "/oauth/access_token"
                      + "?client_id=" + Uri.EscapeDataString(_options.AppId)
                      + "&redirect_uri=" + Uri.EscapeDataString(_options.RedirectUri)
                      + "&client_secret=" + Uri.EscapeDataString(_options.AppSecret)
                      + "&code=" + Uri.EscapeDataString(code);
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(url, ct);
            return RequireToken(await ReadOrThrowAsync<FacebookTokenResponse>(response, "code exchange", ct));
        }

        public async Task<FacebookTokenResponse> ExchangeForLongLivedTokenAsync(string shortLivedToken, CancellationToken ct = default)
        {
            var url = Graph + "/oauth/access_token?grant_type=fb_exchange_token"
                      + "&client_id=" + Uri.EscapeDataString(_options.AppId)
                      + "&client_secret=" + Uri.EscapeDataString(_options.AppSecret)
                      + "&fb_exchange_token=" + Uri.EscapeDataString(shortLivedToken);
            using var response = await SendWithRetryAsync(url, "long-lived token", ct);
            return RequireToken(await ReadOrThrowAsync<FacebookTokenResponse>(response, "long-lived token", ct));
        }

        public async Task<FacebookUser?> GetMeAsync(string userToken, CancellationToken ct = default) =>
            await GetAsync<FacebookUser>("/me", "id,name", userToken, "me", ct);

        public async Task<List<string>> GetGrantedPermissionsAsync(string userToken, CancellationToken ct = default)
        {
            var list = await GetAsync<FacebookList<FacebookPermission>>("/me/permissions", null, userToken, "permissions", ct);
            return (list?.Data ?? new())
                .Where(p => p.Status == "granted" && !string.IsNullOrEmpty(p.Permission))
                .Select(p => p.Permission!)
                .ToList();
        }

        // الصفحات التي منحها المستخدم للتطبيق (يختارها في نافذة فيسبوك) مع توكن كل صفحة
        public async Task<List<FacebookPageAccount>> GetPagesAsync(string userToken, CancellationToken ct = default)
        {
            var pages = new List<FacebookPageAccount>();
            string? after = null;
            for (var i = 0; i < 5; i++)
            {
                var list = await GetAsync<FacebookList<FacebookPageAccount>>("/me/accounts", "id,name,access_token,picture{url}", userToken, "pages", ct,
                    extra: "&limit=100" + (after == null ? "" : "&after=" + Uri.EscapeDataString(after)));
                pages.AddRange(list?.Data ?? new());
                after = list?.NextCursor;
                if (after == null) break;
            }
            return pages;
        }

        public async Task<List<string>> GetGrantedPageIdsAsync(string userToken, CancellationToken ct = default)
        {
            var url = Graph + "/debug_token?input_token=" + Uri.EscapeDataString(userToken)
                      + "&access_token=" + Uri.EscapeDataString(_options.AppId + "|" + _options.AppSecret);
            using var response = await SendWithRetryAsync(url, "debug token", ct);
            var debug = await ReadOrThrowAsync<FacebookDebugTokenResponse>(response, "debug token", ct);
            return (debug?.Data?.GranularScopes ?? new())
                .Where(s => s.Scope is "pages_show_list" or "pages_read_engagement")
                .SelectMany(s => s.TargetIds ?? new())
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();
        }

        public Task<FacebookPageAccount?> GetPageWithTokenAsync(string pageId, string userToken, CancellationToken ct = default) =>
            GetAsync<FacebookPageAccount>("/" + Uri.EscapeDataString(pageId), "id,name,access_token,picture{url}", userToken, "page token", ct);

        public Task<FacebookPageInfo?> GetPageAsync(string pageId, string pageToken, CancellationToken ct = default) =>
            GetAsync<FacebookPageInfo>("/" + Uri.EscapeDataString(pageId),
                "id,name,username,link,followers_count,fan_count,picture.type(large){url}", pageToken, "page", ct);

        public async Task<FacebookList<FacebookApiVideo>> ListVideosAsync(string pageId, string pageToken, bool reels, string? after, int limit, CancellationToken ct = default) =>
            await GetAsync<FacebookList<FacebookApiVideo>>("/" + Uri.EscapeDataString(pageId) + (reels ? "/video_reels" : "/videos"),
                VideoFields, pageToken, reels ? "reels" : "videos", ct, extra: Paging(after, limit))
            ?? new FacebookList<FacebookApiVideo>();

        public async Task<FacebookList<FacebookApiPost>> ListPostsAsync(string pageId, string pageToken, string? after, int limit, CancellationToken ct = default) =>
            await GetAsync<FacebookList<FacebookApiPost>>("/" + Uri.EscapeDataString(pageId) + "/published_posts",
                PostFields, pageToken, "posts", ct, extra: Paging(after, limit))
            ?? new FacebookList<FacebookApiPost>();

        // ===================================
        // Helpers
        // ===================================
        private static string Paging(string? after, int limit) =>
            "&limit=" + Math.Clamp(limit, 1, FacebookLimits.PageSize)
            + (string.IsNullOrEmpty(after) ? "" : "&after=" + Uri.EscapeDataString(after));

        // appsecret_proof = HMAC-SHA256(التوكن، مفتاح التطبيق) — يمنع استخدام توكن مسروق دون المفتاح
        public static string AppSecretProof(string token, string appSecret) =>
            Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(appSecret), Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

        private async Task<T?> GetAsync<T>(string path, string? fields, string token, string operation, CancellationToken ct, string extra = "") where T : class
        {
            var url = Graph + path + "?access_token=" + Uri.EscapeDataString(token)
                      + "&appsecret_proof=" + AppSecretProof(token, _options.AppSecret)
                      + (fields == null ? "" : "&fields=" + Uri.EscapeDataString(fields))
                      + extra;
            using var response = await SendWithRetryAsync(url, operation, ct);
            return await ReadOrThrowAsync<T>(response, operation, ct);
        }

        private static FacebookTokenResponse RequireToken(FacebookTokenResponse? token) =>
            string.IsNullOrEmpty(token?.AccessToken)
                ? throw new FacebookApiException("تعذّر الحصول على إذن الوصول من فيسبوك", "empty_token")
                : token;

        // طلبات GET قراءة فقط: محاولة ثانية واحدة عند انقطاع الاتصال
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
                    _logger.LogWarning("Facebook {Operation} attempt {Attempt} failed ({Error}), retrying", operation, attempt, ex.GetType().Name);
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
                _logger.LogWarning("Facebook {Operation} returned invalid JSON ({Status})", operation, (int)response.StatusCode);
                throw new FacebookApiException($"رد غير صالح من فيسبوك ({operation})", "invalid_json");
            }
        }

        private FacebookApiException ToException(string body, HttpResponseMessage response, string operation)
        {
            InstagramGraphError? error = null;
            try { error = JsonSerializer.Deserialize<InstagramGraphErrorResponse>(body, JsonOptions)?.Error; }
            catch (JsonException) { }

            _logger.LogWarning("Facebook {Operation} failed ({Status}): {Code}/{Subcode} {Type} {Message} trace={TraceId}",
                operation, (int)response.StatusCode, error?.Code, error?.Subcode, error?.Type, error?.Message, error?.TraceId);

            // 190: التوكن غير صالح/منتهٍ/أُلغي. 10 و 200–299: صلاحية غير ممنوحة
            var requiresReconnect = error?.Code is 190 or 10 or >= 200 and <= 299
                                    || response.StatusCode == System.Net.HttpStatusCode.Unauthorized;
            var code = error?.Code is { } c ? c.ToString() : ((int)response.StatusCode).ToString();
            return new FacebookApiException($"فشل طلب فيسبوك ({operation})", code, requiresReconnect);
        }
    }
}
