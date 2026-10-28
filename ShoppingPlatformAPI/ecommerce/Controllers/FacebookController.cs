using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Facebook;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Exceptions;
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
        // ?client=app: الربط من تطبيق الموبايل — لا كوكي، ويُكمَل بـ POST connect/complete بعد عودة المتصفح إلى رابط التطبيق
        [HttpGet("connect-url")]
        public async Task<ActionResult<ApiResponse<FacebookConnectUrlDto>>> GetConnectUrl([FromQuery] string? client, CancellationToken ct)
        {
            var forApp = string.Equals(client, "app", StringComparison.OrdinalIgnoreCase);
            var start = await _facebookService.StartConnectAsync(_currentUser.UserId, forApp, ct);

            if (!forApp)
            {
                Response.Cookies.Append(NonceCookieName, start.Nonce, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = Request.IsHttps,
                    SameSite = SameSiteMode.Lax,   // يُرسَل مع التوجيه العائد من facebook.com
                    Path = CookiePath,
                    MaxAge = TimeSpan.FromMinutes(10),
                    IsEssential = true
                });
            }

            return Ok(ApiResponse<FacebookConnectUrlDto>.Ok(new FacebookConnectUrlDto { AuthorizeUrl = start.AuthorizeUrl }));
        }

        // POST: api/integrations/facebook/connect/complete — { code, state } من رابط التطبيق العميق (الخطوة 3 للتطبيق)
        // أكثر من صفحة: يعيد selectionId ويكمل التطبيق بـ GET pages ثم POST pages/select
        [HttpPost("connect/complete")]
        public async Task<ActionResult<ApiResponse<FacebookCompleteConnectResultDto>>> CompleteConnect(FacebookCompleteConnectDto dto, CancellationToken ct)
        {
            var result = await _facebookService.CompleteAppConnectAsync(_currentUser.UserId, dto.Code, dto.State, ct);
            if (!result.Success)
                throw new BusinessRuleException(ConnectFailureMessage(result.Reason));

            if (result.SelectionId != null)
                return Ok(ApiResponse<FacebookCompleteConnectResultDto>.Ok(new FacebookCompleteConnectResultDto { SelectionId = result.SelectionId }));

            var status = await _facebookService.GetStatusAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<FacebookCompleteConnectResultDto>.Ok(new FacebookCompleteConnectResultDto { Status = status }, "تم ربط صفحة فيسبوك"));
        }

        private static string ConnectFailureMessage(string? reason) => reason switch
        {
            "denied" => "لم تمنح فيسبوك الإذن للربط",
            "expired" => "انتهت مهلة طلب الربط، حاول مرة أخرى",
            "token" => "تعذّر إكمال الربط مع فيسبوك، حاول مرة أخرى",
            "no_pages" => "لم تُمنح أي صفحة فيسبوك. اختر صفحة تديرها عند الربط",
            "busy" => "عملية أخرى جارية على حسابك، حاول بعد لحظات",
            _ => "تعذّر التحقق من طلب الربط، حاول مرة أخرى"
        };

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
            // الربط من التطبيق: لا يُكمَل هنا (لا كوكي ولا JWT) — يُعاد المتصفح إلى التطبيق ليكمله بـ JWT
            if (FacebookService.IsAppState(state))
                return Redirect(BuildAppReturnUrl(code, state, error));

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

        private string BuildAppReturnUrl(string? code, string? state, string? error)
        {
            var separator = _options.AppReturnUrl.Contains('?') ? "&" : "?";
            var url = _options.AppReturnUrl + separator + "platform=facebook";
            if (!string.IsNullOrEmpty(code)) url += "&code=" + Uri.EscapeDataString(code);
            if (!string.IsNullOrEmpty(state)) url += "&state=" + Uri.EscapeDataString(state);
            if (!string.IsNullOrEmpty(error)) url += "&error=" + Uri.EscapeDataString(error);
            return url;
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
