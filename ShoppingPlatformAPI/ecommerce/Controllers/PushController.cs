using ecommerce.Data;
using ecommerce.Services.PushService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // اشتراكات إشعارات الدفع (Web Push) للجهاز الحالي
    [ApiController]
    [Route("api/push")]
    [Authorize]
    public class PushController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PushOptions _options;
        private readonly IPushQueue _push;

        public PushController(AppDbContext context, IOptions<PushOptions> options, IPushQueue push)
        {
            _context = context;
            _options = options.Value;
            _push = push;
        }

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/push/public-key — المفتاح العام يحتاجه المتصفح للاشتراك
        [AllowAnonymous]
        [HttpGet("public-key")]
        public IActionResult PublicKey() => _options.IsConfigured
            ? Ok(new { success = true, data = new { publicKey = _options.PublicKey } })
            : Ok(new { success = true, data = new { publicKey = (string?)null } });

        // POST: api/push/subscribe — يربط هذا الجهاز بالحساب الحالي (ينقله إن كان مربوطاً بحساب آخر)
        [HttpPost("subscribe")]
        public async Task<IActionResult> Subscribe([FromBody] PushSubscribeDto dto)
        {
            if (!Uri.TryCreate(dto.Endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                return BadRequest(new { success = false, message = "اشتراك غير صالح" });

            var existing = await _context.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint);
            if (existing == null)
            {
                _context.PushSubscriptions.Add(new Core.Models.PushSubscription
                {
                    UserId = UserId,
                    Endpoint = dto.Endpoint,
                    P256dh = dto.P256dh,
                    Auth = dto.Auth,
                    UserAgent = Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua[..Math.Min(ua.Length, 300)] : null,
                });
            }
            else
            {
                existing.UserId = UserId;
                existing.P256dh = dto.P256dh;
                existing.Auth = dto.Auth;
            }
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // POST: api/push/test — إشعار تجريبي لأجهزة المستخدم الحالي
        [HttpPost("test")]
        public async Task<IActionResult> Test()
        {
            var devices = await _context.PushSubscriptions.CountAsync(s => s.UserId == UserId);
            if (devices == 0)
                return BadRequest(new { success = false, message = "لم تُفعَّل الإشعارات على أي جهاز بعد" });
            _push.Enqueue(new PushMessage("إشعار تجريبي — الإشعارات تعمل على هذا الجهاز ✓", UserId: UserId, Url: "/settings", Tag: "push-test"));
            return Ok(new { success = true, data = new { devices } });
        }

        // POST: api/push/unsubscribe — عند تسجيل الخروج أو إيقاف الإشعارات على هذا الجهاز
        [HttpPost("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeDto dto)
        {
            await _context.PushSubscriptions
                .Where(s => s.Endpoint == dto.Endpoint && s.UserId == UserId)
                .ExecuteDeleteAsync();
            return Ok(new { success = true });
        }
    }

    public class PushSubscribeDto
    {
        [Required, MaxLength(700)] public string Endpoint { get; set; }
        [Required, MaxLength(200)] public string P256dh { get; set; }
        [Required, MaxLength(100)] public string Auth { get; set; }
    }

    public class PushUnsubscribeDto
    {
        [Required, MaxLength(700)] public string Endpoint { get; set; }
    }
}
