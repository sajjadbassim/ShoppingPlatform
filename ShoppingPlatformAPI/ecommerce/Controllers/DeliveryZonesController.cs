using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // مناطق التوصيل: الإدارة تنشئها وتختار تطبيقها على كل المتاجر أو متاجر محددة
    [ApiController]
    [Route("api/delivery-zones")]
    public class DeliveryZonesController : ControllerBase
    {
        private readonly IDeliveryZoneService _zones;

        public DeliveryZonesController(IDeliveryZoneService zones) => _zones = zones;

        private Guid UserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // GET: api/delivery-zones — المناطق المفعّلة (لاختيارها في العنوان)
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<ZonesPublicDto>>> Public(CancellationToken ct)
            => Ok(ApiResponse<ZonesPublicDto>.Ok(await _zones.GetPublicAsync(ct)));

        // GET: api/delivery-zones/quote?addressId= | ?zoneId= — رسوم توصيل سلة الزبون لهذا العنوان
        [HttpGet("quote")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DeliveryQuoteDto>>> Quote([FromQuery] Guid? addressId, [FromQuery] Guid? zoneId, CancellationToken ct)
            => Ok(ApiResponse<DeliveryQuoteDto>.Ok(await _zones.QuoteAsync(UserId, addressId, zoneId, ct)));

        // ===== الإدارة =====
        [HttpGet("admin")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<ZonesAdminDto>>> Admin(CancellationToken ct)
            => Ok(ApiResponse<ZonesAdminDto>.Ok(await _zones.GetAdminAsync(ct)));

        [HttpPut("mode")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<ZonesAdminDto>>> SetMode([FromBody] SetZonesModeDto dto, CancellationToken ct)
            => Ok(ApiResponse<ZonesAdminDto>.Ok(await _zones.SetModeAsync(dto, UserId, ct), "تم حفظ إعداد المناطق"));

        [HttpPost]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> Create([FromBody] SaveDeliveryZoneDto dto, CancellationToken ct)
            => Ok(ApiResponse<DeliveryZoneDto>.Ok(await _zones.CreateAsync(dto, ct), "تمت إضافة المنطقة"));

        [HttpPut("{id:guid}")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> Update(Guid id, [FromBody] SaveDeliveryZoneDto dto, CancellationToken ct)
            => Ok(ApiResponse<DeliveryZoneDto>.Ok(await _zones.UpdateAsync(id, dto, ct), "تم حفظ المنطقة"));

        [HttpDelete("{id:guid}")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
        {
            await _zones.DeleteAsync(id, ct);
            return Ok(ApiResponse<bool>.Ok(true, "تم حذف المنطقة"));
        }
    }
}
