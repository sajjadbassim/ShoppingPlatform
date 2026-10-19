using System.Net;
using System.Text.Json;
using ecommerce.Services.SmsService;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    // رمز إعادة التعيين عبر واتساب: رمزنا يُرسل بوضع provided والرقم بصيغة +964
    public class WevlixOtpSenderTests
    {
        private class CaptureHandler : HttpMessageHandler
        {
            public HttpRequestMessage? Request;
            public string? Body;
            public HttpStatusCode Status = HttpStatusCode.OK;

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            {
                Request = request;
                Body = await request.Content!.ReadAsStringAsync(ct);
                return new HttpResponseMessage(Status) { Content = new StringContent("{}") };
            }
        }

        private static WevlixOtpSender Sender(CaptureHandler handler)
        {
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient(WevlixOtpSender.HttpClientName)).Returns(new HttpClient(handler));
            return new WevlixOtpSender(factory.Object,
                Options.Create(new WevlixOptions { ApiKey = "test-key", BaseUrl = "https://api.test/" }),
                NullLogger<WevlixOtpSender>.Instance);
        }

        [Theory]
        [InlineData("07701234567", "+9647701234567")]
        [InlineData("+9647701234567", "+9647701234567")]
        [InlineData("9647701234567", "+9647701234567")]
        public void Phone_ToE164(string phone, string expected) =>
            Assert.Equal(expected, WevlixOtpSender.ToE164(phone));

        [Fact]
        public async Task Sends_ProvidedCode_WithApiKey()
        {
            var handler = new CaptureHandler();
            await Sender(handler).SendNowAsync("07701234567", "482913");

            Assert.Equal("https://api.test/v1/otp/send", handler.Request!.RequestUri!.ToString());
            Assert.Equal("test-key", handler.Request.Headers.GetValues("X-API-Key").Single());
            var body = JsonDocument.Parse(handler.Body!).RootElement;
            Assert.Equal("+9647701234567", body.GetProperty("to").GetString());
            Assert.Equal("provided", body.GetProperty("otpMode").GetString());
            Assert.Equal("482913", body.GetProperty("code").GetString());
            Assert.Equal("IQ", body.GetProperty("countryIso2").GetString());
        }

        [Fact]
        public async Task ProviderError_IsLogged_NotThrown()
        {
            var handler = new CaptureHandler { Status = HttpStatusCode.Forbidden };
            await Sender(handler).SendNowAsync("07701234567", "482913");   // لا استثناء
        }
    }
}
