using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.AuthService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    // التحقق من رقم الهاتف قبل ربطه بحساب: رمز ← رمز إثبات ← تسجيل/إضافة رقم (مرة واحدة)
    public class PhoneVerificationTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly AuthThrottle _throttle = new(new MemoryCache(new MemoryCacheOptions()));
        private readonly Mock<IOtpSender> _sender = new();

        public void Dispose() => _context.Dispose();

        private PhoneVerificationService Verification() => new(_context, _sender.Object, _throttle);

        private AuthService Auth() => new(
            new UserRepository(_context),
            Options.Create(new JwtSettings { Secret = new string('k', 64), Issuer = "i", Audience = "a", ExpirationInMinutes = 60 }),
            new VendorRepository(_context),
            Mock.Of<IPasswordResetOtpRepository>(),
            _sender.Object,
            Mock.Of<INotificationService>(),
            _throttle,
            new RefreshTokenRepository(_context),
            phoneVerification: Verification());

        private static RegisterDto Dto(string? token, string phone = "07701234567") => new()
        {
            Phone = phone, Email = "ali@mail.com", Password = "secret1", FullName = "علي حسن", PhoneVerificationToken = token,
        };

        private async Task<string> VerifiedToken(string phone = "07701234567")
        {
            var code = await Verification().SendCodeAsync(phone);
            return await Verification().VerifyCodeAsync(phone, code);
        }

        [Fact]
        public async Task SendCode_DeliversCodeToNormalizedPhone()
        {
            var code = await Verification().SendCodeAsync("+964 770 123 4567");
            _sender.Verify(s => s.SendCodeAsync("07701234567", code, It.IsAny<CancellationToken>()), Times.Once);
            Assert.Matches(@"^\d{6}$", code);
        }

        [Fact]
        public async Task Register_WithoutToken_IsRejected_BeforeRevealingDuplicates()
        {
            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Auth().RegisterAsync(Dto(null)));
            Assert.Equal(PhoneVerificationService.NotVerified, ex.Message);
            Assert.Empty(_context.Users);
        }

        [Fact]
        public async Task Register_WithVerifiedToken_Works_Once()
        {
            var token = await VerifiedToken();
            var session = await Auth().RegisterAsync(Dto(token));
            Assert.Equal("07701234567", session.Phone);

            // نفس رمز الإثبات لا يُستعمل مرة ثانية
            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
                Auth().RegisterAsync(Dto(token)));
            Assert.Equal(PhoneVerificationService.NotVerified, ex.Message);
        }

        [Fact]
        public async Task Token_ForAnotherPhone_IsRejected()
        {
            var token = await VerifiedToken("07701234567");
            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Auth().RegisterAsync(Dto(token, "07801234567")));
            Assert.Equal(PhoneVerificationService.NotVerified, ex.Message);
        }

        [Fact]
        public async Task WrongCode_CountsAttempts_ThenLocks()
        {
            var code = await Verification().SendCodeAsync("07701234567");
            var wrong = code == "111111" ? "222222" : "111111";
            for (var i = 0; i < PhoneVerificationService.MaxAttempts; i++)
                await Assert.ThrowsAsync<BusinessRuleException>(() => Verification().VerifyCodeAsync("07701234567", wrong));

            // حتى الرمز الصحيح يُرفض بعد استنفاد المحاولات
            await Assert.ThrowsAsync<BusinessRuleException>(() => Verification().VerifyCodeAsync("07701234567", code));
        }

        [Fact]
        public async Task NewCode_InvalidatesPreviousOne()
        {
            var first = await Verification().SendCodeAsync("07701234567");
            var second = await Verification().SendCodeAsync("07701234567");
            if (first != second)
                await Assert.ThrowsAsync<BusinessRuleException>(() => Verification().VerifyCodeAsync("07701234567", first));
            Assert.NotNull(await Verification().VerifyCodeAsync("07701234567", second));
        }
    }
}
