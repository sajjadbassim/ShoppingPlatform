using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class PasswordResetOtpRepository : IPasswordResetOtpRepository
    {
        private readonly AppDbContext _context;

        public PasswordResetOtpRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<PasswordResetOtp> CreateAsync(PasswordResetOtp otp)
        {
            await _context.PasswordResetOtps.AddAsync(otp);
            await _context.SaveChangesAsync();
            return otp;
        }

        public async Task<PasswordResetOtp?> GetActiveByUserIdAsync(Guid userId)
        {
            return await _context.PasswordResetOtps
                .Where(o => o.UserId == userId && !o.IsUsed && o.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<PasswordResetOtp?> GetByResetTokenAsync(string resetToken)
        {
            return await _context.PasswordResetOtps
                .FirstOrDefaultAsync(o =>
                    o.ResetToken == resetToken &&
                    o.IsVerified &&
                    !o.IsUsed &&
                    o.ResetTokenExpiresAt > DateTime.UtcNow);
        }

        public async Task UpdateAsync(PasswordResetOtp otp)
        {
            _context.PasswordResetOtps.Update(otp);
            await _context.SaveChangesAsync();
        }

        public async Task InvalidatePendingForUserAsync(Guid userId)
        {
            var pending = await _context.PasswordResetOtps
                .Where(o => o.UserId == userId && !o.IsUsed)
                .ToListAsync();

            if (!pending.Any()) return;

            foreach (var otp in pending)
                otp.IsUsed = true;

            await _context.SaveChangesAsync();
        }
    }
}
