using ecommerce.Common;
using ecommerce.Core.Exceptions;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // حذف الزبون لحسابه بنفسه (التطبيق والويب)
    [ApiController]
    [Route("api/account")]
    [Authorize]
    public class AccountController : ControllerBase
    {
        private readonly IAccountDeletionService _deletion;

        public AccountController(IAccountDeletionService deletion) => _deletion = deletion;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // DELETE: api/account  { "password": "..." }  (كلمة المرور مطلوبة لمن يملكها)
        [HttpDelete]
        public async Task<IActionResult> Delete([FromBody] DeleteAccountDto? dto)
        {
            try
            {
                await _deletion.DeleteOwnAccountAsync(UserId, dto?.Password);
                return Ok(new { success = true, message = "تم حذف حسابك" });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }
    }

    public class DeleteAccountDto
    {
        public string? Password { get; set; }
    }
}
