using ecommerce.Core.DTO.Ops;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "OpsOrAdmin")]
    public class OpsController : Controller
    {
        private readonly IOpsService _opsService;

        public OpsController(IOpsService opsService)
        {
            _opsService = opsService;
        }

        // GET: api/ops/suborders/pending
        [HttpGet("suborders/pending")]
        public async Task<IActionResult> GetPendingSubOrders()
        {
            try
            {
                var subOrders = await _opsService.GetPendingSubOrdersAsync();
                return Ok(new { success = true, data = subOrders });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/ops/suborders/{id}
        [HttpGet("suborders/{id}")]
        public async Task<IActionResult> GetSubOrderDetails(Guid id)
        {
            try
            {
                var subOrder = await _opsService.GetSubOrderDetailsAsync(id);
                return Ok(new { success = true, data = subOrder });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/ops/suborders/{id}/confirm
        [HttpPut("suborders/{id}/confirm")]
        public async Task<IActionResult> ConfirmSubOrder(Guid id, [FromBody] ConfirmSubOrderDto dto)
        {
            try
            {
                var subOrder = await _opsService.ConfirmSubOrderAsync(id, dto);
                return Ok(new { success = true, data = subOrder, message = "تم تأكيد الطلب الفرعي بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/ops/suborders/{id}/cancel
        [HttpPut("suborders/{id}/cancel")]
        
        public async Task<IActionResult> CancelSubOrder(Guid id, [FromBody] CancelSubOrderDto dto)
        {
            try
            {
                var subOrder = await _opsService.CancelSubOrderAsync(id, dto);
                return Ok(new { success = true, data = subOrder, message = "تم إلغاء الطلب الفرعي بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/ops/suborders/{id}/status
        [HttpPut("suborders/{id}/status")]
        public async Task<IActionResult> UpdateSubOrderStatus(Guid id, [FromBody] UpdateSubOrderStatusDto dto)
        {
            try
            {
                var subOrder = await _opsService.UpdateSubOrderStatusAsync(id, dto);
                return Ok(new { success = true, data = subOrder, message = "تم تحديث حالة الطلب بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    
        
        // GET: api/ops/suborders/paged
        [HttpGet("suborders/paged")]
        public async Task<IActionResult> GetSubOrdersPaged(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null)
        {
            try
            {
                var result = await _opsService.GetSubOrdersPagedAsync(pageNumber, pageSize, status);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/ops/dashboard/stats
        [HttpGet("dashboard/stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            try
            {
                var stats = await _opsService.GetDashboardStatsAsync();
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/ops/suborders/{id}/assign-driver
        [HttpPut("suborders/{id}/assign-driver")]
        public async Task<IActionResult> AssignDriver(Guid id, [FromBody] AssignDriverDto dto)
        {
            try
            {
                var subOrder = await _opsService.AssignDriverAsync(id, dto);
                return Ok(new { success = true, data = subOrder, message = "تم تعيين السائق بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/ops/orders/{orderId}/assign-driver
        [HttpPut("orders/{orderId}/assign-driver")]
        public async Task<IActionResult> AssignDriverToOrder(Guid orderId, [FromBody] AssignDriverToOrderDto dto)
        {
            try
            {
                var result = await _opsService.AssignDriverToOrderAsync(orderId, dto);
                return Ok(new { success = true, data = result, message = "تم تعيين السائق لكامل الطلب بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

    }
}
