using ecommerce.Core.DTO.Promotion;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PromotionsController : Controller
    {
        private readonly IPromotionService _promotionService;

        public PromotionsController(IPromotionService promotionService)
        {
            _promotionService = promotionService;
        }

        // ===================================
        // GET: api/promotions/active
        // العروض النشطة حالياً - للعميل
        // ===================================
        [HttpGet("active")]
        [AllowAnonymous]
        public async Task<IActionResult> GetActive()
        {
            try
            {
                var promotions = await _promotionService.GetActiveAsync();
                return Ok(new { success = true, data = promotions });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/promotions/product/{productId}
        // سعر المنتج بعد تطبيق العرض - للعميل
        // ===================================
        [HttpGet("product/{productId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProductPrice(Guid productId)
        {
            try
            {
                var result = await _promotionService.GetProductPriceAsync(productId);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/promotions              (Admin)
        // ===================================
        [HttpGet]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var promotions = await _promotionService.GetAllAsync();
                return Ok(new { success = true, data = promotions });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/promotions/paged        (Admin)
        // ===================================
        [HttpGet("paged")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetPaged(
            [FromQuery] bool? isActive = null,
            [FromQuery] string? targetType = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var (promotions, totalCount) = await _promotionService.GetPagedAsync(
                    isActive, targetType, pageNumber, pageSize);

                return Ok(new
                {
                    success    = true,
                    data       = promotions,
                    pagination = new
                    {
                        total      = totalCount,
                        page       = pageNumber,
                        pageSize   = pageSize,
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
        // GET: api/promotions/{id}         (Admin)
        // ===================================
        [HttpGet("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var promotion = await _promotionService.GetByIdAsync(id);
                return Ok(new { success = true, data = promotion });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/promotions             (Admin)
        // ===================================
        [HttpPost]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Create([FromBody] CreatePromotionDto dto)
        {
            try
            {
                var promotion = await _promotionService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = promotion.Id },
                    new { success = true, data = promotion, message = "تم إنشاء العرض بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/promotions/{id}         (Admin)
        // ===================================
        [HttpPut("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePromotionDto dto)
        {
            try
            {
                var promotion = await _promotionService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = promotion, message = "تم تعديل العرض بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/promotions/{id}      (Admin)
        // ===================================
        [HttpDelete("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _promotionService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف العرض بنجاح" });
                else
                    return NotFound(new { success = false, message = "العرض غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}