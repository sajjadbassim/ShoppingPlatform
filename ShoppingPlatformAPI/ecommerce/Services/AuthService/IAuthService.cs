using ecommerce.Core.DTO.Auth;

namespace ecommerce.Services.AuthService
{
    public interface IAuthService
    {
        Task<LoginResponseDto> RegisterAsync(RegisterDto dto);
        Task<LoginResponseDto> LoginAsync(LoginDto dto);
        Task<LoginResponseDto> SignInAsync(ecommerce.Core.Models.User user);
        Task<LoginResponseDto> AddPhoneAsync(Guid userId, string phone, string? verificationToken = null);
        Task<LoginResponseDto> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
        Task<LoginResponseDto> RefreshAsync(string? refreshToken);
        Task LogoutAsync(string? refreshToken);
        // يعيد الرمز المُرسل (null إن لم يكن الرقم مسجلاً) — يُعرض في بيئة التطوير فقط
        Task<string?> ForgotPasswordAsync(ForgotPasswordDto dto);
        Task<string> VerifyResetOtpAsync(VerifyResetOtpDto dto);
        Task ResetPasswordAsync(ResetPasswordDto dto);
    }
}
