using ecommerce.Common;
﻿using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Interfaces;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using ecommerce.Core.Exceptions;

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
        private readonly ecommerce.Services.ReturnTripService.IReturnTripService? _trips;

        public ReturnsController(
            IReturnService returnService,
            IReturnRestockService returnRestockService,
            ICurrentUserService currentUser,
            ecommerce.Services.ReturnTripService.IReturnTripService? trips = null)
        {
            _returnService = returnService;
            _returnRestockService = returnRestockService;
            _currentUser = currentUser;
            _trips = trips;
        }

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        private bool IsOpsOrAdmin =>
            User.IsInRole(UserRoles.Admin) || User.IsInRole(UserRoles.Ops);

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
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
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
                var viewerId = GetCurrentUserId();
                if (viewerId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var returnRequest = await _returnService.GetForViewerAsync(id, viewerId.Value, IsOpsOrAdmin);
                return Ok(new { success = true, data = returnRequest });
            }
            catch (AppException ex)
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
                StatusFilter.Validate(status, typeof(ReturnStatus), ignoreCase: true);
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
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
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
            catch (NotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
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
        // POST: api/returns/{id}/assign-driver    (Admin/Ops) — سائق يأخذ القطع من الزبون إلى متجرها
        // ===================================
        [HttpPost("{id:guid}/assign-driver")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<ReturnResponseDto>>> AssignDriver(Guid id, [FromBody] AssignReturnDriverDto dto, CancellationToken ct)
        {
            await _trips!.AssignCustomerReturnAsync(id, dto.DriverId, _currentUser.UserId, ct);
            return Ok(ApiResponse<ReturnResponseDto>.Ok(await _returnService.GetByIdAsync(id), "تم تعيين السائق لاستلام القطع من الزبون"));
        }

        // POST: api/returns/{id}/unassign-driver    (Admin/Ops) — قبل أن يأخذ السائق القطع
        [HttpPost("{id:guid}/unassign-driver")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<ReturnResponseDto>>> UnassignDriver(Guid id, CancellationToken ct)
        {
            await _trips!.UnassignCustomerReturnAsync(id, _currentUser.UserId, ct);
            return Ok(ApiResponse<ReturnResponseDto>.Ok(await _returnService.GetByIdAsync(id), "سُحب الاستلام من السائق"));
        }

        public record AssignReturnDriverDto(Guid DriverId);

        // POST: api/returns/{id}/pickup-fee    (Admin/Ops) — استثناء: من يتحمّل أجرة استلام هذا المرتجع
        [HttpPost("{id:guid}/pickup-fee")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<ReturnResponseDto>>> SetPickupFee(Guid id, [FromBody] ecommerce.Core.DTO.Drivers.SetFeePayerOverrideDto dto)
        {
            var result = await _returnService.SetPickupFeePayerAsync(id, dto.Payer ?? "", dto.Reason, _currentUser.UserId);
            return Ok(ApiResponse<ReturnResponseDto>.Ok(result, "تم تغيير أجرة الاستلام"));
        }

        // ===================================
        // POST: api/returns/{id}/refunded    (Admin/Ops)
        // تسجيل ردّ المبلغ للزبون — الإرجاع يصبح «مكتمل»
        // ===================================
        [HttpPost("{id:guid}/refunded")]
        [Authorize(Policy = PolicyNames.OpsOrAdmin)]
        public async Task<ActionResult<ApiResponse<ReturnResponseDto>>> MarkRefunded(Guid id)
        {
            var returnRequest = await _returnService.MarkRefundedAsync(id, _currentUser.UserId);
            return Ok(ApiResponse<ReturnResponseDto>.Ok(returnRequest, "تم تسجيل ردّ المبلغ للزبون"));
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
            catch (NotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (AppException ex)
            {
                return ApiErrors.From(ex);
            }
        }
    }
}