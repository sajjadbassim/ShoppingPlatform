using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.Interfaces;
using ecommerce.Services.SocialPublishService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // وسائط النشر المشتركة بين المنصات (إنستغرام الآن، وتيك توك وفيسبوك لاحقاً)
    [ApiController]
    [Route("api/social/publish")]
    [Authorize(Policy = PolicyNames.VendorOnly)]
    public class SocialPublishController : ControllerBase
    {
        private const long MaxUploadBytes = SocialMediaStore.MaxVideoBytes + 1024 * 1024;

        private readonly ISocialMediaStore _store;
        private readonly ICurrentUserService _currentUser;

        public SocialPublishController(ISocialMediaStore store, ICurrentUserService currentUser)
        {
            _store = store;
            _currentUser = currentUser;
        }

        // POST: api/social/publish/uploads — صورة أو فيديو من الاستوديو، يعيد { url, type }
        [HttpPost("uploads")]
        [RequestSizeLimit(MaxUploadBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
        public async Task<ActionResult<ApiResponse<SocialUploadDto>>> Upload(IFormFile file, CancellationToken ct)
            => Ok(ApiResponse<SocialUploadDto>.Ok(await _store.UploadAsync(_currentUser.UserId, file, ct)));
    }
}
