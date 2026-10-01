using ecommerce.Core.DTO.Auth;
using ecommerce.Services.AuthService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuthController : Controller
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        // POST: api/auth/login
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            try
            {
                var result = await _authService.LoginAsync(dto);
                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "تم تسجيل الدخول بنجاح"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/auth/change-password
        [AllowAnonymous]
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
                    message = "تم تغيير كلمة المرور بنجاح"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/auth/refresh-token
        [Authorize]
        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken()
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _authService.RefreshTokenAsync(userId);

                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "تم تجديد الـ Token بنجاح"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
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
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // Helper method للحصول على UserId من Token
        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst("userId")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
                throw new Exception("غير مصرح");

            return Guid.Parse(userIdClaim);
        }
    }

    public class AddPhoneDto
    {
        [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "رقم الهاتف مطلوب")]
        public string Phone { get; set; } = "";
    }
}
