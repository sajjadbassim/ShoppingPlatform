using System.Security.Claims;
using ecommerce.Core.Constants;
using ecommerce.Services.ActivityLogService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // سجل النشاط — كل دور يرى نطاقه (الخدمة تفرضه)، والزبون لا سجل له
    [ApiController]
    [Route("api/activity")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Ops + "," + UserRoles.Vendor + "," + UserRoles.Driver)]
    public class ActivityLogController : ControllerBase
    {
        private readonly IActivityLogService _log;

        public ActivityLogController(IActivityLogService log) => _log = log;

        // GET: api/activity?page=&pageSize=&kind=&role=&userId=&vendorId=&mine=&failedLoginsOnly=&from=&to=&search=
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] ActivityLogQuery q, CancellationToken ct)
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var role = User.FindFirstValue(ClaimTypes.Role)!;
            var (items, total) = await _log.QueryAsync(q, userId, role, ct);
            var size = Math.Clamp(q.PageSize, 1, 100);
            return Ok(new
            {
                success = true,
                data = items,
                pagination = new { page = Math.Max(1, q.Page), pageSize = size, totalCount = total, totalPages = (int)Math.Ceiling(total / (double)size) },
                retentionDays = ActivityLogRetentionService.RetentionDays,
            });
        }

        // DELETE: api/activity/old — الأدمن: يحذف كل ما هو أقدم من 30 يوماً ويبقي آخر 30 يوماً
        [HttpDelete("old")]
        [Authorize(Roles = UserRoles.Admin)]
        public async Task<IActionResult> PurgeOld(CancellationToken ct)
        {
            var deleted = await _log.PurgeOlderThanAsync(KeepDays, ct);
            HttpContext.Items[ActivityLogService.NoteKey] = $"{deleted:N0} سجل";
            return Ok(new { success = true, data = new { deleted, keepDays = KeepDays }, message = $"حُذف {deleted:N0} سجل — بقي نشاط آخر {KeepDays} يوماً" });
        }

        public const int KeepDays = 30;
    }
}
