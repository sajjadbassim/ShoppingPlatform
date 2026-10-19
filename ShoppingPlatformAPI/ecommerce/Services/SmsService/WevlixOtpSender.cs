using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.SmsService
{
    public class WevlixOptions
    {
        public const string SectionName = "Wevlix";

        public string BaseUrl { get; set; } = "https://api.wevlix.com";

        // مفتاح المشروع (X-API-Key) — في user-secrets أو متغير بيئة Wevlix__ApiKey، لا في appsettings
        public string ApiKey { get; set; } = "";

        // لغة قالب AUTHENTICATION المفضّلة في واتساب
        public string Locale { get; set; } = "ar";

        public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
    }

    /// <summary>
    /// رمز التحقق عبر واتساب (Wevlix OTP، وضع provided): POST /v1/otp/send مع رمزنا.
    /// Wevlix يختار قالب AUTHENTICATION المعتمد في حساب واتساب المشروع.
    /// </summary>
    public class WevlixOtpSender : IOtpSender
    {
        public const string HttpClientName = "wevlix";

        private readonly IHttpClientFactory _http;
        private readonly WevlixOptions _options;
        private readonly ILogger<WevlixOtpSender> _logger;

        public WevlixOtpSender(IHttpClientFactory http, IOptions<WevlixOptions> options, ILogger<WevlixOtpSender> logger)
        {
            _http = http;
            _options = options.Value;
            _logger = logger;
        }

        // 07XXXXXXXXX ← +9647XXXXXXXXX (الصيغة الدولية E.164 التي يطلبها Wevlix)
        public static string ToE164(string phone) =>
            phone.StartsWith('0') ? "+964" + phone[1..] : phone.StartsWith('+') ? phone : "+" + phone;

        // لا ننتظر Wevlix: زمن الرد على «نسيت كلمة المرور» يجب ألا يكشف أن الرقم مسجّل (المسجّل وحده يُرسل له)
        public Task SendCodeAsync(string phone, string code, CancellationToken ct = default)
        {
            _ = Task.Run(() => SendNowAsync(phone, code, CancellationToken.None), CancellationToken.None);
            return Task.CompletedTask;
        }

        public async Task SendNowAsync(string phone, string code, CancellationToken ct = default)
        {
            var client = _http.CreateClient(HttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl.TrimEnd('/')}/v1/otp/send")
            {
                Content = JsonContent.Create(new
                {
                    to = ToE164(phone),
                    otpMode = "provided",
                    code,
                    locale = _options.Locale,
                    countryIso2 = "IQ",
                    // إعادة نفس الطلب (انقطاع ثم إعادة) لا تُرسل رسالتين
                    clientMessageId = $"reset_{Guid.NewGuid():N}",
                })
            };
            request.Headers.Add("X-API-Key", _options.ApiKey);

            try
            {
                using var response = await client.SendAsync(request, ct);
                var body = await response.Content.ReadAsStringAsync(ct);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Wevlix OTP فشل الإرسال إلى {Phone}: {Status} {Body}",
                        phone, (int)response.StatusCode, body.Length > 500 ? body[..500] : body);
                    return;
                }
                // messageId و simulated (Sandbox) للمتابعة في Message Logs عند Wevlix
                using var json = System.Text.Json.JsonDocument.Parse(body);
                var data = json.RootElement.TryGetProperty("data", out var d) ? d : json.RootElement;
                _logger.LogInformation("Wevlix OTP أُرسل إلى {Phone}: messageId={MessageId} simulated={Simulated}", phone,
                    data.TryGetProperty("messageId", out var id) ? id.GetString() : "?",
                    data.TryGetProperty("simulated", out var sim) && sim.ValueKind == System.Text.Json.JsonValueKind.True);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Wevlix OTP تعذّر الاتصال لإرسال الرمز إلى {Phone}", phone);
            }
        }
    }
}
