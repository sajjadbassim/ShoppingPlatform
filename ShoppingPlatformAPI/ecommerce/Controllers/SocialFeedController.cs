using ecommerce.Common;
using ecommerce.Core.DTO.Social;
using ecommerce.Services.SocialFeedService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ecommerce.Controllers
{
    // محتوى حسابات التواصل للزوار — تيك توك وإنستغرام معاً
    [ApiController]
    [Route("api/social")]
    [AllowAnonymous]
    public class SocialFeedController : ControllerBase
    {
        private readonly ISocialFeedService _feed;

        public SocialFeedController(ISocialFeedService feed) => _feed = feed;

        // GET: api/social/stores/{vendorId}/feed — تبويب المحتوى في صفحة المتجر
        [HttpGet("stores/{vendorId:guid}/feed")]
        public async Task<ActionResult<ApiResponse<SocialStoreFeedDto>>> GetStoreFeed(Guid vendorId, CancellationToken ct)
        {
            var feed = await _feed.GetStoreFeedAsync(vendorId, ct);
            return Ok(ApiResponse<SocialStoreFeedDto>.Ok(feed));
        }

        // POST: api/social/stores/{vendorId}/feed/refresh — عند فتح التبويب: يجلب الجديد من المنصات
        [HttpPost("stores/{vendorId:guid}/feed/refresh")]
        [EnableRateLimiting("social-refresh")]
        public async Task<ActionResult<ApiResponse<SocialStoreFeedDto>>> RefreshStoreFeed(Guid vendorId, CancellationToken ct)
        {
            var feed = await _feed.RefreshStoreFeedAsync(vendorId, ct);
            return Ok(ApiResponse<SocialStoreFeedDto>.Ok(feed));
        }

        // GET: api/social/reels?page=1&pageSize=10 — صفحة "ريلز": فيديوهات كل المتاجر
        [HttpGet("reels")]
        public async Task<ActionResult<ApiResponse<SocialReelsPageDto>>> GetReels(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
        {
            var reels = await _feed.GetReelsAsync(page, pageSize, ct);
            return Ok(ApiResponse<SocialReelsPageDto>.Ok(reels));
        }

        // POST: api/social/reels/refresh?pageSize=10 — عند فتح صفحة ريلز أو سحبها للتحديث
        [HttpPost("reels/refresh")]
        [EnableRateLimiting("social-refresh")]
        public async Task<ActionResult<ApiResponse<SocialReelsPageDto>>> RefreshReels(
            [FromQuery] int pageSize = 10, CancellationToken ct = default)
        {
            var reels = await _feed.RefreshReelsAsync(pageSize, ct);
            return Ok(ApiResponse<SocialReelsPageDto>.Ok(reels));
        }
    }
}
