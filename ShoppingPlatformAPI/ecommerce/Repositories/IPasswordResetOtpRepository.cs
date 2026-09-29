using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IPasswordResetOtpRepository
    {
        Task<PasswordResetOtp> CreateAsync(PasswordResetOtp otp);
        Task<PasswordResetOtp?> GetActiveByUserIdAsync(Guid userId);
        Task<PasswordResetOtp?> GetByResetTokenAsync(string resetToken);
        Task UpdateAsync(PasswordResetOtp otp);
        Task InvalidatePendingForUserAsync(Guid userId);
    }
}
