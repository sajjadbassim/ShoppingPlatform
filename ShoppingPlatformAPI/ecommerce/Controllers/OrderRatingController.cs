using ecommerce.Core.DTO.OrderRating;
using ecommerce.Services;
using ecommerce.Services.OrderRatingService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/orders/{orderId}/rating")]
    [Authorize]
    public class OrderRatingController : ControllerBase
    {
        private readonly IOrderRatingService _ratingService;

        public OrderRatingController(IOrderRatingService ratingService)
        {
            _ratingService = ratingService;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // ===================================
        // POST: api/orders/{orderId}/rating
        // إرسال تقييم للطلب
        // ===================================
        [HttpPost]
        public async Task<IActionResult> CreateRating(Guid orderId, [FromBody] CreateOrderRatingDto dto)
        {
            try
            {
                var rating = await _ratingService.CreateRatingAsync(orderId, GetCurrentUserId(), dto);
                return Ok(new { success = true, data = rating, message = "شكراً على تقييمك!" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/orders/{orderId}/rating
        // جلب تقييم الطلب
        // ===================================
        [HttpGet]
        public async Task<IActionResult> GetRating(Guid orderId)
        {
            try
            {
                var rating = await _ratingService.GetRatingByOrderIdAsync(orderId, GetCurrentUserId());

                if (rating == null)
                    return Ok(new { success = true, data = (object?)null, message = "لم يتم تقييم هذا الطلب بعد" });

                return Ok(new { success = true, data = rating });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/orders/{orderId}/rating/status
        // هل قيّم الزبون هذا الطلب؟
        // ===================================
        // POST: api/orders/{orderId}/rating/stores — تقييم المتاجر وحدها (مستقل عن تقييم التجربة)
        [HttpPost("stores")]
        public async Task<IActionResult> RateStores(Guid orderId, [FromBody] CreateStoreRatingsDto dto)
        {
            try
            {
                var rating = await _ratingService.AddStoreRatingsAsync(orderId, GetCurrentUserId(), dto.SubOrderRatings, dto.DriverRatings);
                return Ok(new { success = true, data = rating, message = "شكراً على تقييم المتاجر" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetRatingStatus(Guid orderId)
        {
            try
            {
                var status = await _ratingService.GetRatingStatusAsync(orderId, GetCurrentUserId());
                return Ok(new { success = true, data = status });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }

    // ===================================
    // Admin Controller — إحصائيات
    // ===================================
    [ApiController]
    [Route("api/admin/ratings")]
    [Authorize(Roles = "ADMIN")]
    public class RatingAdminController : ControllerBase
    {
        private readonly IOrderRatingService _ratingService;

        public RatingAdminController(IOrderRatingService ratingService)
        {
            _ratingService = ratingService;
        }

        // ===================================
        // GET: api/admin/ratings/stats
        // إحصائيات التقييمات الكلية
        // ===================================
        [HttpGet("stats")]
        public async Task<IActionResult> GetOverallStats()
        {
            try
            {
                var stats = await _ratingService.GetOverallStatsAsync();
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/admin/ratings
        // قائمة التقييمات
        // ===================================
        [HttpGet]
        public async Task<IActionResult> GetAllRatings(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var ratings = await _ratingService.GetAllRatingsAsync(pageNumber, pageSize);
                return Ok(new { success = true, data = ratings });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/admin/ratings/vendors/{vendorId}
        // إحصائيات متجر معين
        // ===================================
        [HttpGet("vendors/{vendorId}")]
        public async Task<IActionResult> GetVendorStats(Guid vendorId)
        {
            try
            {
                var stats = await _ratingService.GetVendorStatsAsync(vendorId);
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/admin/ratings/drivers/{driverId}
        // إحصائيات سائق معين
        // ===================================
        [HttpGet("drivers/{driverId}")]
        public async Task<IActionResult> GetDriverStats(Guid driverId)
        {
            try
            {
                var stats = await _ratingService.GetDriverStatsAsync(driverId);
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}