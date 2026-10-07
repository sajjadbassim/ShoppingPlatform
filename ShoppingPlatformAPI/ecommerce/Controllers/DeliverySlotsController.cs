using ecommerce.Common;
using ecommerce.Services.DeliverySlotService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    // مواعيد توصيل السوبرماركت المتاحة الآن — تُعرض في صفحة الدفع حين تحتوي السلة منتجات سوبرماركت
    [ApiController]
    [Route("api/orders/delivery-slots")]
    [AllowAnonymous]
    public class DeliverySlotsController : ControllerBase
    {
        private readonly IDeliverySlotService _slots;

        public DeliverySlotsController(IDeliverySlotService slots) => _slots = slots;

        // GET: api/orders/delivery-slots
        // للمستخدم المسجّل: المواعيد حسب أوقات عمل متاجر السوبرماركت في سلته
        [HttpGet]
        public async Task<ActionResult<ApiResponse<DeliverySlotsResponseDto>>> Get(CancellationToken ct)
        {
            var stores = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                ? await _slots.GroceryStoresInCartAsync(userId, ct)
                : null;
            return Ok(ApiResponse<DeliverySlotsResponseDto>.Ok(await _slots.GetSlotsAsync(stores, ct)));
        }
    }
}
