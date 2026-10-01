using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Order;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    //[Authorize]
    public class OrdersController : Controller
    {
        private readonly IOrderService _orderService;

        public OrdersController(IOrderService orderService)
        {
            _orderService = orderService;
        }

        // الإدارة والعمليات ترى كل الطلبات؛ غيرهم طلباته فقط
        private bool IsStaff => User.IsInRole("ADMIN") || User.IsInRole("OPS");

        private bool CanView(OrderResponseDto order) =>
            IsStaff || (order != null && order.CustomerId == GetCurrentUserId());

        // نفس الرد للطلب غير الموجود ولطلب غيرك — حتى لا يُعرف وجود رقم طلب لا يخصك
        private IActionResult OrderNotFound() =>
            NotFound(new { success = false, message = "الطلب غير موجود" });

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        // ===================================
        // POST: api/orders
        // ===================================
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "غير مصرح" });

                var order = await _orderService.CreateOrderFromCartAsync(userId.Value, dto);
                return CreatedAtAction(
                    nameof(GetOrderById),
                    new { id = order.Id },
                    new { success = true, data = order, message = "تم إنشاء الطلب بنجاح" }
                );
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { success = false, message = innerMessage });
            }
        }

        // ===================================
        // GET: api/orders/{id}
        // ===================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrderById(Guid id)
        {
            try
            {
                var order = await _orderService.GetOrderByIdAsync(id);
                if (!CanView(order)) return OrderNotFound();
                return Ok(new { success = true, data = order });
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest(new { success = false, message = innerMessage });
            }
        }

        // ===================================
        // GET: api/orders/number/{orderNumber}
        // ===================================
        [HttpGet("number/{orderNumber}")]
        public async Task<IActionResult> GetOrderByNumber(string orderNumber)
        {
            try
            {
                var order = await _orderService.GetOrderByNumberAsync(orderNumber);
                if (!CanView(order)) return OrderNotFound();
                return Ok(new { success = true, data = order });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/orders/customer/{customerId}
        // ===================================
        [HttpGet("customer/{customerId}")]
        public async Task<IActionResult> GetCustomerOrders(Guid customerId)
        {
            if (!IsStaff && customerId != GetCurrentUserId())
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية لعرض هذه الطلبات" });

            try
            {
                var orders = await _orderService.GetCustomerOrdersAsync(customerId);
                return Ok(new { success = true, data = orders });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/orders/paged
        // ===================================
        [HttpGet("paged")]
        public async Task<IActionResult> GetPaged(
            [FromQuery] PaginationParams pagination,
            [FromQuery] Guid? customerId = null,
            [FromQuery] string orderNumber = null,
            [FromQuery] string status = null)
        {
            // غير الطاقم: القائمة مقيدة بطلباته مهما كان customerId المُرسل
            if (!IsStaff)
                customerId = GetCurrentUserId();

            try
            {
                var result = await _orderService.GetPagedAsync(
                    pagination, customerId, orderNumber, status);

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
        // GET: api/orders/status-counts — عدد الطلبات لكل حالة (الطاقم فقط)
        // ===================================
        [HttpGet("status-counts")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<IActionResult> GetStatusCounts()
        {
            var counts = await _orderService.GetStatusCountsAsync();
            return Ok(new { success = true, data = counts });
        }

        // ===================================
        // ✅ جديد: GET: api/orders/{id}/tracking
        // تتبع الطلب مع Timeline كامل
        // ===================================
        [HttpGet("{id}/tracking")]
        public async Task<IActionResult> GetOrderTracking(Guid id)
        {
            try
            {
                var customerId = GetCurrentUserId();
                if (customerId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var isAdmin = IsStaff;
                var tracking = await _orderService.GetOrderTrackingAsync(id, customerId.Value, isAdmin);
                return Ok(new { success = true, data = tracking });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية لعرض هذا الطلب" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // ✅ جديد: POST: api/orders/{id}/cancel
        // إلغاء الطلب من المستخدم
        // ===================================
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelOrder(Guid id, [FromBody] CancelOrderDto dto)
        {
            try
            {
                var customerId = GetCurrentUserId();
                if (customerId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var order = await _orderService.CancelOrderAsync(id, customerId.Value, dto);
                return Ok(new { success = true, data = order, message = "تم إلغاء الطلب بنجاح" });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية لإلغاء هذا الطلب" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}