using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Services.DriverTrackingService;
using ecommerce.Services.OpsReportService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // التتبع المباشر والتقارير — للعمليات والإدارة
    [ApiController]
    [Route("api/ops")]
    [Authorize(Policy = PolicyNames.OpsOrAdmin)]
    public class OpsTrackingController : ControllerBase
    {
        private readonly IDriverTrackingService _tracking;
        private readonly IOpsReportService _reports;

        public OpsTrackingController(IDriverTrackingService tracking, IOpsReportService reports)
        {
            _tracking = tracking;
            _reports = reports;
        }

        // GET: api/ops/tracking — السائقون بآخر مواقعهم + الطلبات النشطة
        [HttpGet("tracking")]
        public async Task<ActionResult<ApiResponse<TrackingBoardDto>>> GetBoard(CancellationToken ct)
            => Ok(ApiResponse<TrackingBoardDto>.Ok(await _tracking.GetBoardAsync(ct)));

        // POST: api/ops/drivers/{id}/tracking-link — رابط جديد لمشاركة الموقع (يُبطل القديم)
        [HttpPost("drivers/{driverId:guid}/tracking-link")]
        public async Task<ActionResult<ApiResponse<DriverTrackingLinkDto>>> CreateLink(Guid driverId, CancellationToken ct)
            => Ok(ApiResponse<DriverTrackingLinkDto>.Ok(await _tracking.CreateLinkAsync(driverId, ct)));

        // DELETE: api/ops/drivers/{id}/tracking-link — إيقاف المشاركة وحذف آخر موقع
        [HttpDelete("drivers/{driverId:guid}/tracking-link")]
        public async Task<ActionResult<ApiResponse<object>>> RevokeLink(Guid driverId, CancellationToken ct)
        {
            await _tracking.RevokeLinkAsync(driverId, ct);
            return Ok(ApiResponse<object>.Ok(null!, "تم إيقاف رابط التتبع"));
        }

        // GET: api/ops/reports?from=2026-09-01&to=2026-09-30 — التواريخ بتوقيت العراق
        [HttpGet("reports")]
        public async Task<ActionResult<ApiResponse<OpsReportDto>>> GetReport(
            [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
            => Ok(ApiResponse<OpsReportDto>.Ok(await _reports.GetReportAsync(from, to, ct)));
    }

    // صفحة السائق — بلا تسجيل دخول، الرمز في الرابط هو الصلاحية
    [ApiController]
    [Route("api/driver-tracking")]
    [AllowAnonymous]
    public class DriverTrackingController : ControllerBase
    {
        private readonly IDriverTrackingService _tracking;

        public DriverTrackingController(IDriverTrackingService tracking) => _tracking = tracking;

        // GET: api/driver-tracking/{token}
        [HttpGet("{token}")]
        public async Task<ActionResult<ApiResponse<DriverTrackingInfoDto>>> Get(string token, CancellationToken ct)
            => Ok(ApiResponse<DriverTrackingInfoDto>.Ok(await _tracking.GetByTokenAsync(token, ct)));

        // POST: api/driver-tracking/{token}/location
        [HttpPost("{token}/location")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateLocation(
            string token, [FromBody] DriverLocationUpdateDto dto, CancellationToken ct)
        {
            await _tracking.UpdateLocationAsync(token, dto, ct);
            return Ok(ApiResponse<object>.Ok(null!));
        }
    }
}
