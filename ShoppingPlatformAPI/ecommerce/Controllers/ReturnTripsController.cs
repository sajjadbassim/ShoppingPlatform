using ecommerce.Core.Constants;
using ecommerce.Common;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Services.ReturnTripService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // المرتجعات (بضاعة لم تُسلَّم تعود لمتاجرها) — تقرير منفصل عن الطلبات للعمليات والإدارة
    [ApiController]
    [Route("api/ops/return-trips")]
    [Authorize(Policy = PolicyNames.OpsOrAdmin)]
    public class ReturnTripsController : ControllerBase
    {
        private readonly IReturnTripService _trips;

        public ReturnTripsController(IReturnTripService trips) => _trips = trips;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/ops/return-trips?from=2026-10-01&to=2026-10-14 — بلا فترة = آخر 30 يوماً (+ كل المفتوحة)
        [HttpGet]
        public async Task<ActionResult<ApiResponse<ReturnTripReportDto>>> Report([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
            => Ok(ApiResponse<ReturnTripReportDto>.Ok(await _trips.GetReportAsync(from, to, ct)));

        // POST: api/ops/return-trips/{id}/received — تأكيد الاستلام نيابة عن المتجر
        [HttpPost("{id:guid}/received")]
        public async Task<ActionResult<ApiResponse<ReturnTripDto>>> Received(Guid id, CancellationToken ct)
            => Ok(ApiResponse<ReturnTripDto>.Ok(await _trips.ConfirmReceivedAsync(id, UserId, null, ct), "تم تأكيد استلام البضاعة وإعادتها للمخزون"));
    }
}
