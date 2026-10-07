using System.IdentityModel.Tokens.Jwt;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Data.Interceptors;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.AuthService;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    // الجلسات: توكن قصير + رمز تجديد يُدوَّر، وإبطال فوري عند تغيير الدور أو التفعيل أو كلمة المرور
    public class SessionSecurityTests : IDisposable
    {
        private readonly string _db = Guid.NewGuid().ToString();
        private readonly Mock<IUserSessionValidator> _sessions = new();
        private readonly AppDbContext _context;
        private readonly User _user;

        public SessionSecurityTests()
        {
            _context = NewContext();
            _user = new User { Phone = "07701234567", FullName = "زبون", Email = "", Role = UserRoles.Customer, PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret1"), IsActive = true };
            _context.Users.Add(_user);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        // نفس الـ interceptor المسجّل في التطبيق
        private AppDbContext NewContext() => new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(_db, o => o.EnableNullChecks(false))
            .AddInterceptors(new UserSessionInterceptor(_sessions.Object))
            .Options);

        private AuthService Auth(AppDbContext? context = null)
        {
            context ??= _context;
            return new AuthService(new UserRepository(context),
                Options.Create(new JwtSettings { Secret = new string('k', 64), Issuer = "i", Audience = "a", ExpirationInMinutes = 60, RefreshTokenDays = 30 }),
                new VendorRepository(context), Mock.Of<IPasswordResetOtpRepository>(), Mock.Of<ISmsSender>(),
                Mock.Of<INotificationService>(), new AuthThrottle(new MemoryCache(new MemoryCacheOptions())),
                new RefreshTokenRepository(context));
        }

        private Task<LoginResponseDto> Login() => Auth().LoginAsync(new LoginDto { Identifier = _user.Phone, Password = "secret1" });

        private static string VersionOf(string jwt) =>
            new JwtSecurityTokenHandler().ReadJwtToken(jwt).Claims.Single(c => c.Type == UserSessionValidator.VersionClaim).Value;

        // تغيير من «جهاز آخر» (سياق منفصل) كما يحدث في الخادم
        private async Task ChangeUser(Action<User> change)
        {
            await using var other = NewContext();
            var user = await other.Users.SingleAsync(u => u.Id == _user.Id);
            change(user);
            await other.SaveChangesAsync();
        }

        private async Task<int> StoredVersion()
        {
            await using var fresh = NewContext();
            return (await fresh.Users.AsNoTracking().SingleAsync(u => u.Id == _user.Id)).TokenVersion;
        }

        [Fact]
        public async Task Login_ReturnsShortTokenWithVersionAndRefreshToken()
        {
            var session = await Login();

            Assert.False(string.IsNullOrEmpty(session.RefreshToken));
            Assert.Equal("0", VersionOf(session.Token));
            Assert.InRange((session.ExpiresAt - DateTime.UtcNow).TotalMinutes, 59, 61);
            // الرمز لا يُخزَّن كما هو
            Assert.DoesNotContain(await _context.RefreshTokens.ToListAsync(), t => t.TokenHash == session.RefreshToken);
        }

        [Fact]
        public async Task Refresh_RotatesToken_OldOneStopsWorking()
        {
            var first = await Login();

            var second = await Auth().RefreshAsync(first.RefreshToken);

            Assert.NotEqual(first.RefreshToken, second.RefreshToken);
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(first.RefreshToken));
            // استعمال الرمز القديم خلال مهلة التدوير (تبويب ثانٍ) لا يُنهي الجلسة الجديدة
            Assert.NotNull(await Auth().RefreshAsync(second.RefreshToken));
        }

        [Fact]
        public async Task ReusingRotatedTokenLater_RevokesAllSessions()
        {
            var first = await Login();
            var second = await Auth().RefreshAsync(first.RefreshToken);
            var old = await _context.RefreshTokens.SingleAsync(t => t.ReplacedAt != null);
            old.ReplacedAt = DateTime.UtcNow.AddMinutes(-10);
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(first.RefreshToken));

            // نسخة مسروقة استُعملت — حتى الجلسة الحالية انتهت
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(second.RefreshToken));
        }

        [Fact]
        public async Task ExpiredOrUnknownRefreshToken_IsRejected()
        {
            var session = await Login();
            var stored = await _context.RefreshTokens.SingleAsync();
            stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(session.RefreshToken));
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync("not-a-token"));
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(null));
        }

        [Fact]
        public async Task Logout_RevokesThisDevicesRefreshToken()
        {
            var session = await Login();

            await Auth().LogoutAsync(session.RefreshToken);

            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(session.RefreshToken));
        }

        [Fact]
        public async Task ChangePassword_EndsOtherSessions_AndReturnsNewOne()
        {
            var otherDevice = await Login();

            var current = await Auth().ChangePasswordAsync(_user.Id, new ChangePasswordDto { CurrentPassword = "secret1", NewPassword = "secret2" });

            Assert.Equal(1, await StoredVersion());
            Assert.Equal("1", VersionOf(current.Token));
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth().RefreshAsync(otherDevice.RefreshToken));
            Assert.NotNull(await Auth().RefreshAsync(current.RefreshToken));
            _sessions.Verify(s => s.Invalidate(_user.Id), Times.AtLeastOnce);
        }

        [Fact]
        public async Task DeactivatingAccount_BumpsVersionAndBlocksRefresh()
        {
            var session = await Login();

            await ChangeUser(u => u.IsActive = false);

            Assert.Equal(1, await StoredVersion());
            await Assert.ThrowsAsync<UnauthorizedException>(() => Auth(NewContext()).RefreshAsync(session.RefreshToken));
        }

        [Fact]
        public async Task RoleChange_BumpsVersion_ButRefreshIssuesTokenWithNewRole()
        {
            var session = await Login();

            await ChangeUser(u => u.Role = UserRoles.Vendor);

            Assert.Equal(1, await StoredVersion());
            var renewed = await Auth(NewContext()).RefreshAsync(session.RefreshToken);
            Assert.Equal(UserRoles.Vendor, renewed.Role);
            Assert.Equal("1", VersionOf(renewed.Token));
        }

        [Fact]
        public async Task UnrelatedUpdate_DoesNotEndSessions()
        {
            await Login();   // يحدّث LastLogin

            await ChangeUser(u => u.FullName = "اسم جديد");

            Assert.Equal(0, await StoredVersion());
        }
    }

    // التحقق مع كل طلب: الحساب مفعّل ونسخة التوكن هي الحالية
    public class UserSessionValidatorTests
    {
        private readonly ServiceProvider _provider;
        private readonly User _user = new() { Phone = "0770", FullName = "u", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true, TokenVersion = 2 };

        public UserSessionValidatorTests()
        {
            var db = Guid.NewGuid().ToString();
            _provider = new ServiceCollection()
                .AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(db, x => x.EnableNullChecks(false)))
                .AddMemoryCache()
                .AddSingleton<IUserSessionValidator, UserSessionValidator>()
                .BuildServiceProvider();
            using var scope = _provider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            context.Users.Add(_user);
            context.SaveChanges();
        }

        private IUserSessionValidator Validator => _provider.GetRequiredService<IUserSessionValidator>();

        private async Task Update(Action<User> change)
        {
            using var scope = _provider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            change(await context.Users.SingleAsync());
            await context.SaveChangesAsync();
        }

        [Fact]
        public async Task CurrentVersion_IsAccepted_OldVersionIsRejected()
        {
            Assert.True(await Validator.IsCurrentAsync(_user.Id, 2));
            Assert.False(await Validator.IsCurrentAsync(_user.Id, 1));
            Assert.False(await Validator.IsCurrentAsync(Guid.NewGuid(), 0));
        }

        [Fact]
        public async Task Invalidate_PicksUpChangeImmediately()
        {
            Assert.True(await Validator.IsCurrentAsync(_user.Id, 2));

            await Update(u => u.IsActive = false);
            Validator.Invalidate(_user.Id);

            Assert.False(await Validator.IsCurrentAsync(_user.Id, 2));
        }
    }

    // طلب الإرجاع: الزبون يرى طلباته فقط
    public class ReturnAccessTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly User _owner = new() { Phone = "0770", FullName = "صاحب", Role = UserRoles.Customer, PasswordHash = "x" };
        private readonly Return _return;

        public ReturnAccessTests()
        {
            var order = new Order { OrderNumber = "ORD-1", CustomerId = _owner.Id };
            _return = new Return { ReturnNumber = "RET-1", OrderId = order.Id, CustomerId = _owner.Id, Status = ReturnStatus.PENDING, Reason = "damaged" };
            _context.AddRange(_owner, order, _return);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private ReturnService Service() => new(new ReturnRepository(_context), Mock.Of<IFileService>(), _context, Mock.Of<INotificationService>());

        [Fact]
        public async Task Owner_CanView() =>
            Assert.Equal("RET-1", (await Service().GetForViewerAsync(_return.Id, _owner.Id, isStaff: false)).ReturnNumber);

        [Fact]
        public async Task OtherCustomer_GetsNotFound() =>
            await Assert.ThrowsAsync<NotFoundException>(() => Service().GetForViewerAsync(_return.Id, Guid.NewGuid(), isStaff: false));

        [Fact]
        public async Task Staff_CanViewAny() =>
            Assert.NotNull(await Service().GetForViewerAsync(_return.Id, Guid.NewGuid(), isStaff: true));
    }
}
