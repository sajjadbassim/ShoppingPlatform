using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Instagram;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Services.InstagramService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ecommerce.Controllers
{
    // ربط متجر التاجر بحساب إنستغرام احترافي (Instagram API with Instagram Login).
    // التدفق: الواجهة تطلب connect-url (بـ JWT) ← المتصفح يذهب لإنستغرام ← إنستغرام يعيده إلى callback.
    // المسار يطابق الروابط المسجّلة في تطبيق Meta (Redirect / Deauthorize / Data deletion)
    [ApiController]
    [Route("api/integrations/instagram")]
    [Authorize(Policy = PolicyNames.VendorOnly)]
    public class InstagramController : ControllerBase
    {
        // كوكي يثبت أن العودة من إنستغرام تمّت في نفس المتصفح الذي بدأ الربط
        private const string NonceCookieName = "instagram_oauth_nonce";
        private const string CookiePath = "/api/integrations/instagram";

        private readonly IInstagramService _instagramService;
        private readonly ICurrentUserService _currentUser;
        private readonly InstagramOptions _options;

        public InstagramController(IInstagramService instagramService, ICurrentUserService currentUser, IOptions<InstagramOptions> options)
        {
            _instagramService = instagramService;
            _currentUser = currentUser;
            _options = options.Value;
        }

        // GET: api/integrations/instagram/status
        [HttpGet("status")]
        public async Task<ActionResult<ApiResponse<InstagramStatusDto>>> GetStatus(CancellationToken ct)
        {
            var status = await _instagramService.GetStatusAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<InstagramStatusDto>.Ok(status));
        }

        // GET: api/integrations/instagram/connect-url — الخطوة 1
        [HttpGet("connect-url")]
        public async Task<ActionResult<ApiResponse<InstagramConnectUrlDto>>> GetConnectUrl(CancellationToken ct)
        {
            var start = await _instagramService.StartConnectAsync(_currentUser.UserId, ct);

            Response.Cookies.Append(NonceCookieName, start.Nonce, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,   // يُرسَل مع التوجيه العائد من instagram.com
                Path = CookiePath,
                MaxAge = TimeSpan.FromMinutes(10),
                IsEssential = true
            });

            return Ok(ApiResponse<InstagramConnectUrlDto>.Ok(new InstagramConnectUrlDto { AuthorizeUrl = start.AuthorizeUrl }));
        }

        // GET: api/integrations/instagram/callback?code=...&state=... — الخطوة 2 (إنستغرام يعيد المتصفح إلى هنا)
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

            var result = await _instagramService.CompleteConnectAsync(code, state, nonce, error, ct);

            var separator = _options.AfterConnectUrl.Contains('?') ? "&" : "?";
            var url = _options.AfterConnectUrl + separator + "instagram=" + (result.Success ? "connected" : "error");
            if (!result.Success && result.Reason != null)
                url += "&reason=" + Uri.EscapeDataString(result.Reason);

            return Redirect(url);
        }

        // POST: api/integrations/instagram/sync
        [HttpPost("sync")]
        public async Task<ActionResult<ApiResponse<InstagramStatusDto>>> Sync(CancellationToken ct)
        {
            var status = await _instagramService.SyncAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<InstagramStatusDto>.Ok(status, "تمت مزامنة المنشورات"));
        }

        // GET: api/integrations/instagram/media
        [HttpGet("media")]
        public async Task<ActionResult<ApiResponse<List<SocialFeedItemDto>>>> GetMedia(CancellationToken ct)
        {
            var media = await _instagramService.GetMediaAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<List<SocialFeedItemDto>>.Ok(media));
        }

        // PATCH: api/integrations/instagram/media/{id} — إخفاء/إظهار أو ربط بمنتج
        [HttpPatch("media/{id:guid}")]
        public async Task<ActionResult<ApiResponse<SocialFeedItemDto>>> UpdateMedia(Guid id, SocialMediaUpdateDto dto, CancellationToken ct)
        {
            var media = await _instagramService.UpdateMediaAsync(_currentUser.UserId, id, dto, ct);
            return Ok(ApiResponse<SocialFeedItemDto>.Ok(media));
        }

        // PUT: api/integrations/instagram/settings
        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<InstagramSettingsDto>>> UpdateSettings(InstagramSettingsUpdateDto dto, CancellationToken ct)
        {
            var settings = await _instagramService.UpdateSettingsAsync(_currentUser.UserId, dto, ct);
            return Ok(ApiResponse<InstagramSettingsDto>.Ok(settings, "تم حفظ الإعدادات"));
        }

        // DELETE: api/integrations/instagram/connection
        [HttpDelete("connection")]
        public async Task<ActionResult<ApiResponse<object>>> Disconnect(CancellationToken ct)
        {
            await _instagramService.DisconnectAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<object>.Ok(null!, "تم إلغاء ربط حساب إنستغرام"));
        }

        // ===================================
        // استدعاءات Meta (موقّعة بـ signed_request — لا JWT)
        // ===================================

        // POST: api/integrations/instagram/deauthorize — أزال صاحب الحساب التطبيق من إعدادات إنستغرام
        [AllowAnonymous]
        [HttpPost("deauthorize")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> Deauthorize([FromForm(Name = "signed_request")] string? signedRequest, CancellationToken ct)
        {
            return await _instagramService.HandleDeauthorizeAsync(signedRequest, ct) ? Ok() : BadRequest();
        }

        // POST: api/integrations/instagram/data-deletion — طلب حذف البيانات. Meta تتوقع { url, confirmation_code }
        [AllowAnonymous]
        [HttpPost("data-deletion")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> DataDeletion([FromForm(Name = "signed_request")] string? signedRequest, CancellationToken ct)
        {
            var confirmation = await _instagramService.HandleDataDeletionAsync(signedRequest, ct);
            if (confirmation == null) return BadRequest();

            var origin = Uri.TryCreate(_options.RedirectUri, UriKind.Absolute, out var redirect)
                ? redirect.GetLeftPart(UriPartial.Authority)
                : $"{Request.Scheme}://{Request.Host}";
            return new JsonResult(new
            {
                url = $"{origin}/vendor/social?instagram=deleted&code={confirmation}",
                confirmation_code = confirmation
            });
        }
    }
}
