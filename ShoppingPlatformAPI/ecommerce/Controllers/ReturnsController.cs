using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Interfaces;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReturnsController : Controller
    {
        private readonly IReturnService _returnService;
        private readonly IReturnRestockService _returnRestockService;
        private readonly ICurrentUserService _currentUser;

        public ReturnsController(
            IReturnService returnService,
            IReturnRestockService returnRestockService,
            ICurrentUserService currentUser)
        {
            _returnService = returnService;
            _returnRestockService = returnRestockService;
            _currentUser = currentUser;
        }

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        private bool IsOpsOrAdmin =>
            User.IsInRole("Admin") || User.IsInRole("Ops");

        // ===================================
        // GET: api/returns/my
        // طلبات الإرجاع للعميل الحالي
        // ===================================
        [HttpGet("my")]
        public async Task<IActionResult> GetMyReturns()
        {
            try
            {
                var customerId = GetCurrentUserId();
                if (customerId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var returns = await _returnService.GetMyReturnsAsync(customerId.Value);
                return Ok(new { success = true, data = returns });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/returns/{id}
        // ===================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var returnRequest = await _returnService.GetByIdAsync(id);
                return Ok(new { success = true, data = returnRequest });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/returns/paged    (Admin/Ops)
        // جميع طلبات الإرجاع مع فلترة
        // ===================================
        [HttpGet("paged")]
        [Authorize(Policy = "OpsOrAdmin")]
        public async Task<IActionResult> GetPaged(
            [FromQuery] string? status = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var (returns, totalCount) = await _returnService.GetPagedAsync(
                    status, pageNumber, pageSize);

                return Ok(new
                {
                    success = true,
                    data = returns,
                    pagination = new
                    {
                        total = totalCount,
                        page = pageNumber,
                        pageSize = pageSize,
                        totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/returns
        // إنشاء طلب إرجاع جديد
        // ===================================
        [HttpPost]
        public async Task<IActionResult> Create([FromForm] CreateReturnDto dto)
        {
            try
            {
                var customerId = GetCurrentUserId();
                if (customerId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var returnRequest = await _returnService.CreateAsync(customerId.Value, dto);
                return CreatedAtAction(nameof(GetById), new { id = returnRequest.Id },
                    new { success = true, data = returnRequest, message = "تم تقديم طلب الإرجاع بنجاح، سيتم مراجعته خلال 24 ساعة" });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية لإرجاع هذا الطلب" });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.InnerException?.Message ?? ex.Message
                });
            }
        }

        // ===================================
        // POST: api/returns/{id}/restock    (Admin/Ops)
        // إعادة البضاعة المرتجعة للمخزون بعد استلامها وفحصها
        // ===================================
        [HttpPost("{id:guid}/restock")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<ReturnResponseDto>>> Restock(Guid id, CancellationToken ct)
        {
            var returnRequest = await _returnRestockService.RestockAsync(id, _currentUser.UserId, ct);
            return Ok(ApiResponse<ReturnResponseDto>.Ok(returnRequest, "تمت إعادة الكميات إلى المخزون"));
        }

        // ===================================
        // PUT: api/returns/{id}/review    (Admin/Ops)
        // الموافقة أو رفض طلب الإرجاع
        // ===================================
        [HttpPut("{id}/review")]
        [Authorize(Policy = "OpsOrAdmin")]
        public async Task<IActionResult> Review(Guid id, [FromBody] ReviewReturnDto dto)
        {
            try
            {
                var reviewedBy = GetCurrentUserId();
                if (reviewedBy == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var returnRequest = await _returnService.ReviewAsync(id, reviewedBy.Value, dto);

                var message = dto.Decision.ToLower() == "approved"
                    ? "تمت الموافقة على طلب الإرجاع"
                    : "تم رفض طلب الإرجاع";

                return Ok(new { success = true, data = returnRequest, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}