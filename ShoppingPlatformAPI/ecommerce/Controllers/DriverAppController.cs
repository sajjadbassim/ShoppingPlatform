using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;
using ecommerce.Services.DriverAppService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // لوحة السائق — كل شيء يخص السائق المسجّل دخوله فقط
    [ApiController]
    [Route("api/driver")]
    [Authorize(Policy = PolicyNames.DriverOnly)]
    public class DriverAppController : ControllerBase
    {
        private readonly IDriverAppService _app;

        public DriverAppController(IDriverAppService app) => _app = app;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/driver/me
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<DriverProfileDto>>> Me(CancellationToken ct)
            => Ok(ApiResponse<DriverProfileDto>.Ok(await _app.GetProfileAsync(UserId, ct)));

        // PUT: api/driver/me/work-status — متاح / استراحة / غير متصل
        [HttpPut("me/work-status")]
        public async Task<ActionResult<ApiResponse<DriverProfileDto>>> SetWorkStatus([FromBody] DriverWorkStatusDto dto, CancellationToken ct)
            => Ok(ApiResponse<DriverProfileDto>.Ok(await _app.SetWorkStatusAsync(UserId, dto.WorkStatus, ct)));

        // POST: api/driver/me/location
        [HttpPost("me/location")]
        public async Task<ActionResult<ApiResponse<object>>> Location([FromBody] DriverLocationUpdateDto dto, CancellationToken ct)
        {
            await _app.UpdateLocationAsync(UserId, dto, ct);
            return Ok(ApiResponse<object>.Ok(null!));
        }

        // GET: api/driver/orders?history=false
        [HttpGet("orders")]
        public async Task<ActionResult<ApiResponse<List<DriverOrderDto>>>> Orders([FromQuery] bool history, CancellationToken ct)
            => Ok(ApiResponse<List<DriverOrderDto>>.Ok(await _app.GetOrdersAsync(UserId, history, ct)));

        // POST: api/driver/stops/{subOrderId}/picked-up — استلمت من المتجر
        [HttpPost("stops/{subOrderId:guid}/picked-up")]
        public async Task<ActionResult<ApiResponse<object>>> PickedUp(Guid subOrderId, CancellationToken ct)
        {
            await _app.PickUpAsync(UserId, subOrderId, ct);
            return Ok(ApiResponse<object>.Ok(null!));
        }

        // POST: api/driver/orders/{orderId}/failed — تعذّر التسليم (رفض كامل/لا يرد/عنوان خاطئ)
        [HttpPost("orders/{orderId:guid}/failed")]
        public async Task<ActionResult<ApiResponse<DriverOrderDto>>> Failed(Guid orderId, [FromBody] DriverFailDto dto, CancellationToken ct)
            => Ok(ApiResponse<DriverOrderDto>.Ok(await _app.FailAsync(UserId, orderId, dto, ct)));

        // POST: api/driver/orders/{orderId}/delivered — تم التسليم (+ تأكيد استلام المبلغ)
        [HttpPost("orders/{orderId:guid}/delivered")]
        public async Task<ActionResult<ApiResponse<DriverOrderDto>>> Delivered(Guid orderId, [FromBody] DriverDeliverDto dto, CancellationToken ct)
            => Ok(ApiResponse<DriverOrderDto>.Ok(await _app.DeliverAsync(UserId, orderId, dto, ct)));
    }

    // حسابات السائقين ونقدهم — للعمليات والإدارة
    [ApiController]
    [Route("api/ops/drivers")]
    [Authorize(Policy = PolicyNames.OpsOrAdmin)]
    public class OpsDriverAccountsController : ControllerBase
    {
        private readonly IDriverAppService _app;

        public OpsDriverAccountsController(IDriverAppService app) => _app = app;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // PUT: api/ops/drivers/{id}/account — إنشاء حساب الدخول أو تغيير كلمة مروره
        [HttpPut("{driverId:guid}/account")]
        public async Task<ActionResult<ApiResponse<DriverDto>>> SetAccount(Guid driverId, [FromBody] DriverAccountDto dto, CancellationToken ct)
            => Ok(ApiResponse<DriverDto>.Ok(await _app.SetAccountAsync(driverId, dto.Password, ct)));

        // GET/PUT: api/ops/drivers/settings — من يتحمّل أجرة التوصيل عند الرفض
        [HttpGet("settings")]
        public async Task<ActionResult<ApiResponse<DeliverySettingsDto>>> GetSettings(CancellationToken ct)
            => Ok(ApiResponse<DeliverySettingsDto>.Ok(await _app.GetSettingsAsync(ct)));

        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<DeliverySettingsDto>>> UpdateSettings([FromBody] DeliverySettingsDto dto, CancellationToken ct)
            => Ok(ApiResponse<DeliverySettingsDto>.Ok(await _app.UpdateSettingsAsync(dto, UserId, ct), "تم حفظ الإعداد"));

        // GET: api/ops/drivers/{id}/cash — النقد الذي معه ولم يُسلَّم
        [HttpGet("{driverId:guid}/cash")]
        public async Task<ActionResult<ApiResponse<DriverCashDto>>> Cash(Guid driverId, CancellationToken ct)
            => Ok(ApiResponse<DriverCashDto>.Ok(await _app.GetCashAsync(driverId, ct)));

        // POST: api/ops/drivers/{id}/cash/settle — استلام النقد من السائق
        [HttpPost("{driverId:guid}/cash/settle")]
        public async Task<ActionResult<ApiResponse<object>>> Settle(Guid driverId, CancellationToken ct)
        {
            var count = await _app.SettleCashAsync(driverId, UserId, ct);
            return Ok(ApiResponse<object>.Ok(new { settledOrders = count }));
        }
    }
}
