using ecommerce.Core.DTO.CouponDto;
using ecommerce.Filters;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // عروض المتجر وكوبوناته من لوحة التاجر (الملكية يتحقق منها VendorRouteAccessFilter)
    [ApiController]
    [Route("api/vendors/{vendorId}")]
    [Authorize(Policy = "OpsOrAdminOrVendor")]
    [TypeFilter(typeof(VendorRouteAccessFilter))]
    public class VendorMarketingController : Controller
    {
        private readonly IVendorMarketingService _marketing;

        public VendorMarketingController(IVendorMarketingService marketing) => _marketing = marketing;

        [HttpGet("promotions")]
        public async Task<IActionResult> GetPromotions(Guid vendorId) =>
            Ok(new { success = true, data = await _marketing.GetPromotionsAsync(vendorId) });

        [HttpPost("promotions")]
        public async Task<IActionResult> CreatePromotion(Guid vendorId, [FromBody] SaveVendorPromotionDto dto) =>
            Ok(new { success = true, data = await _marketing.CreatePromotionAsync(vendorId, dto), message = "تم إنشاء العرض" });

        [HttpPut("promotions/{id:guid}")]
        public async Task<IActionResult> UpdatePromotion(Guid vendorId, Guid id, [FromBody] SaveVendorPromotionDto dto) =>
            Ok(new { success = true, data = await _marketing.UpdatePromotionAsync(vendorId, id, dto), message = "تم حفظ العرض" });

        [HttpDelete("promotions/{id:guid}")]
        public async Task<IActionResult> DeletePromotion(Guid vendorId, Guid id)
        {
            await _marketing.DeletePromotionAsync(vendorId, id);
            return Ok(new { success = true, message = "تم حذف العرض" });
        }

        [HttpGet("coupons")]
        public async Task<IActionResult> GetCoupons(Guid vendorId) =>
            Ok(new { success = true, data = await _marketing.GetCouponsAsync(vendorId) });

        [HttpPost("coupons")]
        public async Task<IActionResult> CreateCoupon(Guid vendorId, [FromBody] CreateCouponDto dto) =>
            Ok(new { success = true, data = await _marketing.CreateCouponAsync(vendorId, dto), message = "تم إنشاء الكوبون" });

        [HttpPut("coupons/{id:guid}")]
        public async Task<IActionResult> UpdateCoupon(Guid vendorId, Guid id, [FromBody] UpdateCouponDto dto) =>
            Ok(new { success = true, data = await _marketing.UpdateCouponAsync(vendorId, id, dto), message = "تم حفظ الكوبون" });

        [HttpDelete("coupons/{id:guid}")]
        public async Task<IActionResult> DeleteCoupon(Guid vendorId, Guid id)
        {
            await _marketing.DeleteCouponAsync(vendorId, id);
            return Ok(new { success = true, message = "تم حذف الكوبون" });
        }
    }
}
