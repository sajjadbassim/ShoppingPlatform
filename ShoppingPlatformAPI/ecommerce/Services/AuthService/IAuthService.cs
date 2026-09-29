using ecommerce.Core.DTO.Auth;

namespace ecommerce.Services.AuthService
{
    public interface IAuthService
    {
        Task<LoginResponseDto> RegisterAsync(RegisterDto dto);
        Task<LoginResponseDto> LoginAsync(LoginDto dto);
        Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
        Task<LoginResponseDto> RefreshTokenAsync(Guid userId);
        Task ForgotPasswordAsync(ForgotPasswordDto dto);
        Task<string> VerifyResetOtpAsync(VerifyResetOtpDto dto);
        Task ResetPasswordAsync(ResetPasswordDto dto);
    }
}
