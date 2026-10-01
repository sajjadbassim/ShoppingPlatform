using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // الصورة الشخصية لأي حساب (زبون، متجر، سائق، إدارة)
    [ApiController]
    [Route("api/profile")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly IAvatarService _avatars;

        public ProfileController(IAvatarService avatars) => _avatars = avatars;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // PUT: api/profile/avatar (multipart: file)
        [HttpPut("avatar")]
        [RequestSizeLimit(4 * 1024 * 1024)]
        public async Task<IActionResult> Upload(IFormFile file)
            => Ok(new { success = true, data = new { avatarUrl = await _avatars.UploadAsync(UserId, file) }, message = "تم تحديث الصورة" });

        // DELETE: api/profile/avatar
        [HttpDelete("avatar")]
        public async Task<IActionResult> Remove()
        {
            await _avatars.RemoveAsync(UserId);
            return Ok(new { success = true, data = new { avatarUrl = (string?)null }, message = "تم حذف الصورة" });
        }
    }
}
