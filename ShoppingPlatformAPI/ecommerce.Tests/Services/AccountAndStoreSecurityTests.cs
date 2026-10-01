using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.AuthService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using ecommerce.Services.VendorService.VendorService;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    // إصلاحات التدقيق: إنشاء الحساب وإنشاء المتجر
    public class AccountAndStoreSecurityTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly AuthThrottle _throttle = new(new MemoryCache(new MemoryCacheOptions()));

        public void Dispose() => _context.Dispose();

        private AuthService Auth() => new(
            new UserRepository(_context),
            Options.Create(new JwtSettings { Secret = new string('k', 64), Issuer = "i", Audience = "a", ExpirationInMinutes = 60 }),
            new VendorRepository(_context),
            Mock.Of<IPasswordResetOtpRepository>(),
            Mock.Of<ISmsSender>(),
            Mock.Of<INotificationService>(),
            _throttle);

        private VendorService Vendors() => new(
            new VendorRepository(_context), Mock.Of<ecommerce.Services.FileService.IFileService>(),
            Mock.Of<INotificationService>(), new ProductRepository(_context), new UserRepository(_context));

        private User AddUser(string role, string phone = "07801111111")
        {
            var u = new User { Phone = phone, FullName = "مستخدم", Role = role, PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret1"), IsActive = true };
            _context.Users.Add(u); _context.SaveChanges();
            return u;
        }

        // ===== رقم الهاتف =====
        [Theory]
        [InlineData("07701234567", "07701234567")]
        [InlineData("0770 123 4567", "07701234567")]
        [InlineData("+964 770 123 4567", "07701234567")]
        [InlineData("009647701234567", "07701234567")]
        [InlineData("7701234567", "07701234567")]
        [InlineData("0770-123-4567", "07701234567")]
        [InlineData("07201234567", null)]   // ليس رقماً عراقياً صالحاً
        [InlineData("0770123456", null)]    // ناقص
        [InlineData("abc", null)]
        public void Phone_IsNormalized(string input, string? expected) =>
            Assert.Equal(expected, PhoneNumber.Normalize(input));

        [Fact]
        public async Task Register_SameNumberInAnotherFormat_IsRejected()
        {
            var r = await Auth().RegisterAsync(new RegisterDto { Phone = "+964 770 123 4567", Email = " Ahmed@Mail.com ", Password = "secret1", FullName = "  أحمد علي  " });
            Assert.Equal("07701234567", r.Phone);
            Assert.Equal("أحمد علي", r.FullName);
            Assert.Equal("ahmed@mail.com", (await _context.Users.SingleAsync()).Email);   // الإيميل بصيغة واحدة

            var ex = await Assert.ThrowsAsync<Exception>(() => Auth().RegisterAsync(new RegisterDto { Phone = "07701234567", Email = "other@mail.com", Password = "secret1", FullName = "آخر" }));
            Assert.Equal(AuthService.PhoneUnavailable, ex.Message);
        }

        [Fact]
        public async Task Register_RejectsInvalidPhoneAndBlankName()
        {
            await Assert.ThrowsAsync<Exception>(() => Auth().RegisterAsync(new RegisterDto { Phone = "12345", Email = "a@mail.com", Password = "secret1", FullName = "أحمد" }));
            await Assert.ThrowsAsync<Exception>(() => Auth().RegisterAsync(new RegisterDto { Phone = "07701234567", Email = "a@mail.com", Password = "secret1", FullName = "   " }));
            Assert.Empty(_context.Users);
        }

        [Fact]
        public async Task Login_AcceptsOtherFormat_AndLocksAfterFiveFailures()
        {
            AddUser(UserRoles.Customer, "07701234567");
            Assert.NotNull(await Auth().LoginAsync(new LoginDto { Phone = "+9647701234567", Password = "secret1" }));

            for (var i = 0; i < AuthThrottle.MaxLoginFailures; i++)
                await Assert.ThrowsAsync<Exception>(() => Auth().LoginAsync(new LoginDto { Phone = "07701234567", Password = "wrong" }));

            // حتى كلمة المرور الصحيحة مرفوضة أثناء الإيقاف
            var locked = await Assert.ThrowsAsync<Exception>(() => Auth().LoginAsync(new LoginDto { Phone = "07701234567", Password = "secret1" }));
            Assert.Contains("محاولات دخول خاطئة كثيرة", locked.Message);
        }

        [Fact]
        public async Task ForgotPassword_SameAnswerForUnknownNumber_AndLimited()
        {
            // رقم غير مسجل: لا خطأ يكشف ذلك
            await Auth().ForgotPasswordAsync(new ForgotPasswordDto { Phone = "07709999999" });
            await Auth().ForgotPasswordAsync(new ForgotPasswordDto { Phone = "07709999999" });
            await Auth().ForgotPasswordAsync(new ForgotPasswordDto { Phone = "07709999999" });
            await Assert.ThrowsAsync<Exception>(() => Auth().ForgotPasswordAsync(new ForgotPasswordDto { Phone = "07709999999" }));
        }

        // ===== المتجر =====
        private static VendorCreateDto Store(string name, bool active = true) =>
            new() { Name = name, NameAr = name + " عربي", Phone = "0780", Address = "الكوت", Description = "d", IsActive = active };

        [Fact]
        public async Task CustomerStore_IsAlwaysPending_AndOnlyOne()
        {
            var customer = AddUser(UserRoles.Customer);
            var created = await Vendors().CreateAsync(Store("Shop A", active: true), customer.Id);
            Assert.False(created.IsActive);   // طلب التفعيل من المتصفح يُتجاهل

            var second = await Assert.ThrowsAsync<Exception>(() => Vendors().CreateAsync(Store("Shop B"), customer.Id));
            Assert.Contains("مسبقاً", second.Message);
        }

        [Theory]
        [InlineData("VENDOR")]
        [InlineData("OPS")]
        [InlineData("DRIVER")]
        public async Task NonCustomer_CannotOpenStore(string role)
        {
            var user = AddUser(role);
            await Assert.ThrowsAsync<ForbiddenException>(() => Vendors().CreateAsync(Store("Shop"), user.Id));
            Assert.Empty(_context.Vendors);
        }

        [Fact]
        public async Task DuplicateName_InAnyLanguageOrCase_IsRejected()
        {
            await Vendors().CreateAsync(Store("Elite Electronics"), null, byAdmin: true);
            var c1 = AddUser(UserRoles.Customer, "07801111112");
            await Assert.ThrowsAsync<Exception>(() => Vendors().CreateAsync(Store("  elite electronics "), c1.Id));
            await Assert.ThrowsAsync<Exception>(() => Vendors().CreateAsync(new VendorCreateDto { Name = "Other", NameAr = "Elite Electronics عربي" }, c1.Id));
        }

        [Fact]
        public async Task Admin_CanCreateActiveStore_WithoutOwner()
        {
            var admin = AddUser(UserRoles.Admin);
            var created = await Vendors().CreateAsync(Store("Admin Shop", active: true), admin.Id, byAdmin: true);
            Assert.True(created.IsActive);
            Assert.Null(created.OwnerId);
        }

        [Fact]
        public async Task Approval_TurnsCustomerOwnerIntoVendor_Once()
        {
            var customer = AddUser(UserRoles.Customer);
            var created = await Vendors().CreateAsync(Store("Shop A"), customer.Id);

            Assert.True(await Vendors().ApproveOwnerAsync(created.Id));
            Assert.Equal(UserRoles.Vendor, (await _context.Users.AsNoTracking().SingleAsync(u => u.Id == customer.Id)).Role);
            Assert.False(await Vendors().ApproveOwnerAsync(created.Id));   // صار بائعاً — لا تغيير
        }

        // ===== الإيميل: فريد وإلزامي، والدخول به =====
        [Fact]
        public async Task Register_EmailRequired_AndUnique_WithNeutralMessage()
        {
            await Assert.ThrowsAsync<Exception>(() => Auth().RegisterAsync(new RegisterDto { Phone = "07701234567", Email = "", Password = "secret1", FullName = "أحمد علي" }));
            await Auth().RegisterAsync(new RegisterDto { Phone = "07701234567", Email = "sara@mail.com", Password = "secret1", FullName = "سارة" });

            // نفس الإيميل بأحرف مختلفة ورقم آخر: مرفوض بنفس الرسالة المحايدة
            var ex = await Assert.ThrowsAsync<Exception>(() => Auth().RegisterAsync(new RegisterDto { Phone = "07701234568", Email = "SARA@mail.com", Password = "secret1", FullName = "أخرى" }));
            Assert.Equal(AuthService.PhoneUnavailable, ex.Message);
        }

        [Fact]
        public async Task Login_ByEmailOrPhone()
        {
            var u = AddUser(UserRoles.Customer, "07701234567");
            u.Email = "sara@mail.com"; _context.SaveChanges();

            Assert.Equal(u.Id, (await Auth().LoginAsync(new LoginDto { Identifier = " Sara@Mail.com ", Password = "secret1" })).UserId);
            Assert.Equal(u.Id, (await Auth().LoginAsync(new LoginDto { Identifier = "07701234567", Password = "secret1" })).UserId);
            var bad = await Assert.ThrowsAsync<Exception>(() => Auth().LoginAsync(new LoginDto { Identifier = "sara@mail.com", Password = "wrong" }));
            Assert.Equal("بيانات الدخول أو كلمة المرور غير صحيحة", bad.Message);
        }

        // ===== الهاتف عند أول شراء (حساب Google) =====
        [Fact]
        public async Task AddPhone_OnceAndUnique_ReturnsSessionWithPhone()
        {
            var noPhone = new User { Phone = null, FullName = "زبون", Email = "g@mail.com", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _context.Users.Add(noPhone); _context.SaveChanges();
            AddUser(UserRoles.Customer, "07701234567");

            await Assert.ThrowsAsync<Exception>(() => Auth().AddPhoneAsync(noPhone.Id, "07701234567"));   // رقم مستخدم
            await Assert.ThrowsAsync<Exception>(() => Auth().AddPhoneAsync(noPhone.Id, "123"));           // غير صالح

            var session = await Auth().AddPhoneAsync(noPhone.Id, "+964 780 111 2222");
            Assert.Equal("07801112222", session.Phone);
            Assert.False(string.IsNullOrEmpty(session.Token));
            await Assert.ThrowsAsync<Exception>(() => Auth().AddPhoneAsync(noPhone.Id, "07801112223"));   // له رقم مسبقاً
        }
    }
}
