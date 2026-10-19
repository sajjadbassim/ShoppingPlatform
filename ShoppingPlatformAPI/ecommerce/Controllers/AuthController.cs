using ecommerce.Common;
using ecommerce.Core.DTO.Auth;
using ecommerce.Services.AuthService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using ecommerce.Core.Exceptions;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuthController : Controller
    {
        private readonly IAuthService _authService;
        private readonly ecommerce.Services.AuthService.IAuthThrottle? _throttle;

        public AuthController(IAuthService authService, ecommerce.Services.AuthService.IAuthThrottle? throttle = null)
        {
            _authService = authService;
            _throttle = throttle;
        }

        // POST: api/auth/register
        [HttpPost("register")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-ip")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            try
            {
                var result = await _authService.RegisterAsync(dto);
                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "تم التسجيل بنجاح"
                });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }


        // POST: api/auth/login
        [HttpPost("login")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("login-ip")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            try
            {
                _throttle?.EnsureIpLoginAllowed(ip);
            }
            catch (TooManyAttemptsException ex)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new { success = false, message = ex.Message });
            }
            try
            {
                LoginResponseDto result;
                try { result = await _authService.LoginAsync(dto); }
                catch (AppException) { _throttle?.IpLoginFailed(ip); throw; }
                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "تم تسجيل الدخول بنجاح"
                });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // PUT: api/auth/phone — إضافة رقم الهاتف لحساب بلا هاتف (مطلوب قبل إتمام الطلب)
        [HttpPut("phone")]
        [Authorize]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-ip")]
        public async Task<IActionResult> AddPhone([FromBody] AddPhoneDto dto)
        {
            try
            {
                var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(idClaim, out var userId)) return Unauthorized();
                var result = await _authService.AddPhoneAsync(userId, dto.Phone);
                return Ok(new { success = true, data = result, message = "تم حفظ رقم الهاتف" });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/auth/change-password
        // ينهي جلسات الأجهزة الأخرى ويعيد جلسة جديدة لهذا الجهاز
        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _authService.ChangePasswordAsync(userId, dto);

                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "تم تغيير كلمة المرور بنجاح"
                });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/auth/forgot-password
        [AllowAnonymous]
        [HttpPost("forgot-password")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-ip")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            try
            {
                await _authService.ForgotPasswordAsync(dto);
                return Ok(new { success = true, message = "إذا كان الرقم مسجلاً سيصلك رمز التحقق خلال لحظات" });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/auth/verify-reset-otp
        [AllowAnonymous]
        [HttpPost("verify-reset-otp")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-ip")]
        public async Task<IActionResult> VerifyResetOtp([FromBody] VerifyResetOtpDto dto)
        {
            try
            {
                var resetToken = await _authService.VerifyResetOtpAsync(dto);
                return Ok(new { success = true, data = new { resetToken }, message = "تم التحقق من الرمز بنجاح" });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/auth/reset-password
        [AllowAnonymous]
        [HttpPost("reset-password")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth-ip")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            try
            {
                await _authService.ResetPasswordAsync(dto);
                return Ok(new { success = true, message = "تم تغيير كلمة المرور بنجاح" });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/auth/refresh-token
        // يجدّد الجلسة برمز التجديد — لا يحتاج توكن دخول صالحاً (قد يكون انتهى)
        [AllowAnonymous]
        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequestDto dto)
        {
            try
            {
                var result = await _authService.RefreshAsync(dto?.RefreshToken);
                return Ok(new { success = true, data = result, message = "تم تجديد الجلسة" });
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { success = false, message = ex.Message });
            }
        }

        // POST: api/auth/logout — إبطال رمز تجديد هذا الجهاز
        [AllowAnonymous]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshTokenRequestDto dto)
        {
            await _authService.LogoutAsync(dto?.RefreshToken);
            return Ok(new { success = true });
        }

        // GET: api/auth/me
        [Authorize]
        [HttpGet("me")]
        public IActionResult GetCurrentUser()
        {
            try
            {
                var userId = GetCurrentUserId();
                var phone = User.FindFirst("phone")?.Value;
                var name = User.FindFirst(ClaimTypes.Name)?.Value;
                var email = User.FindFirst(ClaimTypes.Email)?.Value;
                var role = User.FindFirst(ClaimTypes.Role)?.Value;

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        userId,
                        phone,
                        name,
                        email,
                        role
                    }
                });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // Helper method للحصول على UserId من Token
        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst("userId")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
                throw new BusinessRuleException("غير مصرح");

            return Guid.Parse(userIdClaim);
        }
    }

    public class AddPhoneDto
    {
        [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "رقم الهاتف مطلوب")]
        public string Phone { get; set; } = "";
    }
}
