using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Data;
using ecommerce.Services.OrderTimingService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // كم استغرق الطلب للوصول ومدة كل مرحلة
    [ApiController]
    [Route("api/order-timing")]
    [Authorize]
    public class OrderTimingController : ControllerBase
    {
        private const int MaxIds = 100;
        private readonly IOrderTimingService _timing;
        private readonly AppDbContext _context;

        public OrderTimingController(IOrderTimingService timing, AppDbContext context)
        {
            _timing = timing;
            _context = context;
        }

        private bool IsStaff => User.IsInRole(UserRoles.Admin) || User.IsInRole(UserRoles.Ops);
        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/order-timing/{orderId} — الفريق أو صاحب الطلب
        [HttpGet("{orderId:guid}")]
        public async Task<ActionResult<ApiResponse<OrderTimingDto>>> Get(Guid orderId, CancellationToken ct)
        {
            if (!IsStaff && !await _context.Orders.AnyAsync(o => o.Id == orderId && o.CustomerId == UserId, ct))
                return NotFound(ApiResponse<OrderTimingDto>.Fail("الطلب غير موجود"));

            var timings = await _timing.GetTimingsAsync(new[] { orderId }, ct);
            return timings.TryGetValue(orderId, out var t)
                ? Ok(ApiResponse<OrderTimingDto>.Ok(t))
                : NotFound(ApiResponse<OrderTimingDto>.Fail("الطلب غير موجود"));
        }

        // GET: api/order-timing?ids=a,b,c — للقوائم (العمليات والإدارة): المدة واللون فقط
        [HttpGet]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<List<object>>>> List([FromQuery] string ids, CancellationToken ct)
        {
            var list = (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => Guid.TryParse(x, out var g) ? g : Guid.Empty)
                .Where(g => g != Guid.Empty).Distinct().Take(MaxIds).ToList();

            var timings = await _timing.GetTimingsAsync(list, ct);
            return Ok(ApiResponse<List<object>>.Ok(timings.Values
                .Select(t => (object)new { t.OrderId, t.TotalMinutes, t.ElapsedMinutes, t.Speed, t.SlowestStage })
                .ToList()));
        }
    }
}
