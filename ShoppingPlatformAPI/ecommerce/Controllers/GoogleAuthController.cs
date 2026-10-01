using ecommerce.Core.DTO.Auth;
using ecommerce.Core.Exceptions;
using ecommerce.Services.AuthService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // الدخول بـ Google (للزبائن) والربط من الإعدادات
    [ApiController]
    [Route("api/auth/google")]
    public class GoogleAuthController : ControllerBase
    {
        private readonly IGoogleAuthService _google;

        public GoogleAuthController(IGoogleAuthService google) => _google = google;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // POST: api/auth/google — بطاقة Google من الزر
        [HttpPost]
        [AllowAnonymous]
        [EnableRateLimiting("auth-ip")]
        public async Task<IActionResult> SignIn([FromBody] GoogleCredentialDto dto)
            => Ok(new { success = true, data = await _google.SignInAsync(dto.Credential) });

        // GET: api/auth/google/status
        [HttpGet("status")]
        [Authorize]
        public async Task<IActionResult> Status()
            => Ok(new { success = true, data = await _google.GetStatusAsync(UserId) });

        // POST: api/auth/google/link
        [HttpPost("link")]
        [Authorize]
        public async Task<IActionResult> Link([FromBody] GoogleCredentialDto dto)
            => Ok(new { success = true, data = await _google.LinkAsync(UserId, dto.Credential), message = "تم ربط حساب Google" });

        // DELETE: api/auth/google/link
        [HttpDelete("link")]
        [Authorize]
        public async Task<IActionResult> Unlink()
            => Ok(new { success = true, data = await _google.UnlinkAsync(UserId), message = "تم فصل حساب Google" });
    }

    public class GoogleCredentialDto
    {
        [Required(ErrorMessage = "بيانات Google مفقودة")]
        public string Credential { get; set; } = "";
    }
}
