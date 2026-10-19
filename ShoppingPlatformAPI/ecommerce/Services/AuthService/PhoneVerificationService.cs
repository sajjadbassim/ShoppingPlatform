using System.Security.Cryptography;
using System.Text;
using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.SmsService;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ecommerce.Services.AuthService
{
    public interface IPhoneVerificationService
    {
        // يرسل رمزاً للرقم ويعيده (يُعرض في بيئة التطوير فقط — المتحكم يقرر)
        Task<string> SendCodeAsync(string phone);

        // رمز صحيح ← رمز إثبات صالح 30 دقيقة
        Task<string> VerifyCodeAsync(string phone, string code);

        // قبل ربط الرقم بحساب: رمز الإثبات يخص هذا الرقم، لم يُستعمل، لم ينتهِ
        Task<PhoneVerification> RequireAsync(string phone, string? token);

        Task MarkUsedAsync(PhoneVerification verification);
    }

    public class PhoneVerificationService : IPhoneVerificationService
    {
        public const string NotVerified = "أكّد رقم هاتفك برمز التحقق أولاً";
        public const string InvalidCode = "رمز التحقق غير صحيح أو منتهي الصلاحية";
        public const int MaxAttempts = 5;
        private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

        private readonly AppDbContext _context;
        private readonly IOtpSender _sender;
        private readonly IAuthThrottle _throttle;

        public PhoneVerificationService(AppDbContext context, IOtpSender sender, IAuthThrottle throttle)
        {
            _context = context;
            _sender = sender;
            _throttle = throttle;
        }

        private static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        public async Task<string> SendCodeAsync(string phone)
        {
            var normalized = PhoneNumber.Require(phone);
            _throttle.EnsureOtpRequestAllowed(normalized);

            // رمز جديد يُبطل ما قبله لنفس الرقم
            var now = DateTime.UtcNow;
            var pending = await _context.PhoneVerifications
                .Where(v => v.Phone == normalized && v.UsedAt == null && v.ExpiresAt > now)
                .ToListAsync();
            foreach (var p in pending) p.UsedAt = now;

            var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            _context.PhoneVerifications.Add(new PhoneVerification
            {
                Phone = normalized,
                CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
                ExpiresAt = now.Add(CodeLifetime),
            });
            await _context.SaveChangesAsync();

            await _sender.SendCodeAsync(normalized, code);
            return code;
        }

        public async Task<string> VerifyCodeAsync(string phone, string code)
        {
            var normalized = PhoneNumber.Require(phone);
            var now = DateTime.UtcNow;
            var pending = await _context.PhoneVerifications
                .Where(v => v.Phone == normalized && v.UsedAt == null && v.TokenHash == null && v.ExpiresAt > now)
                .OrderByDescending(v => v.CreatedAt)
                .FirstOrDefaultAsync()
                ?? throw new BusinessRuleException(InvalidCode);

            if (pending.Attempts >= MaxAttempts)
                throw new BusinessRuleException("تم تجاوز عدد المحاولات المسموح، اطلب رمزاً جديداً");

            if (!BCrypt.Net.BCrypt.Verify((code ?? "").Trim(), pending.CodeHash))
            {
                pending.Attempts++;
                await _context.SaveChangesAsync();
                throw new BusinessRuleException("رمز التحقق غير صحيح");
            }

            var token = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
            pending.TokenHash = Hash(token);
            pending.TokenExpiresAt = now.Add(TokenLifetime);
            await _context.SaveChangesAsync();
            return token;
        }

        public async Task<PhoneVerification> RequireAsync(string phone, string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) throw new BusinessRuleException(NotVerified);
            var hash = Hash(token);
            var now = DateTime.UtcNow;
            return await _context.PhoneVerifications.FirstOrDefaultAsync(v =>
                       v.TokenHash == hash && v.Phone == phone && v.UsedAt == null && v.TokenExpiresAt > now)
                   ?? throw new BusinessRuleException(NotVerified);
        }

        public async Task MarkUsedAsync(PhoneVerification verification)
        {
            verification.UsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
