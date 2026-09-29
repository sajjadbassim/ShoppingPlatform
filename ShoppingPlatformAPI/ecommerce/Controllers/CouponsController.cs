using ecommerce.Core.DTO.CouponDto;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : Controller
    {
        private readonly ICouponService _couponService;

        public CouponsController(ICouponService couponService)
        {
            _couponService = couponService;
        }

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        // ===================================
        // POST: api/coupons/validate
        // التحقق من الكوبون وحساب الخصم
        // ===================================
        [HttpPost("validate")]
        [Authorize]
        public async Task<IActionResult> Validate([FromBody] ValidateCouponDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId == null)
                    return Unauthorized(new { success = false, message = "يجب تسجيل الدخول" });

                var result = await _couponService.ValidateAsync(userId.Value, dto);

                if (!result.IsValid)
                    return BadRequest(new { success = false, message = result.ErrorMessage });

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/coupons              (Admin)
        // ===================================
        [HttpGet]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var coupons = await _couponService.GetAllAsync();
                return Ok(new { success = true, data = coupons });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/coupons/paged         (Admin)
        // ===================================
        [HttpGet("paged")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetPaged(
            [FromQuery] bool? isActive = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var (coupons, totalCount) = await _couponService.GetPagedAsync(
                    isActive, pageNumber, pageSize);

                return Ok(new
                {
                    success = true,
                    data = coupons,
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
        // GET: api/coupons/{id}          (Admin)
        // ===================================
        [HttpGet("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var coupon = await _couponService.GetByIdAsync(id);
                return Ok(new { success = true, data = coupon });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/coupons              (Admin)
        // ===================================
        [HttpPost]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Create([FromBody] CreateCouponDto dto)
        {
            try
            {
                var coupon = await _couponService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = coupon.Id },
                    new { success = true, data = coupon, message = "تم إنشاء الكوبون بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/coupons/{id}          (Admin)
        // ===================================
        [HttpPut("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCouponDto dto)
        {
            try
            {
                var coupon = await _couponService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = coupon, message = "تم تعديل الكوبون بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/coupons/{id}       (Admin)
        // ===================================
        [HttpDelete("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _couponService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف الكوبون بنجاح" });
                else
                    return NotFound(new { success = false, message = "الكوبون غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}
