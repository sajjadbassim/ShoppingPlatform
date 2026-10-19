using ecommerce.Services.LoyaltyService;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services.AuthService
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly JwtSettings _jwtSettings;
        private readonly IVendorRepository _vendorRepository;
        private readonly IPasswordResetOtpRepository _passwordResetOtpRepository;
        private readonly ISmsSender _smsSender;
        private readonly INotificationService _notificationService;
        private readonly IAuthThrottle _throttle;
        private readonly ecommerce.Services.ActivityLogService.IActivityLogService? _activity;
        private readonly IRefreshTokenRepository _refreshTokens;
        private readonly ILoyaltyService? _loyalty;

        public AuthService(
            IUserRepository userRepository,
            IOptions<JwtSettings> jwtSettings,
            IVendorRepository vendorRepository,
            IPasswordResetOtpRepository passwordResetOtpRepository,
            ISmsSender smsSender,
            INotificationService notificationService,
            IAuthThrottle throttle,
            IRefreshTokenRepository refreshTokens,
            ILoyaltyService? loyalty = null,
            ecommerce.Services.ActivityLogService.IActivityLogService? activity = null)
        {
            _activity = activity;
            _loyalty = loyalty;
            _throttle = throttle;
            _refreshTokens = refreshTokens;
            _userRepository = userRepository;
            _jwtSettings = jwtSettings.Value;
            _vendorRepository = vendorRepository;
            _passwordResetOtpRepository = passwordResetOtpRepository;
            _smsSender = smsSender;
            _notificationService = notificationService;
        }

        public const string PhoneUnavailable =
            "لا يمكن إكمال التسجيل بهذا الرقم — إذا كان لديك حساب به فادخل بكلمة المرور";

        // الإيميل مستخدم لحساب آخر؟ (بلا فرق بين الأحرف الكبيرة والصغيرة)
        private async Task<bool> EmailTakenAsync(string email, Guid? exceptUserId = null) =>
            email.Length > 0 && (await _userRepository.GetByEmailAsync(email)) is { } u && u.Id != exceptUserId;

        private async Task<User?> FindByEmailAsync(string email) =>
            email.Length == 0 ? null : await _userRepository.GetByEmailAsync(email);

        // إضافة رقم الهاتف لحساب بلا هاتف (شرط إتمام الطلب) — يُعيد جلسة جديدة فيها الرقم
        public async Task<LoginResponseDto> AddPhoneAsync(Guid userId, string phone)
        {
            var user = await _userRepository.GetByIdAsync(userId) ?? throw new NotFoundException("المستخدم غير موجود");
            var normalized = PhoneNumber.Require(phone);
            if (user.Phone == normalized) return await SignInAsync(user);
            if (!string.IsNullOrEmpty(user.Phone))
                throw new BusinessRuleException("لحسابك رقم هاتف مسبقاً");

            var owner = await _userRepository.GetByPhoneAsync(normalized);
            if (owner != null && owner.Id != userId)
                throw new BusinessRuleException("لا يمكن استخدام هذا الرقم — إذا كان لديك حساب به فادخل إليه بكلمة المرور");

            user.Phone = normalized;
            try { await _userRepository.UpdateAsync(user); }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException)
            {
                throw new BusinessRuleException("لا يمكن استخدام هذا الرقم — إذا كان لديك حساب به فادخل إليه بكلمة المرور");
            }
            return await SignInAsync(user);
        }

        // جلسة دخول لمستخدم تحقّقنا منه بطريقة أخرى (Google)
        public async Task<LoginResponseDto> SignInAsync(User user)
        {
            user.LastLogin = DateTime.UtcNow;
            await _userRepository.UpdateAsync(user);

            return await IssueSessionAsync(user);
        }

        // جلسة جديدة: توكن دخول قصير + رمز تجديد يُخزَّن مُجزّأً
        private async Task<LoginResponseDto> IssueSessionAsync(User user)
        {
            Guid? vendorId = null;
            if (user.Role == UserRoles.Vendor)
                vendorId = user.StaffVendorId ?? (await _vendorRepository.GetByOwnerIdAsync(user.Id))?.Id;

            var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
            var refreshExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenDays > 0 ? _jwtSettings.RefreshTokenDays : 30);
            await _refreshTokens.AddAsync(new RefreshToken
            {
                UserId = user.Id,
                TokenHash = HashRefreshToken(refreshToken),
                ExpiresAt = refreshExpiresAt
            });

            return new LoginResponseDto
            {
                UserId = user.Id,
                Phone = user.Phone,
                FullName = user.FullName,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                Role = user.Role,
                Token = GenerateJwtToken(user),
                ExpiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                RefreshToken = refreshToken,
                RefreshTokenExpiresAt = refreshExpiresAt,
                VendorId = vendorId,
                Permissions = user.Permissions == null ? null : StaffPermissions.Parse(user.Permissions).ToList(),
                IsStoreStaff = user.StaffVendorId != null,
            };
        }

        private static string HashRefreshToken(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        // ─────────────────────────────────────────────────────────────────────
        // REGISTER
        // ─────────────────────────────────────────────────────────────────────
        public async Task<LoginResponseDto> RegisterAsync(RegisterDto dto)
        {
            // الرقم بصيغة واحدة 07XXXXXXXXX حتى لا يتكرر نفس الرقم بصيغتين
            var phone = PhoneNumber.Require(dto.Phone);
            var fullName = (dto.FullName ?? "").Trim();
            if (fullName.Length < 3)
                throw new BusinessRuleException("الاسم يجب أن يكون 3 أحرف على الأقل");

            // رسالة محايدة: لا تؤكد أن الرقم مسجّل (تُستبدل لاحقاً برمز SMS)
            var email = EmailAddress.Normalize(dto.Email);
            if (!EmailAddress.IsValid(email))
                throw new BusinessRuleException("البريد الإلكتروني غير صحيح");

            // نفس الرسالة للهاتف والإيميل المستخدَمين: لا تكشف أيهما مسجّل
            if (await _userRepository.GetByPhoneAsync(phone) != null || await EmailTakenAsync(email))
                throw new BusinessRuleException(PhoneUnavailable);

            var user = new User
            {
                Phone = phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                FullName = fullName,
                Email = email,
                Role = UserRoles.Customer,
                IsActive = true,
                // ادعُ صديقاً: رمز غير صحيح يُتجاهل
                ReferredByUserId = _loyalty != null ? await _loyalty.ResolveReferrerAsync(dto.ReferralCode) : null
            };

            try
            {
                user = await _userRepository.CreateAsync(user);
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException)
            {
                // تسجيلان بنفس الرقم في نفس اللحظة — يمنعهما الفهرس الفريد
                throw new BusinessRuleException(PhoneUnavailable);
            }

            try
            {
                await _notificationService.NotifyAdminsAsync(
                    NotificationCategory.NewUsers, NotificationType.NEW_USER,
                    $"مستخدم جديد: {user.FullName} ({user.Phone})",
                    new { userId = user.Id });
            }
            catch { /* الإشعار لا يُفشل التسجيل */ }

            return await IssueSessionAsync(user);
        }

        // ─────────────────────────────────────────────────────────────────────
        // LOGIN
        // ─────────────────────────────────────────────────────────────────────
        public async Task<LoginResponseDto> LoginAsync(LoginDto dto)
        {
            var identifier = (dto.Identifier ?? dto.Phone ?? "").Trim();
            if (identifier.Length == 0)
                throw new BusinessRuleException("أدخل رقم الهاتف أو البريد الإلكتروني");

            // إيميل أو هاتف — والمحاولات تُحسب لكل واحد منهما
            var byEmail = EmailAddress.LooksLikeEmail(identifier);
            var key = byEmail ? EmailAddress.Normalize(identifier) : PhoneNumber.ForLookup(identifier);
            _throttle.EnsureLoginAllowed(key);

            var user = byEmail ? await FindByEmailAsync(key) : await _userRepository.GetByPhoneAsync(key);
            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                _throttle.LoginFailed(key);
                // سجل النشاط: محاولة فاشلة على حساب موظف/متجر/سائق موجود (الزبائن والأرقام غير المسجّلة لا تُسجَّل)
                if (user != null && _activity != null) await _activity.RecordLoginAsync(user, success: false);
                throw new BusinessRuleException("بيانات الدخول أو كلمة المرور غير صحيحة");
            }
            _throttle.LoginSucceeded(key);

            if (!user.IsActive)
            {
                if (_activity != null) await _activity.RecordLoginAsync(user, success: false, "محاولة دخول لحساب معطّل");
                throw new BusinessRuleException("الحساب معطل. يرجى التواصل مع الدعم الفني");
            }

            user.LastLogin = DateTime.UtcNow;
            await _userRepository.UpdateAsync(user);

            var session = await IssueSessionAsync(user);
            if (_activity != null) await _activity.RecordLoginAsync(user, success: true);
            return session;
        }

        // ─────────────────────────────────────────────────────────────────────
        // CHANGE PASSWORD
        // ─────────────────────────────────────────────────────────────────────
        // تغيير كلمة المرور ينهي كل الجلسات الأخرى (UserSessionInterceptor) — ويعيد جلسة جديدة لهذا الجهاز
        public async Task<LoginResponseDto> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                throw new BusinessRuleException("كلمة المرور الحالية غير صحيحة");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _userRepository.UpdateAsync(user);

            return await IssueSessionAsync(user);
        }

        // ─────────────────────────────────────────────────────────────────────
        // REFRESH TOKEN
        // ─────────────────────────────────────────────────────────────────────
        // مهلة استعمال رمز استُبدل للتو: تبويبان يجدّدان في نفس اللحظة ليس سرقة
        private static readonly TimeSpan RotationGrace = TimeSpan.FromMinutes(1);
        private const string SessionExpired = "انتهت الجلسة، يرجى تسجيل الدخول من جديد";

        public async Task<LoginResponseDto> RefreshAsync(string? refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
                throw new UnauthorizedException(SessionExpired);

            var stored = await _refreshTokens.GetByHashAsync(HashRefreshToken(refreshToken));
            if (stored == null)
                throw new UnauthorizedException(SessionExpired);

            var now = DateTime.UtcNow;
            if (stored.RevokedAt != null)
            {
                // رمز مُبطَل يُستعمل من جديد (خارج مهلة التجديد المتزامن) = نسخة مسروقة: تُنهى كل جلسات المستخدم
                if (stored.ReplacedAt == null || now - stored.ReplacedAt > RotationGrace)
                    await _refreshTokens.RevokeAllForUserAsync(stored.UserId, now);
                throw new UnauthorizedException(SessionExpired);
            }

            var user = stored.User;
            if (stored.ExpiresAt <= now || user == null || !user.IsActive
                || (user.SessionsRevokedAt != null && stored.CreatedAt < user.SessionsRevokedAt))
                throw new UnauthorizedException(SessionExpired);

            // التدوير: الرمز الحالي يُبطل ويصدر غيره (يُحفظان معاً في IssueSessionAsync)
            stored.RevokedAt = now;
            stored.ReplacedAt = now;
            await _refreshTokens.PruneAsync(user.Id, now.AddDays(-1));

            return await IssueSessionAsync(user);
        }

        // تسجيل الخروج: إبطال رمز تجديد هذا الجهاز فقط
        public async Task LogoutAsync(string? refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;
            var stored = await _refreshTokens.GetByHashAsync(HashRefreshToken(refreshToken));
            if (stored == null || stored.RevokedAt != null) return;
            stored.RevokedAt = DateTime.UtcNow;
            await _refreshTokens.SaveChangesAsync();
        }

        // ─────────────────────────────────────────────────────────────────────
        // FORGOT PASSWORD — إرسال رمز تحقق للهاتف
        // ─────────────────────────────────────────────────────────────────────
        public async Task ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            var phone = PhoneNumber.ForLookup(dto.Phone);
            _throttle.EnsureOtpRequestAllowed(phone);

            // نفس الرد سواء كان الرقم مسجلاً أم لا — حتى لا تُعرف الأرقام المسجلة
            var user = await _userRepository.GetByPhoneAsync(phone);
            if (user == null || !user.IsActive || string.IsNullOrEmpty(user.Phone))
                return;

            // إبطال أي رموز سابقة لم تُستخدم بعد
            await _passwordResetOtpRepository.InvalidatePendingForUserAsync(user.Id);

            // مولّد تشفيري: Random.Shared قابل للتنبؤ (والحد الأعلى كان يُستثنى منه 999999)
            var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            var otp = new PasswordResetOtp
            {
                UserId = user.Id,
                CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
                ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            };

            await _passwordResetOtpRepository.CreateAsync(otp);
            await _smsSender.SendAsync(user.Phone, $"رمز إعادة تعيين كلمة المرور في واسط: {code} (صالح لمدة 10 دقائق)");
        }

        // ─────────────────────────────────────────────────────────────────────
        // VERIFY RESET OTP — التحقق من الرمز وإصدار resetToken
        // ─────────────────────────────────────────────────────────────────────
        public async Task<string> VerifyResetOtpAsync(VerifyResetOtpDto dto)
        {
            var user = await _userRepository.GetByPhoneAsync(PhoneNumber.ForLookup(dto.Phone));
            if (user == null)
                throw new BusinessRuleException("رمز التحقق غير صحيح أو منتهي الصلاحية");

            var otp = await _passwordResetOtpRepository.GetActiveByUserIdAsync(user.Id);
            if (otp == null)
                throw new BusinessRuleException("رمز التحقق غير صحيح أو منتهي الصلاحية");

            if (otp.Attempts >= 5)
                throw new BusinessRuleException("تم تجاوز عدد المحاولات المسموح، اطلب رمزًا جديدًا");

            if (!BCrypt.Net.BCrypt.Verify(dto.Code, otp.CodeHash))
            {
                otp.Attempts += 1;
                await _passwordResetOtpRepository.UpdateAsync(otp);
                throw new BusinessRuleException("رمز التحقق غير صحيح");
            }

            otp.IsVerified = true;
            otp.ResetToken = Guid.NewGuid().ToString("N");
            otp.ResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(10);
            await _passwordResetOtpRepository.UpdateAsync(otp);

            return otp.ResetToken;
        }

        // ─────────────────────────────────────────────────────────────────────
        // RESET PASSWORD — تعيين كلمة مرور جديدة عبر resetToken
        // ─────────────────────────────────────────────────────────────────────
        public async Task ResetPasswordAsync(ResetPasswordDto dto)
        {
            var otp = await _passwordResetOtpRepository.GetByResetTokenAsync(dto.ResetToken);
            if (otp == null)
                throw new BusinessRuleException("انتهت صلاحية الجلسة، يرجى إعادة طلب رمز جديد");

            var user = await _userRepository.GetByIdAsync(otp.UserId);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.HasPassword = true;
            await _userRepository.UpdateAsync(user);

            otp.IsUsed = true;
            await _passwordResetOtpRepository.UpdateAsync(otp);
        }

        // ─────────────────────────────────────────────────────────────────────
        // GENERATE JWT TOKEN
        // ─────────────────────────────────────────────────────────────────────
        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_jwtSettings.Secret);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.MobilePhone,    user.Phone ?? ""),
                new Claim(ClaimTypes.Name,           user.FullName ?? ""),
                new Claim(ClaimTypes.Email,          user.Email    ?? ""),
                new Claim(ClaimTypes.Role,           user.Role),
                new Claim("userId", user.Id.ToString()),
                // نسخة الجلسة — تُقارن مع كل طلب (UserSessionValidator)
                new Claim(UserSessionValidator.VersionClaim, user.TokenVersion.ToString()),
                new Claim("phone",  user.Phone ?? "")
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                Issuer = _jwtSettings.Issuer,
                Audience = _jwtSettings.Audience,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}