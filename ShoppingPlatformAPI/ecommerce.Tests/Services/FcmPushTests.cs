using System.Net;
using System.Security.Claims;
using System.Text.Json;
using ecommerce.Controllers;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.PushService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class FcmPushTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly string _credFile = Path.GetTempFileName();

        public void Dispose()
        {
            _context.Dispose();
            File.Delete(_credFile);
        }

        // ===== FcmSender =====

        private class FakeAuth : IFcmAuth
        {
            public Task<(string AccessToken, string ProjectId)> GetAsync(CancellationToken ct) => Task.FromResult(("tok", "proj"));
        }

        private class FakeHandler : HttpMessageHandler
        {
            public readonly List<(HttpRequestMessage Request, string Body)> Calls = new();
            public Func<string, HttpResponseMessage> Respond = _ => new HttpResponseMessage(HttpStatusCode.OK);

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            {
                var body = request.Content == null ? "" : await request.Content.ReadAsStringAsync(ct);
                Calls.Add((request, body));
                return Respond(body);
            }
        }

        private (FcmSender Sender, FakeHandler Handler) Sender(bool configured = true)
        {
            var handler = new FakeHandler();
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(f => f.CreateClient("fcm")).Returns(new HttpClient(handler));
            var options = Options.Create(new FirebaseOptions { CredentialsPath = configured ? _credFile : null });
            return (new FcmSender(options, new FakeAuth(), factory.Object, NullLogger<FcmSender>.Instance), handler);
        }

        private static FcmMessage Msg() => new("واسط", "تم تأكيد طلبك", new Dictionary<string, string> { ["url"] = "/orders/1" });

        [Fact]
        public async Task Send_NotConfigured_DoesNothing()
        {
            var (sender, handler) = Sender(configured: false);
            Assert.False(sender.IsConfigured);
            Assert.Empty(await sender.SendAsync(new[] { "t1" }, Msg()));
            Assert.Empty(handler.Calls);
        }

        [Fact]
        public async Task Send_PostsV1Message_WithBearerAndPayload()
        {
            var (sender, handler) = Sender();
            var invalid = await sender.SendAsync(new[] { "t1" }, Msg());

            Assert.Empty(invalid);
            var call = Assert.Single(handler.Calls);
            Assert.Equal("https://fcm.googleapis.com/v1/projects/proj/messages:send", call.Request.RequestUri!.ToString());
            Assert.Equal("Bearer", call.Request.Headers.Authorization!.Scheme);
            Assert.Equal("tok", call.Request.Headers.Authorization.Parameter);
            using var doc = JsonDocument.Parse(call.Body);
            var message = doc.RootElement.GetProperty("message");
            Assert.Equal("t1", message.GetProperty("token").GetString());
            Assert.Equal("تم تأكيد طلبك", message.GetProperty("notification").GetProperty("body").GetString());
            Assert.Equal("/orders/1", message.GetProperty("data").GetProperty("url").GetString());
            Assert.Equal("default", message.GetProperty("android").GetProperty("notification").GetProperty("channel_id").GetString());   // قناة الإشعارات المنبثقة
        }

        [Fact]
        public async Task Send_ReturnsOnlyPermanentlyInvalidTokens()
        {
            var (sender, handler) = Sender();
            handler.Respond = body => body.Contains("\"dead\"") ? new HttpResponseMessage(HttpStatusCode.NotFound)
                : body.Contains("\"bad\"") ? new HttpResponseMessage(HttpStatusCode.BadRequest)
                    { Content = new StringContent("{\"error\":{\"status\":\"INVALID_ARGUMENT\",\"message\":\"The registration token is not a valid FCM registration token\"}}") }
                : body.Contains("\"flaky\"") ? new HttpResponseMessage(HttpStatusCode.InternalServerError)
                : new HttpResponseMessage(HttpStatusCode.OK);

            var invalid = await sender.SendAsync(new[] { "ok", "dead", "bad", "flaky" }, Msg());

            Assert.Equal(new[] { "dead", "bad" }, invalid);   // الخطأ المؤقت (500) لا يحذف الرمز
        }

        // ===== تسجيل الأجهزة =====

        private PushController Controller(Guid userId) => new(_context, Options.Create(new PushOptions()), Mock.Of<IPushQueue>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "test")),
                },
            },
        };

        [Fact]
        public async Task RegisterDevice_AddsToken_ThenMovesItToAnotherAccount()
        {
            var a = Guid.NewGuid();
            var b = Guid.NewGuid();

            Assert.IsType<OkObjectResult>(await Controller(a).RegisterDevice(new DeviceTokenDto { Token = "t1", Platform = "Android", App = "customer" }));
            Assert.IsType<OkObjectResult>(await Controller(b).RegisterDevice(new DeviceTokenDto { Token = "t1", Platform = "android", App = "customer" }));

            var saved = Assert.Single(_context.DeviceTokens);
            Assert.Equal(b, saved.UserId);            // هاتف واحد، حساب واحد: ينتقل الرمز لمن سجّل الدخول آخراً
            Assert.Equal("android", saved.Platform);
        }

        [Fact]
        public async Task RegisterDevice_AcceptsSellerApp()
        {
            var user = Guid.NewGuid();

            Assert.IsType<OkObjectResult>(await Controller(user).RegisterDevice(new DeviceTokenDto { Token = "seller-t", Platform = "android", App = "seller" }));

            var saved = Assert.Single(_context.DeviceTokens);
            Assert.Equal(user, saved.UserId);
            Assert.Equal("seller", saved.App);
        }

        [Theory]
        [InlineData("windows", "customer")]
        [InlineData("android", "admin")]
        public async Task RegisterDevice_RejectsUnknownPlatformOrApp(string platform, string app)
        {
            var result = await Controller(Guid.NewGuid()).RegisterDevice(new DeviceTokenDto { Token = "t", Platform = platform, App = app });
            Assert.IsType<BadRequestObjectResult>(result);
            Assert.Empty(_context.DeviceTokens);
        }
    }
}
