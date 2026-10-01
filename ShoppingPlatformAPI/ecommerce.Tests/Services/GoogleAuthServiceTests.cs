using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.AuthService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Moq;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class GoogleAuthServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly JwtSettings _jwt = new() { Secret = new string('k', 64), Issuer = "ShoppingPlatformAPI", Audience = "ShoppingPlatformClients", ExpirationInMinutes = 60 };

        // بطاقات Google وهمية: "good-<sub>" صالحة، "unverified" بريدها غير موثّق، غيرها مرفوضة
        private class FakeValidator : IGoogleTokenValidator
        {
            public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string credential, string clientId)
            {
                if (credential == "unverified")
                    return Task.FromResult(new GoogleJsonWebSignature.Payload { Subject = "u1", Email = "x@gmail.com", EmailVerified = false });
                if (!credential.StartsWith("good-")) throw new InvalidJwtException("bad");
                var sub = credential[5..];
                return Task.FromResult(new GoogleJsonWebSignature.Payload { Subject = sub, Email = $"{sub}@gmail.com", EmailVerified = true, Name = "زبون Google" });
            }
        }

        public void Dispose() => _context.Dispose();

        private GoogleAuthService Service()
        {
            var auth = new AuthService(new UserRepository(_context), Options.Create(_jwt), new VendorRepository(_context),
                Mock.Of<IPasswordResetOtpRepository>(), Mock.Of<ISmsSender>(), Mock.Of<INotificationService>(),
                new AuthThrottle(new MemoryCache(new MemoryCacheOptions())));
            return new GoogleAuthService(_context, auth, new FakeValidator(),
                Options.Create(new GoogleOptions { ClientId = "client" }), Options.Create(_jwt));
        }

        private User AddUser(string role, string phone, bool hasPassword = true)
        {
            var u = new User { Phone = phone, FullName = "مستخدم", Email = "", Role = role, PasswordHash = "x", HasPassword = hasPassword, IsActive = true };
            _context.Users.Add(u); _context.SaveChanges();
            return u;
        }

        [Fact]
        public async Task FirstTime_CreatesCustomerImmediately_WithoutPhone_ThenOneTap()
        {
            var first = await Service().SignInAsync("good-g1");
            Assert.Equal("ok", first.Status);
            Assert.Equal(UserRoles.Customer, first.Login!.Role);

            var user = await _context.Users.SingleAsync();
            Assert.Null(user.Phone);                       // الهاتف يُطلب عند أول إتمام طلب
            Assert.Equal("g1@gmail.com", user.Email);
            Assert.Equal("g1", user.GoogleId);
            Assert.False(user.HasPassword);

            var again = await Service().SignInAsync("good-g1");
            Assert.Equal(user.Id, again.Login!.UserId);
            Assert.Equal(1, await _context.Users.CountAsync());
        }

        [Fact]
        public async Task EmailOfAnotherAccount_GetsNeutralMessage_AndNoAutoLink()
        {
            var existing = AddUser(UserRoles.Customer, "07701234567");
            existing.Email = "G2@gmail.com"; _context.SaveChanges();

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SignInAsync("good-g2"));
            Assert.Equal(GoogleAuthService.EmailUnavailableMessage, ex.Message);
            Assert.Null((await _context.Users.SingleAsync()).GoogleId);   // لم يُربط تلقائياً
        }

        [Fact]
        public async Task InvalidOrUnverifiedGoogleCard_IsRejected()
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SignInAsync("forged"));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SignInAsync("unverified"));
        }

        [Fact]
        public async Task DisabledAccount_CannotSignInWithGoogle()
        {
            var u = AddUser(UserRoles.Customer, "07701234567");
            u.GoogleId = "g4"; u.IsActive = false; _context.SaveChanges();
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SignInAsync("good-g4"));
        }

        [Theory]
        [InlineData("VENDOR")]
        [InlineData("ADMIN")]
        [InlineData("OPS")]
        [InlineData("DRIVER")]
        public async Task OnlyCustomers_CanLink(string role)
        {
            var u = AddUser(role, "07701234567");
            await Assert.ThrowsAsync<ForbiddenException>(() => Service().LinkAsync(u.Id, "good-g5"));
        }

        [Fact]
        public async Task Link_OneGoogleAccountPerUser_AndUnlinkNeedsPassword()
        {
            var a = AddUser(UserRoles.Customer, "07701234567");
            var b = AddUser(UserRoles.Customer, "07701234568", hasPassword: false);

            var status = await Service().LinkAsync(a.Id, "good-g6");
            Assert.True(status.Linked);
            Assert.Equal("g6@gmail.com", status.GoogleEmail);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().LinkAsync(b.Id, "good-g6"));

            await Service().LinkAsync(b.Id, "good-g7");
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().UnlinkAsync(b.Id));   // بلا كلمة مرور
            Assert.False((await Service().UnlinkAsync(a.Id)).Linked);
        }
    }
}
