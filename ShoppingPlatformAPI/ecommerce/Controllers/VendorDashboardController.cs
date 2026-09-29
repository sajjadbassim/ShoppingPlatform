using ecommerce.Core.DTO.Vendor;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/vendors/{vendorId}/dashboard")]
    [Authorize(Policy = "OpsOrAdminOrVENDOR")]
    public class VendorDashboardController : Controller
    {
        private readonly IVendorDashboardService _dashboardService;

        public VendorDashboardController(IVendorDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("userId")?.Value;
            return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard
        // الداشبورد الرئيسي
        // ===================================
        [HttpGet]
        public async Task<IActionResult> GetDashboard(Guid vendorId)
        {
            try
            {
                var dashboard = await _dashboardService.GetDashboardAsync(vendorId);
                return Ok(new { success = true, data = dashboard });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/sales?period=month
        // إحصائيات المبيعات
        // ===================================
        [HttpGet("sales")]
        public async Task<IActionResult> GetSalesStats(
            Guid vendorId,
            [FromQuery] string period = "month")
        {
            try
            {
                var validPeriods = new[] { "today", "week", "month", "year" };
                if (!validPeriods.Contains(period.ToLower()))
                    return BadRequest(new { success = false, message = "الفترة يجب أن تكون: today / week / month / year" });

                var stats = await _dashboardService.GetSalesStatsAsync(vendorId, period);
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/orders?status=&pageNumber=1&pageSize=20
        // طلبات البائع
        // ===================================
        [HttpGet("orders")]
        public async Task<IActionResult> GetOrders(
            Guid vendorId,
            [FromQuery] string? status = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var result = await _dashboardService.GetOrdersAsync(vendorId, status, pageNumber, pageSize);
                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/orders/{subOrderId}
        // تفاصيل طلب محدد
        // ===================================
        [HttpGet("orders/{subOrderId}")]
        public async Task<IActionResult> GetOrderById(Guid vendorId, Guid subOrderId)
        {
            try
            {
                var order = await _dashboardService.GetOrderByIdAsync(vendorId, subOrderId);
                return Ok(new { success = true, data = order });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/confirm
        // تأكيد الطلب
        // ===================================
        [HttpPost("orders/{subOrderId}/confirm")]
        public async Task<IActionResult> ConfirmOrder(Guid vendorId, Guid subOrderId)
        {
            try
            {
                var opsUserId = GetCurrentUserId();
                var order = await _dashboardService.ConfirmOrderAsync(vendorId, subOrderId, opsUserId);
                return Ok(new { success = true, data = order, message = "تم تأكيد الطلب بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/reject
        // رفض الطلب
        // ===================================
        [HttpPost("orders/{subOrderId}/reject")]
        public async Task<IActionResult> RejectOrder(
            Guid vendorId,
            Guid subOrderId,
            [FromBody] RejectSubOrderDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto?.Reason))
                    return BadRequest(new { success = false, message = "سبب الرفض مطلوب" });

                var opsUserId = GetCurrentUserId();
                var order = await _dashboardService.RejectOrderAsync(vendorId, subOrderId, opsUserId, dto.Reason);
                return Ok(new { success = true, data = order, message = "تم رفض الطلب" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/products
        // منتجات البائع مع إحصائيات المبيعات
        // ===================================
        [HttpGet("products")]
        public async Task<IActionResult> GetProductsWithStats(
            Guid vendorId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var result = await _dashboardService.GetProductsWithStatsAsync(vendorId, pageNumber, pageSize);
                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}