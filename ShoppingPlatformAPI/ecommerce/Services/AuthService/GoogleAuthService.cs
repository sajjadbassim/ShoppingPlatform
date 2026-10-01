using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.NotificationService;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ecommerce.Services.AuthService
{
    public class GoogleOptions
    {
        public const string Section = "Google";
        public string? ClientId { get; set; }
    }

    // نتيجة الدخول بـ Google: إمّا دخول مباشر، أو «أكمل حسابك» (رقم الهاتف) لأول مرة
    public class GoogleSignInResultDto
    {
        public string Status { get; set; } = "";           // ok
        public LoginResponseDto? Login { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
    }

    public class GoogleStatusDto
    {
        public bool Linked { get; set; }
        public string? GoogleEmail { get; set; }
        public bool HasPassword { get; set; }
        public bool CanLink { get; set; }                   // للزبائن فقط
    }

    public interface IGoogleAuthService
    {
        Task<GoogleSignInResultDto> SignInAsync(string credential);
        Task<GoogleStatusDto> GetStatusAsync(Guid userId);
        Task<GoogleStatusDto> LinkAsync(Guid userId, string credential);
        Task<GoogleStatusDto> UnlinkAsync(Guid userId);
    }

    // التحقق من بطاقة Google يُستبدل في الاختبارات
    public interface IGoogleTokenValidator
    {
        Task<GoogleJsonWebSignature.Payload> ValidateAsync(string credential, string clientId);
    }

    public class GoogleTokenValidator : IGoogleTokenValidator
    {
        public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string credential, string clientId) =>
            GoogleJsonWebSignature.ValidateAsync(credential, new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } });
    }

    public class GoogleAuthService : IGoogleAuthService
    {
        // نفس الرسالة للتسجيل العادي: لا تؤكد أن الرقم مسجّل (يُستبدل لاحقاً برمز SMS)
        public const string PhoneUnavailableMessage = AuthService.PhoneUnavailable + " ثم اربط Google من الإعدادات";
        public const string EmailUnavailableMessage =
            "لا يمكن إنشاء حساب بهذا البريد — إذا كان لديك حساب به فادخل بكلمة المرور ثم اربط Google من الإعدادات";

        private readonly AppDbContext _context;
        private readonly IAuthService _auth;
        private readonly IGoogleTokenValidator _validator;
        private readonly GoogleOptions _google;
        private readonly JwtSettings _jwt;
        private readonly INotificationService? _notifications;

        public GoogleAuthService(AppDbContext context, IAuthService auth, IGoogleTokenValidator validator,
            IOptions<GoogleOptions> google, IOptions<JwtSettings> jwt, INotificationService? notifications = null)
        {
            _context = context;
            _auth = auth;
            _validator = validator;
            _google = google.Value;
            _jwt = jwt.Value;
            _notifications = notifications;
        }

        private async Task<GoogleJsonWebSignature.Payload> VerifyAsync(string credential)
        {
            if (string.IsNullOrWhiteSpace(_google.ClientId))
                throw new BusinessRuleException("الدخول بـ Google غير مفعّل");
            GoogleJsonWebSignature.Payload payload;
            try { payload = await _validator.ValidateAsync(credential, _google.ClientId); }
            catch (Exception) { throw new BusinessRuleException("تعذّر التحقق من حساب Google — حاول مجدداً"); }
            if (!payload.EmailVerified)
                throw new BusinessRuleException("بريد حساب Google غير موثّق");
            return payload;
        }

        // ===== الدخول =====
        public async Task<GoogleSignInResultDto> SignInAsync(string credential)
        {
            var payload = await VerifyAsync(credential);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject);
            if (user != null)
            {
                if (!user.IsActive)
                    throw new BusinessRuleException("الحساب معطل. يرجى التواصل مع الدعم الفني");
                return new GoogleSignInResultDto { Status = "ok", Login = await _auth.SignInAsync(user) };
            }

            // لا ربط تلقائي بالإيميل: إيميلات المنصة غير موثّقة — إن كان مستخدماً لحساب آخر نرفض برسالة محايدة
            var email = EmailAddress.Normalize(payload.Email);
            if (email.Length > 0 && await _context.Users.AnyAsync(u => u.Email != null && u.Email.Trim().ToLower() == email))
                throw new BusinessRuleException(EmailUnavailableMessage);

            // حساب زبون جديد فوراً — رقم الهاتف يُطلب عند أول إتمام طلب
            var created = new User
            {
                Phone = null,
                FullName = string.IsNullOrWhiteSpace(payload.Name) ? email : payload.Name.Trim(),
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                HasPassword = false,
                GoogleId = payload.Subject,
                GoogleEmail = email,
                Role = UserRoles.Customer,
                IsActive = true,
            };
            _context.Users.Add(created);
            try { await _context.SaveChangesAsync(); }
            catch (DbUpdateException)
            {
                // ضغطتان متتاليتان: الحساب أُنشئ للتو
                _context.Entry(created).State = EntityState.Detached;
                var again = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject)
                    ?? throw new BusinessRuleException(EmailUnavailableMessage);
                return new GoogleSignInResultDto { Status = "ok", Login = await _auth.SignInAsync(again) };
            }

            if (_notifications != null)
            {
                try
                {
                    await _notifications.NotifyAdminsAsync(NotificationCategory.NewUsers, NotificationType.NEW_USER,
                        $"مستخدم جديد (Google): {created.FullName} ({email})", new { userId = created.Id });
                }
                catch { /* الإشعار لا يُفشل التسجيل */ }
            }
            return new GoogleSignInResultDto { Status = "ok", Login = await _auth.SignInAsync(created) };
        }

        // ===== الربط من الإعدادات =====
        public async Task<GoogleStatusDto> GetStatusAsync(Guid userId)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");
            return Status(user);
        }

        public async Task<GoogleStatusDto> LinkAsync(Guid userId, string credential)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");
            if (user.Role != UserRoles.Customer)
                throw new ForbiddenException("الدخول بـ Google متاح لحسابات الزبائن فقط");

            var payload = await VerifyAsync(credential);
            if (user.GoogleId == payload.Subject) return Status(user);
            if (await _context.Users.AnyAsync(u => u.GoogleId == payload.Subject && u.Id != userId))
                throw new BusinessRuleException("حساب Google هذا مربوط بحساب آخر");

            user.GoogleId = payload.Subject;
            user.GoogleEmail = payload.Email;
            await _context.SaveChangesAsync();
            return Status(user);
        }

        public async Task<GoogleStatusDto> UnlinkAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");
            // بلا كلمة مرور لن يبقى له طريق للدخول
            if (!user.HasPassword)
                throw new BusinessRuleException("أضف كلمة مرور أولاً (من «نسيت كلمة المرور») ثم افصل حساب Google");
            user.GoogleId = null;
            user.GoogleEmail = null;
            await _context.SaveChangesAsync();
            return Status(user);
        }

        private static GoogleStatusDto Status(User u) => new()
        {
            Linked = u.GoogleId != null,
            GoogleEmail = u.GoogleEmail,
            HasPassword = u.HasPassword,
            CanLink = u.Role == UserRoles.Customer,
        };
    }
}
