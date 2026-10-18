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

        // GET: api/driver/me/cash — تفصيل النقد الذي معه ولم يسلّمه للعمليات
        [HttpGet("me/cash")]
        public async Task<ActionResult<ApiResponse<DriverCashDto>>> MyCash(CancellationToken ct)
            => Ok(ApiResponse<DriverCashDto>.Ok(await _app.GetMyCashAsync(UserId, ct)));

        // GET: api/driver/returns — بضاعة مرتجعة معه لم تُسلَّم لمتاجرها
        [HttpGet("returns")]
        public async Task<ActionResult<ApiResponse<List<ReturnTripDto>>>> MyReturns(CancellationToken ct)
            => Ok(ApiResponse<List<ReturnTripDto>>.Ok(await _app.GetMyReturnTripsAsync(UserId, ct)));

        // POST: api/driver/returns/{returnId}/picked-up — أخذ القطع المُرجعة من الزبون
        [HttpPost("returns/{returnId:guid}/picked-up")]
        public async Task<ActionResult<ApiResponse<object>>> ReturnPickedUp(Guid returnId, CancellationToken ct)
        {
            await _app.CollectCustomerReturnAsync(UserId, returnId, ct);
            return Ok(ApiResponse<object>.Ok(null!, "سجّلنا أخذ القطع — أوصلها للمتجر"));
        }

        // POST: api/driver/returns/{returnId}/pickup-failed — تعذّر أخذ القطع من الزبون
        [HttpPost("returns/{returnId:guid}/pickup-failed")]
        public async Task<ActionResult<ApiResponse<object>>> ReturnPickupFailed(Guid returnId, [FromBody] ReturnPickupFailedDto? dto, CancellationToken ct)
        {
            await _app.FailCustomerReturnPickupAsync(UserId, returnId, dto?.Note, ct);
            return Ok(ApiResponse<object>.Ok(null!, "أُبلغت العمليات"));
        }

        public record ReturnPickupFailedDto([property: System.ComponentModel.DataAnnotations.MaxLength(300)] string? Note);

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

        // من يدفع أجرة الرفض والإرجاع: قرار مالي للمنصة كلها — للأدمن فقط (العمليات تراه ولا تغيّره)
        [HttpPut("settings")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<DeliverySettingsDto>>> UpdateSettings([FromBody] DeliverySettingsDto dto, CancellationToken ct)
            => Ok(ApiResponse<DeliverySettingsDto>.Ok(await _app.UpdateSettingsAsync(dto, UserId, ct), "تم حفظ الإعداد"));

        // GET: api/ops/drivers/cash — ملخص النقد بعهدة كل السائقين (صفحة المستحقات عند الأدمن)
        [HttpGet("cash")]
        public async Task<ActionResult<ApiResponse<List<DriverCashCustodyDto>>>> CashCustody(CancellationToken ct)
            => Ok(ApiResponse<List<DriverCashCustodyDto>>.Ok(await _app.GetCashCustodyAsync(ct)));

        // GET/PUT: api/ops/drivers/orders/{orderId}/refusal-fee — استثناء أجرة الرفض لطلب واحد (قبل تسجيل الرفض)
        [HttpGet("orders/{orderId:guid}/refusal-fee")]
        public async Task<ActionResult<ApiResponse<OrderRefusalFeeDto>>> GetRefusalFee(Guid orderId, CancellationToken ct)
            => Ok(ApiResponse<OrderRefusalFeeDto>.Ok(await _app.GetRefusalFeeAsync(orderId, ct)));

        [HttpPut("orders/{orderId:guid}/refusal-fee")]
        public async Task<ActionResult<ApiResponse<OrderRefusalFeeDto>>> SetRefusalFee(Guid orderId, [FromBody] SetFeePayerOverrideDto dto, CancellationToken ct)
            => Ok(ApiResponse<OrderRefusalFeeDto>.Ok(await _app.SetRefusalFeeOverrideAsync(orderId, dto.Payer, dto.Reason, UserId, ct),
                dto.Payer == null ? "عاد الطلب لإعداد الأدمن" : "تم حفظ الاستثناء"));

        // GET: api/ops/drivers/{id}/cash — النقد الذي معه ولم يُسلَّم
        [HttpGet("{driverId:guid}/cash")]
        public async Task<ActionResult<ApiResponse<DriverCashDto>>> Cash(Guid driverId, CancellationToken ct)
            => Ok(ApiResponse<DriverCashDto>.Ok(await _app.GetCashAsync(driverId, ct)));

        // POST: api/ops/drivers/{id}/cash/settle — استلام النقد من السائق
        [HttpPost("{driverId:guid}/cash/settle")]
        public async Task<ActionResult<ApiResponse<object>>> Settle(Guid driverId, [FromBody] SettleCashDto? dto, CancellationToken ct)
        {
            var (orders, amount) = await _app.SettleCashAsync(driverId, UserId, dto?.ExpectedAmount, ct);
            return Ok(ApiResponse<object>.Ok(new { settledOrders = orders, settledAmount = amount }, $"تم استلام {amount:N0} د.ع"));
        }

        // المبلغ الذي عدّه موظف العمليات (كما عُرض له)
        public record SettleCashDto(decimal? ExpectedAmount);
    }
}
