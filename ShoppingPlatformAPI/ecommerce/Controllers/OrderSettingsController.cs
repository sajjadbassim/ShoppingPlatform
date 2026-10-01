using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Services.OrderSettingsService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // إعدادات الطلبات + الطلبات المتأخرة عن مهلة التأكيد
    [ApiController]
    [Route("api/order-settings")]
    [Authorize(Policy = PolicyNames.OpsOrAdmin)]
    public class OrderSettingsController : ControllerBase
    {
        private readonly IOrderSettingsService _settings;

        public OrderSettingsController(IOrderSettingsService settings) => _settings = settings;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/order-settings
        [HttpGet]
        public async Task<ActionResult<ApiResponse<OrderSettingsDto>>> Get(CancellationToken ct)
            => Ok(ApiResponse<OrderSettingsDto>.Ok(await _settings.GetAsync(ct)));

        // PUT: api/order-settings/confirmation-timeout — الأدمن فقط
        [HttpPut("confirmation-timeout")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<OrderSettingsDto>>> SetTimeout([FromBody] SetTimeoutDto dto, CancellationToken ct)
            => Ok(ApiResponse<OrderSettingsDto>.Ok(await _settings.SetConfirmationTimeoutAsync(dto.Minutes, UserId, ct), "تم حفظ المهلة"));

        // PUT: api/order-settings/delivery-thresholds — حدود ألوان سرعة التوصيل (الأدمن فقط)
        [HttpPut("delivery-thresholds")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<OrderSettingsDto>>> SetThresholds([FromBody] SetThresholdsDto dto, CancellationToken ct)
            => Ok(ApiResponse<OrderSettingsDto>.Ok(await _settings.SetDeliveryThresholdsAsync(dto.FastMinutes, dto.SlowMinutes, UserId, ct), "تم حفظ الحدود"));

        // GET: api/order-settings/overdue — طلبات تجاوزت مهلة التأكيد ولم يؤكدها المتجر
        [HttpGet("overdue")]
        public async Task<ActionResult<ApiResponse<List<OverdueConfirmationDto>>>> Overdue(CancellationToken ct)
            => Ok(ApiResponse<List<OverdueConfirmationDto>>.Ok(await _settings.GetOverdueConfirmationsAsync(ct)));
    }

    public class SetThresholdsDto
    {
        public int FastMinutes { get; set; }
        public int SlowMinutes { get; set; }
    }

    public class SetTimeoutDto
    {
        public int Minutes { get; set; }
    }
}
