using ecommerce.Core.DTO.Auth;

namespace ecommerce.Services.AuthService
{
    public interface IAuthService
    {
        Task<LoginResponseDto> RegisterAsync(RegisterDto dto);
        Task<LoginResponseDto> LoginAsync(LoginDto dto);
        Task<LoginResponseDto> SignInAsync(ecommerce.Core.Models.User user);
        Task<LoginResponseDto> AddPhoneAsync(Guid userId, string phone);
        Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
        Task<LoginResponseDto> RefreshTokenAsync(Guid userId);
        Task ForgotPasswordAsync(ForgotPasswordDto dto);
        Task<string> VerifyResetOtpAsync(VerifyResetOtpDto dto);
        Task ResetPasswordAsync(ResetPasswordDto dto);
    }
}
