using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.TikTok;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Services.TikTokService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace ecommerce.Controllers
{
    // ربط متجر التاجر بحساب تيك توك.
    // التدفق: الواجهة تطلب connect-url (بـ JWT) ← المتصفح يذهب لتيك توك ← تيك توك يعيده إلى callback
    [ApiController]
    [Route("api/tiktok")]
    [Authorize(Policy = PolicyNames.VendorOnly)]
    public class TikTokController : ControllerBase
    {
        // كوكي يثبت أن العودة من تيك توك تمّت في نفس المتصفح الذي بدأ الربط
        private const string NonceCookieName = "tiktok_oauth_nonce";
        private const string CookiePath = "/api/tiktok";

        private readonly ITikTokService _tikTokService;
        private readonly ICurrentUserService _currentUser;
        private readonly TikTokOptions _options;

        public TikTokController(ITikTokService tikTokService, ICurrentUserService currentUser, IOptions<TikTokOptions> options)
        {
            _tikTokService = tikTokService;
            _currentUser = currentUser;
            _options = options.Value;
        }

        // GET: api/tiktok/status
        [HttpGet("status")]
        public async Task<ActionResult<ApiResponse<TikTokStatusDto>>> GetStatus(CancellationToken ct)
        {
            var status = await _tikTokService.GetStatusAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<TikTokStatusDto>.Ok(status));
        }

        // GET: api/tiktok/connect-url — الخطوة 1
        [HttpGet("connect-url")]
        public async Task<ActionResult<ApiResponse<TikTokConnectUrlDto>>> GetConnectUrl(CancellationToken ct)
        {
            var start = await _tikTokService.StartConnectAsync(_currentUser.UserId, ct);

            Response.Cookies.Append(NonceCookieName, start.Nonce, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,   // يُرسَل مع التوجيه العائد من tiktok.com
                Path = CookiePath,
                MaxAge = TimeSpan.FromMinutes(10),
                IsEssential = true
            });

            return Ok(ApiResponse<TikTokConnectUrlDto>.Ok(new TikTokConnectUrlDto { AuthorizeUrl = start.AuthorizeUrl }));
        }

        // GET: api/tiktok/callback?code=...&state=... — الخطوة 2 (تيك توك يعيد المتصفح إلى هنا)
        // AllowAnonymous: التوجيه لا يحمل JWT؛ المتجر يُعرف من state المحفوظ في الخادم + كوكي المتصفح
        [AllowAnonymous]
        [HttpGet("callback")]
        public async Task<IActionResult> Callback(
            [FromQuery] string? code,
            [FromQuery] string? state,
            [FromQuery] string? error,
            CancellationToken ct)
        {
            var nonce = Request.Cookies[NonceCookieName];
            Response.Cookies.Delete(NonceCookieName, new CookieOptions { Path = CookiePath });

            var result = await _tikTokService.CompleteConnectAsync(code, state, nonce, error, ct);

            var separator = _options.AfterConnectUrl.Contains('?') ? "&" : "?";
            var url = _options.AfterConnectUrl + separator + "tiktok=" + (result.Success ? "connected" : "error");
            if (!result.Success && result.Reason != null)
                url += "&reason=" + Uri.EscapeDataString(result.Reason);

            return Redirect(url);
        }

        // POST: api/tiktok/sync
        [HttpPost("sync")]
        public async Task<ActionResult<ApiResponse<TikTokStatusDto>>> Sync(CancellationToken ct)
        {
            var status = await _tikTokService.SyncAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<TikTokStatusDto>.Ok(status, "تمت مزامنة الفيديوهات"));
        }

        // GET: api/tiktok/videos
        [HttpGet("videos")]
        public async Task<ActionResult<ApiResponse<List<TikTokVideoDto>>>> GetVideos(CancellationToken ct)
        {
            var videos = await _tikTokService.GetVideosAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<List<TikTokVideoDto>>.Ok(videos));
        }

        // PATCH: api/tiktok/videos/{id} — إخفاء/إظهار أو ربط بمنتج
        [HttpPatch("videos/{id:guid}")]
        public async Task<ActionResult<ApiResponse<TikTokVideoDto>>> UpdateVideo(Guid id, TikTokVideoUpdateDto dto, CancellationToken ct)
        {
            var video = await _tikTokService.UpdateVideoAsync(_currentUser.UserId, id, dto, ct);
            return Ok(ApiResponse<TikTokVideoDto>.Ok(video));
        }

        // PUT: api/tiktok/settings
        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<TikTokSettingsDto>>> UpdateSettings(TikTokSettingsUpdateDto dto, CancellationToken ct)
        {
            var settings = await _tikTokService.UpdateSettingsAsync(_currentUser.UserId, dto, ct);
            return Ok(ApiResponse<TikTokSettingsDto>.Ok(settings, "تم حفظ الإعدادات"));
        }

        // DELETE: api/tiktok/connection
        [HttpDelete("connection")]
        public async Task<ActionResult<ApiResponse<object>>> Disconnect(CancellationToken ct)
        {
            await _tikTokService.DisconnectAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<object>.Ok(null!, "تم إلغاء ربط حساب تيك توك"));
        }

        // GET: api/tiktok/reels?page=1&pageSize=10 — صفحة "ريلز": فيديوهات كل المتاجر
        [AllowAnonymous]
        [HttpGet("reels")]
        public async Task<ActionResult<ApiResponse<TikTokReelsPageDto>>> GetReels(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
        {
            var reels = await _tikTokService.GetReelsAsync(page, pageSize, ct);
            return Ok(ApiResponse<TikTokReelsPageDto>.Ok(reels));
        }

        // POST: api/tiktok/reels/refresh?pageSize=10 — عند فتح صفحة ريلز أو سحبها للتحديث: يجلب الجديد من تيك توك
        // عام: يزامن كل الحسابات المعروضة، مع منع التكرار (مزامنة واحدة لكل متجر كل StoreRefreshSeconds وتحديث واحد في نفس الوقت)
        [AllowAnonymous]
        [HttpPost("reels/refresh")]
        [EnableRateLimiting("social-refresh")]
        public async Task<ActionResult<ApiResponse<TikTokReelsPageDto>>> RefreshReels(
            [FromQuery] int pageSize = 10, CancellationToken ct = default)
        {
            var reels = await _tikTokService.RefreshReelsAsync(pageSize, ct);
            return Ok(ApiResponse<TikTokReelsPageDto>.Ok(reels));
        }

        // GET: api/tiktok/stores/{vendorId}/videos — فيديوهات المتجر للزوار
        [AllowAnonymous]
        [HttpGet("stores/{vendorId:guid}/videos")]
        public async Task<ActionResult<ApiResponse<TikTokStoreFeedDto>>> GetStoreFeed(Guid vendorId, CancellationToken ct)
        {
            var feed = await _tikTokService.GetStoreFeedAsync(vendorId, ct);
            return Ok(ApiResponse<TikTokStoreFeedDto>.Ok(feed));
        }

        // POST: api/tiktok/stores/{vendorId}/videos/refresh — عند فتح تبويب الفيديوهات: يجلب الجديد من تيك توك
        // عام لكن محدود: مزامنة واحدة لكل متجر كل StoreRefreshSeconds مهما كثرت الطلبات
        [AllowAnonymous]
        [HttpPost("stores/{vendorId:guid}/videos/refresh")]
        [EnableRateLimiting("social-refresh")]
        public async Task<ActionResult<ApiResponse<TikTokStoreFeedDto>>> RefreshStoreFeed(Guid vendorId, CancellationToken ct)
        {
            var feed = await _tikTokService.RefreshStoreFeedAsync(vendorId, ct);
            return Ok(ApiResponse<TikTokStoreFeedDto>.Ok(feed));
        }
    }
}
