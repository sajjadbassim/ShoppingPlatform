using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.PushService
{
    // مسار ملف مفتاح حساب الخدمة من Firebase — خارج المشروع دائماً (user-secrets أو متغير بيئة Firebase__CredentialsPath)
    public class FirebaseOptions
    {
        public const string Section = "Firebase";
        public string? CredentialsPath { get; set; }
        public bool IsConfigured => !string.IsNullOrWhiteSpace(CredentialsPath) && File.Exists(CredentialsPath);
    }

    public record FcmMessage(string Title, string Body, IReadOnlyDictionary<string, string> Data);

    public interface IFcmSender
    {
        bool IsConfigured { get; }
        // يرسل لكل رمز ويعيد الرموز التي رفضها Firebase نهائياً (حُذف التطبيق/انتهى الرمز) لنحذفها
        Task<IReadOnlyList<string>> SendAsync(IReadOnlyCollection<string> tokens, FcmMessage message, CancellationToken ct = default);
    }

    // رمز الوصول ومعرّف المشروع (يُستبدل في الاختبارات)
    public interface IFcmAuth
    {
        Task<(string AccessToken, string ProjectId)> GetAsync(CancellationToken ct);
    }

    public class GoogleFcmAuth : IFcmAuth
    {
        private const string Scope = "https://www.googleapis.com/auth/firebase.messaging";
        private readonly Lazy<(GoogleCredential Credential, string ProjectId)> _auth;

        public GoogleFcmAuth(IOptions<FirebaseOptions> options)
        {
            var configured = options.Value;
            _auth = new Lazy<(GoogleCredential, string)>(() =>
            {
                var path = configured.CredentialsPath!;
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                return (GoogleCredential.FromFile(path).CreateScoped(Scope), doc.RootElement.GetProperty("project_id").GetString()!);
            });
        }

        public async Task<(string AccessToken, string ProjectId)> GetAsync(CancellationToken ct)
        {
            var (credential, projectId) = _auth.Value;
            return (await credential.UnderlyingCredential.GetAccessTokenForRequestAsync(cancellationToken: ct), projectId);
        }
    }

    // FCM HTTP v1 مباشرة عبر Google.Apis.Auth (موجودة أصلاً) دون حزمة Firebase Admin
    public class FcmSender : IFcmSender
    {
        // يجب أن يطابق معرّف القناة في تطبيقات الموبايل (pushNotifications.ts)
        public const string AndroidChannelId = "default";

        private readonly FirebaseOptions _options;
        private readonly IFcmAuth _auth;
        private readonly IHttpClientFactory _http;
        private readonly ILogger<FcmSender> _logger;

        public FcmSender(IOptions<FirebaseOptions> options, IFcmAuth auth, IHttpClientFactory http, ILogger<FcmSender> logger)
        {
            _options = options.Value;
            _auth = auth;
            _http = http;
            _logger = logger;
        }

        public bool IsConfigured => _options.IsConfigured;

        public async Task<IReadOnlyList<string>> SendAsync(IReadOnlyCollection<string> tokens, FcmMessage message, CancellationToken ct = default)
        {
            var invalid = new List<string>();
            if (!IsConfigured || tokens.Count == 0) return invalid;

            var (accessToken, projectId) = await _auth.GetAsync(ct);
            var url = $"https://fcm.googleapis.com/v1/projects/{projectId}/messages:send";
            var client = _http.CreateClient("fcm");

            foreach (var token in tokens)
            {
                var body = JsonSerializer.Serialize(new
                {
                    message = new
                    {
                        token,
                        notification = new { title = message.Title, body = message.Body },
                        data = message.Data,
                        // القناة «default» تنشئها التطبيقات بأهمية عالية (إشعار منبثق)؛ بدونها تذهب الرسالة لقناة Firebase الافتراضية الهادئة
                        android = new { priority = "HIGH", notification = new { channel_id = AndroidChannelId } },
                    },
                });

                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json"),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                try
                {
                    using var response = await client.SendAsync(request, ct);
                    if (response.IsSuccessStatusCode) continue;

                    var error = await response.Content.ReadAsStringAsync(ct);
                    // 404 UNREGISTERED = الرمز لم يعد صالحاً؛ 400 INVALID_ARGUMENT مع «registration token» = رمز مشوّه
                    if (response.StatusCode == HttpStatusCode.NotFound
                        || (response.StatusCode == HttpStatusCode.BadRequest
                            && error.Contains("INVALID_ARGUMENT", StringComparison.Ordinal)
                            && error.Contains("registration token", StringComparison.OrdinalIgnoreCase)))
                        invalid.Add(token);
                    else
                        _logger.LogWarning("رفضت FCM الإشعار ({Status})", (int)response.StatusCode);
                }
                catch (Exception ex) when ((ex is HttpRequestException || ex is TaskCanceledException) && !ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "تعذّر الاتصال بـ FCM");
                }
            }
            return invalid;
        }
    }
}
