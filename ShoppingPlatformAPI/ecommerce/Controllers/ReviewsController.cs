using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Review;
using ecommerce.Services.VendorAccessService;
using ecommerce.Repositories;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReviewsController : Controller
    {
        private readonly IReviewService _reviewService;
        private readonly IReviewRepository _reviewRepository;

        private readonly IVendorAccessService _access;

        public ReviewsController(
            IReviewService reviewService,
            IReviewRepository reviewRepository,
            IVendorAccessService access)
        {
            _reviewService = reviewService;
            _reviewRepository = reviewRepository;
            _access = access;
        }

        // Helper لجلب ID المستخدم الحالي من الـ Token
        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        private bool IsAdmin => User.IsInRole("ADMIN");

        // ===================================
        // GET: api/reviews
        // جلب المراجعات مع فلترة وpaging
        // ===================================
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetReviews([FromQuery] ReviewQueryDto query)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var (reviews, totalCount) = await _reviewService.GetFilteredAsync(query, currentUserId);

                return Ok(new
                {
                    success = true,
                    data = reviews,
                    pagination = new
                    {
                        total = totalCount,
                        page = query.PageNumber,
                        pageSize = query.PageSize,
                        totalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/reviews/{id}
        // ===================================
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var review = await _reviewService.GetByIdAsync(id);
                return Ok(new { success = true, data = review });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/reviews/product/{productId}/summary
        // ملخص تقييمات المنتج
        // ===================================
        [HttpGet("product/{productId}/summary")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProductSummary(Guid productId)
        {
            try
            {
                var summary = await _reviewService.GetProductSummaryAsync(productId);
                return Ok(new { success = true, data = summary });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/reviews/vendor/{vendorId}/summary
        // ملخص تقييمات البائع
        // ===================================
        [HttpGet("vendor/{vendorId}/summary")]
        [AllowAnonymous]
        public async Task<IActionResult> GetVendorSummary(Guid vendorId)
        {
            try
            {
                var summary = await _reviewService.GetVendorSummaryAsync(vendorId);
                return Ok(new { success = true, data = summary });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/reviews
        // إضافة مراجعة جديدة
        // ===================================
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromForm] CreateReviewDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var review = await _reviewService.CreateAsync(userId.Value, dto);
                return CreatedAtAction(nameof(GetById), new { id = review.Id },
                    new { success = true, data = review, message = "تم إضافة مراجعتك بنجاح" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid();
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
        // PUT: api/reviews/{id}
        // تعديل مراجعة (صاحبها فقط)
        // ===================================
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(Guid id, [FromForm] UpdateReviewDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var review = await _reviewService.UpdateAsync(userId.Value, id, dto);
                return Ok(new { success = true, data = review, message = "تم تعديل المراجعة بنجاح" });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية تعديل هذه المراجعة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/reviews/{id}
        // حذف مراجعة (صاحبها أو Admin)
        // ===================================
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var result = await _reviewService.DeleteAsync(userId.Value, id, IsAdmin);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المراجعة بنجاح" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (UnauthorizedAccessException)
            {
                return StatusCode(403, new { success = false, message = "ليس لديك صلاحية حذف هذه المراجعة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/reviews/{id}/reply — رد صاحب المتجر (أو الإدارة) على تقييم منتجه
        // DELETE: api/reviews/{id}/reply — حذف الرد
        // ===================================
        [HttpPut("{id}/reply")]
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        public async Task<IActionResult> Reply(Guid id, [FromBody] VendorReplyDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Reply))
                return BadRequest(new { success = false, message = "اكتب الرد" });
            return await SetReplyAsync(id, dto.Reply, "تم نشر ردك");
        }

        [HttpDelete("{id}/reply")]
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        public Task<IActionResult> DeleteReply(Guid id) => SetReplyAsync(id, null, "تم حذف الرد");

        private async Task<IActionResult> SetReplyAsync(Guid id, string? reply, string message)
        {
            var productId = await _reviewRepository.GetProductIdAsync(id);
            if (productId == null)
                return NotFound(new { success = false, message = "المراجعة غير موجودة" });

            // صاحب المتجر الذي يبيع المنتج فقط (أو الإدارة/العمليات)
            await _access.EnsureCanManageProductAsync(productId.Value);

            try
            {
                var review = await _reviewService.SetVendorReplyAsync(id, reply);
                return Ok(new { success = true, data = review, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/reviews/{id}/helpful
        // تصويت "مفيدة"
        // ===================================
        [HttpPost("{id}/helpful")]
        [Authorize]
        public async Task<IActionResult> VoteHelpful(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var result = await _reviewService.AddHelpfulVoteAsync(userId.Value, id);
                if (result)
                    return Ok(new { success = true, message = "تم التصويت بنجاح" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/reviews/{id}/helpful
        // سحب تصويت "مفيدة"
        // ===================================
        [HttpDelete("{id}/helpful")]
        [Authorize]
        public async Task<IActionResult> RemoveHelpfulVote(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var result = await _reviewService.RemoveHelpfulVoteAsync(userId.Value, id);
                if (result)
                    return Ok(new { success = true, message = "تم سحب التصويت بنجاح" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/reviews/{id}/report
        // الإبلاغ عن مراجعة
        // ===================================
        [HttpPost("{id}/report")]
        [Authorize]
        public async Task<IActionResult> Report(Guid id, [FromBody] ReportReviewDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var result = await _reviewService.ReportAsync(userId.Value, id, dto);
                if (result)
                    return Ok(new { success = true, message = "تم الإبلاغ بنجاح، سيتم مراجعته من فريقنا" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/reviews/reported     (Admin)
        // المراجعات المُبلَّغ عنها
        // ===================================
        [HttpGet("reported")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetReported(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var (reviews, totalCount) = await _reviewRepository.GetReportedReviewsAsync(
                    pageNumber, pageSize);

                return Ok(new
                {
                    success = true,
                    data = reviews,
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
        // PUT: api/reviews/{id}/approve  (Admin)
        // الموافقة على مراجعة مُبلَّغ عنها
        // ===================================
        [HttpPut("{id}/approve")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Approve(Guid id)
        {
            try
            {
                var result = await _reviewRepository.ApproveReviewAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تمت الموافقة على المراجعة" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/reviews/{id}/reject  (Admin)
        // رفض وحذف مراجعة
        // ===================================
        [HttpDelete("{id}/reject")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Reject(Guid id)
        {
            try
            {
                var result = await _reviewService.DeleteAsync(Guid.Empty, id, isAdmin: true);
                if (result)
                    return Ok(new { success = true, message = "تم رفض وحذف المراجعة" });
                else
                    return NotFound(new { success = false, message = "المراجعة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}