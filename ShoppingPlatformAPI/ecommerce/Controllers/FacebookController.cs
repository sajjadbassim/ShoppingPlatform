using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Facebook;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Services.FacebookService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ecommerce.Controllers
{
    // ربط متجر التاجر بصفحة فيسبوك (تسجيل دخول فيسبوك للأعمال).
    // التدفق: connect-url (بـ JWT) ← فيسبوك ← callback ← ربط مباشر، أو اختيار صفحة إن كانت أكثر من واحدة.
    // المسار يطابق الروابط المسجّلة في تطبيق Meta (Redirect / Deauthorize / Data deletion)
    [ApiController]
    [Route("api/integrations/facebook")]
    [Authorize(Policy = PolicyNames.VendorOnly)]
    public class FacebookController : ControllerBase
    {
        private const string NonceCookieName = "facebook_oauth_nonce";
        private const string CookiePath = "/api/integrations/facebook";

        private readonly IFacebookService _facebookService;
        private readonly ICurrentUserService _currentUser;
        private readonly FacebookOptions _options;

        public FacebookController(IFacebookService facebookService, ICurrentUserService currentUser, IOptions<FacebookOptions> options)
        {
            _facebookService = facebookService;
            _currentUser = currentUser;
            _options = options.Value;
        }

        // GET: api/integrations/facebook/status
        [HttpGet("status")]
        public async Task<ActionResult<ApiResponse<FacebookStatusDto>>> GetStatus(CancellationToken ct)
        {
            var status = await _facebookService.GetStatusAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<FacebookStatusDto>.Ok(status));
        }

        // GET: api/integrations/facebook/connect-url — الخطوة 1
        [HttpGet("connect-url")]
        public async Task<ActionResult<ApiResponse<FacebookConnectUrlDto>>> GetConnectUrl(CancellationToken ct)
        {
            var start = await _facebookService.StartConnectAsync(_currentUser.UserId, ct);

            Response.Cookies.Append(NonceCookieName, start.Nonce, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,   // يُرسَل مع التوجيه العائد من facebook.com
                Path = CookiePath,
                MaxAge = TimeSpan.FromMinutes(10),
                IsEssential = true
            });

            return Ok(ApiResponse<FacebookConnectUrlDto>.Ok(new FacebookConnectUrlDto { AuthorizeUrl = start.AuthorizeUrl }));
        }

        // GET: api/integrations/facebook/callback — الخطوة 2 (فيسبوك يعيد المتصفح إلى هنا)
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

            var result = await _facebookService.CompleteConnectAsync(code, state, nonce, error, ct);

            var separator = _options.AfterConnectUrl.Contains('?') ? "&" : "?";
            var url = _options.AfterConnectUrl + separator + "facebook=" +
                      (!result.Success ? "error" : result.SelectionId != null ? "choose" : "connected");
            if (result.SelectionId != null)
                url += "&selection=" + Uri.EscapeDataString(result.SelectionId);
            if (!result.Success && result.Reason != null)
                url += "&reason=" + Uri.EscapeDataString(result.Reason);

            return Redirect(url);
        }

        // GET: api/integrations/facebook/pages?selection=... — الصفحات المنتظرة للاختيار
        [HttpGet("pages")]
        public async Task<ActionResult<ApiResponse<List<FacebookPageOptionDto>>>> GetPendingPages([FromQuery] string selection, CancellationToken ct)
        {
            var pages = await _facebookService.GetPendingPagesAsync(_currentUser.UserId, selection, ct);
            return Ok(ApiResponse<List<FacebookPageOptionDto>>.Ok(pages));
        }

        // POST: api/integrations/facebook/pages/select — { selectionId, pageId }
        [HttpPost("pages/select")]
        public async Task<ActionResult<ApiResponse<FacebookStatusDto>>> SelectPage(FacebookSelectPageDto dto, CancellationToken ct)
        {
            var status = await _facebookService.SelectPageAsync(_currentUser.UserId, dto, ct);
            return Ok(ApiResponse<FacebookStatusDto>.Ok(status, "تم ربط صفحة فيسبوك"));
        }

        // POST: api/integrations/facebook/sync
        [HttpPost("sync")]
        public async Task<ActionResult<ApiResponse<FacebookStatusDto>>> Sync(CancellationToken ct)
        {
            var status = await _facebookService.SyncAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<FacebookStatusDto>.Ok(status, "تمت مزامنة المنشورات"));
        }

        // GET: api/integrations/facebook/media
        [HttpGet("media")]
        public async Task<ActionResult<ApiResponse<List<SocialFeedItemDto>>>> GetMedia(CancellationToken ct)
        {
            var media = await _facebookService.GetMediaAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<List<SocialFeedItemDto>>.Ok(media));
        }

        // PATCH: api/integrations/facebook/media/{id} — إخفاء/إظهار أو ربط بمنتج
        [HttpPatch("media/{id:guid}")]
        public async Task<ActionResult<ApiResponse<SocialFeedItemDto>>> UpdateMedia(Guid id, SocialMediaUpdateDto dto, CancellationToken ct)
        {
            var media = await _facebookService.UpdateMediaAsync(_currentUser.UserId, id, dto, ct);
            return Ok(ApiResponse<SocialFeedItemDto>.Ok(media));
        }

        // PUT: api/integrations/facebook/settings
        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<FacebookSettingsDto>>> UpdateSettings(FacebookSettingsUpdateDto dto, CancellationToken ct)
        {
            var settings = await _facebookService.UpdateSettingsAsync(_currentUser.UserId, dto, ct);
            return Ok(ApiResponse<FacebookSettingsDto>.Ok(settings, "تم حفظ الإعدادات"));
        }

        // DELETE: api/integrations/facebook/connection
        [HttpDelete("connection")]
        public async Task<ActionResult<ApiResponse<object>>> Disconnect(CancellationToken ct)
        {
            await _facebookService.DisconnectAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<object>.Ok(null!, "تم إلغاء ربط صفحة فيسبوك"));
        }

        // ===================================
        // استدعاءات Meta (موقّعة بـ signed_request — لا JWT)
        // ===================================

        // POST: api/integrations/facebook/deauthorize — أزال المستخدم التطبيق من إعدادات فيسبوك
        [AllowAnonymous]
        [HttpPost("deauthorize")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> Deauthorize([FromForm(Name = "signed_request")] string? signedRequest, CancellationToken ct)
        {
            return await _facebookService.HandleDeauthorizeAsync(signedRequest, ct) ? Ok() : BadRequest();
        }

        // POST: api/integrations/facebook/data-deletion — طلب حذف البيانات. Meta تتوقع { url, confirmation_code }
        [AllowAnonymous]
        [HttpPost("data-deletion")]
        [Consumes("application/x-www-form-urlencoded")]
        public async Task<IActionResult> DataDeletion([FromForm(Name = "signed_request")] string? signedRequest, CancellationToken ct)
        {
            var confirmation = await _facebookService.HandleDataDeletionAsync(signedRequest, ct);
            if (confirmation == null) return BadRequest();

            var origin = Uri.TryCreate(_options.RedirectUri, UriKind.Absolute, out var redirect)
                ? redirect.GetLeftPart(UriPartial.Authority)
                : $"{Request.Scheme}://{Request.Host}";
            return new JsonResult(new
            {
                url = $"{origin}/vendor/social?facebook=deleted&code={confirmation}",
                confirmation_code = confirmation
            });
        }
    }
}
