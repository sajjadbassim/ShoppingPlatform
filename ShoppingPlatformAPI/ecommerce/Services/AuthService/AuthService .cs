using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;
using ecommerce.Services.SmsService;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

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

        public AuthService(
            IUserRepository userRepository,
            IOptions<JwtSettings> jwtSettings,
            IVendorRepository vendorRepository,
            IPasswordResetOtpRepository passwordResetOtpRepository,
            ISmsSender smsSender,
            INotificationService notificationService)
        {
            _userRepository = userRepository;
            _jwtSettings = jwtSettings.Value;
            _vendorRepository = vendorRepository;
            _passwordResetOtpRepository = passwordResetOtpRepository;
            _smsSender = smsSender;
            _notificationService = notificationService;
        }

        // ─────────────────────────────────────────────────────────────────────
        // REGISTER
        // ─────────────────────────────────────────────────────────────────────
        public async Task<LoginResponseDto> RegisterAsync(RegisterDto dto)
        {
            var existingUser = await _userRepository.GetByPhoneAsync(dto.Phone);
            if (existingUser != null)
                throw new Exception("رقم الهاتف مسجل مسبقاً");

            var user = new User
            {
                Phone = dto.Phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                FullName = dto.FullName,
                Email = dto.Email,
                Role = UserRoles.Customer,
                IsActive = true
            };

            user = await _userRepository.CreateAsync(user);

            await _notificationService.NotifyAdminsAsync(
                NotificationCategory.NewUsers, NotificationType.NEW_USER,
                $"مستخدم جديد: {user.FullName} ({user.Phone})",
                new { userId = user.Id });

            var token = GenerateJwtToken(user);

            return new LoginResponseDto
            {
                UserId = user.Id,
                Phone = user.Phone,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                VendorId = null // Customer جديد لا يملك متجر
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // LOGIN
        // ─────────────────────────────────────────────────────────────────────
        public async Task<LoginResponseDto> LoginAsync(LoginDto dto)
        {
            var user = await _userRepository.GetByPhoneAsync(dto.Phone);
            if (user == null)
                throw new Exception("رقم الهاتف أو كلمة المرور غير صحيحة");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("رقم الهاتف أو كلمة المرور غير صحيحة");

            if (!user.IsActive)
                throw new Exception("الحساب معطل. يرجى التواصل مع الدعم الفني");

            user.LastLogin = DateTime.UtcNow;
            await _userRepository.UpdateAsync(user);

            var token = GenerateJwtToken(user);

            // ✅ جلب VendorId إذا كان المستخدم Vendor
            Guid? vendorId = null;
            if (user.Role == UserRoles.Vendor)
            {
                var vendor = await _vendorRepository.GetByOwnerIdAsync(user.Id);
                vendorId = vendor?.Id;
            }

            return new LoginResponseDto
            {
                UserId = user.Id,
                Phone = user.Phone,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                VendorId = vendorId // ✅ null إذا لم يكن Vendor
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // CHANGE PASSWORD
        // ─────────────────────────────────────────────────────────────────────
        public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
                throw new Exception("كلمة المرور الحالية غير صحيحة");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _userRepository.UpdateAsync(user);

            return true;
        }

        // ─────────────────────────────────────────────────────────────────────
        // REFRESH TOKEN
        // ─────────────────────────────────────────────────────────────────────
        public async Task<LoginResponseDto> RefreshTokenAsync(Guid userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            if (!user.IsActive)
                throw new Exception("الحساب معطل");

            var token = GenerateJwtToken(user);

            // ✅ جلب VendorId إذا كان Vendor
            Guid? vendorId = null;
            if (user.Role == UserRoles.Vendor)
            {
                var vendor = await _vendorRepository.GetByOwnerIdAsync(user.Id);
                vendorId = vendor?.Id;
            }

            return new LoginResponseDto
            {
                UserId = user.Id,
                Phone = user.Phone,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                VendorId = vendorId
            };
        }

        // ─────────────────────────────────────────────────────────────────────
        // FORGOT PASSWORD — إرسال رمز تحقق للهاتف
        // ─────────────────────────────────────────────────────────────────────
        public async Task ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            var user = await _userRepository.GetByPhoneAsync(dto.Phone);
            if (user == null)
                throw new Exception("لا يوجد حساب مرتبط بهذا الرقم");

            // إبطال أي رموز سابقة لم تُستخدم بعد
            await _passwordResetOtpRepository.InvalidatePendingForUserAsync(user.Id);

            var code = Random.Shared.Next(100000, 999999).ToString();

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
            var user = await _userRepository.GetByPhoneAsync(dto.Phone);
            if (user == null)
                throw new Exception("رمز التحقق غير صحيح أو منتهي الصلاحية");

            var otp = await _passwordResetOtpRepository.GetActiveByUserIdAsync(user.Id);
            if (otp == null)
                throw new Exception("رمز التحقق غير صحيح أو منتهي الصلاحية");

            if (otp.Attempts >= 5)
                throw new Exception("تم تجاوز عدد المحاولات المسموح، اطلب رمزًا جديدًا");

            if (!BCrypt.Net.BCrypt.Verify(dto.Code, otp.CodeHash))
            {
                otp.Attempts += 1;
                await _passwordResetOtpRepository.UpdateAsync(otp);
                throw new Exception("رمز التحقق غير صحيح");
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
                throw new Exception("انتهت صلاحية الجلسة، يرجى إعادة طلب رمز جديد");

            var user = await _userRepository.GetByIdAsync(otp.UserId);
            if (user == null)
                throw new Exception("المستخدم غير موجود");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
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
                new Claim(ClaimTypes.MobilePhone,    user.Phone),
                new Claim(ClaimTypes.Name,           user.FullName ?? ""),
                new Claim(ClaimTypes.Email,          user.Email    ?? ""),
                new Claim(ClaimTypes.Role,           user.Role),
                new Claim("userId", user.Id.ToString()),
                new Claim("phone",  user.Phone)
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