using ecommerce.Core.DTO.Product;
using ecommerce.Services.ProductService.ProductService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : Controller
    {
        private readonly IProductService _productService;

        public ProductsController(IProductService productService)
        {
            _productService = productService;
        }

        // ===================================
        // GET: api/products
        // ===================================
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var products = await _productService.GetAllAsync();
                return Ok(new { success = true, data = products });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/paged
        // ===================================
        [HttpGet("paged")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProductsPaged(
            [FromQuery] Guid? vendorId = null,
            [FromQuery] Guid? categoryId = null,
            [FromQuery] string searchTerm = null,
            [FromQuery] decimal? minPrice = null,
            [FromQuery] decimal? maxPrice = null,
            [FromQuery] bool? isAvailable = null,
            [FromQuery] bool? isActive = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var result = await _productService.GetProductsPagedAsync(
                    vendorId, categoryId, searchTerm,
                    minPrice, maxPrice, isAvailable, isActive,
                    pageNumber, pageSize);

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
        // GET: api/products/{id}
        // ===================================
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var product = await _productService.GetByIdAsync(id);
                return Ok(new { success = true, data = product });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/vendor/{vendorId}
        // ===================================
        [HttpGet("vendor/{vendorId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByVendor(Guid vendorId)
        {
            try
            {
                var products = await _productService.GetByVendorAsync(vendorId);
                return Ok(new { success = true, data = products });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/category/{categoryId}
        // ===================================
        [HttpGet("category/{categoryId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByCategory(Guid categoryId)
        {
            try
            {
                var products = await _productService.GetByCategoryAsync(categoryId);
                return Ok(new { success = true, data = products });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/search?term=كلمة البحث
        // ===================================
        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> Search([FromQuery] string term)
        {
            try
            {
                var products = await _productService.SearchAsync(term);
                return Ok(new { success = true, data = products });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/unified-search?term=كلمة&maxResults=5
        // ✅ بحث موحد في المنتجات والمتاجر والتصنيفات
        // ===================================
        [HttpGet("unified-search")]
        [AllowAnonymous]
        public async Task<IActionResult> UnifiedSearch(
            [FromQuery] string term,
            [FromQuery] int maxResults = 5)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(term))
                    return BadRequest(new { success = false, message = "كلمة البحث مطلوبة" });

                var result = await _productService.UnifiedSearchAsync(term, maxResults);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/filter
        // ===================================
        [HttpPost("filter")]
        [AllowAnonymous]
        public async Task<IActionResult> GetFiltered([FromBody] ProductFilterDto filter)
        {
            try
            {
                var (products, totalCount) = await _productService.GetFilteredAsync(filter);

                return Ok(new
                {
                    success = true,
                    data = products,
                    pagination = new
                    {
                        total = totalCount,
                        page = filter.PageNumber,
                        pageSize = filter.PageSize,
                        totalPages = (int)Math.Ceiling(totalCount / (double)filter.PageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/advanced-filter
        // ✅ بحث متقدم: تقييم + عروض + ترتيب
        // ===================================
        [HttpPost("advanced-filter")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAdvancedFiltered([FromBody] ProductFilterDto filter)
        {
            try
            {
                var result = await _productService.GetAdvancedFilteredAsync(filter);

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
        // POST: api/products — مع الصور
        // ===================================
        [HttpPost]
        public async Task<IActionResult> Create([FromForm] CreateProductDto dto)
        {
            try
            {
                var product = await _productService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = product.Id },
                    new { success = true, data = product });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // ===================================
        // PUT: api/products/{id} — مع صور جديدة
        // ===================================
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromForm] UpdateProductDto dto)
        {
            try
            {
                var product = await _productService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = product });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/{id}/images
        // ===================================
        [HttpPost("{id}/images")]
        [Consumes("multipart/form-data")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> AddImage(Guid id, IFormFile image)
        {
            try
            {
                if (image == null)
                    return BadRequest(new { success = false, message = "الصورة مطلوبة" });

                var productImage = await _productService.AddImageAsync(id, image);
                return Ok(new { success = true, data = productImage, message = "تم إضافة الصورة بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/images/{imageId}
        // ===================================
        [HttpDelete("images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid imageId)
        {
            try
            {
                var result = await _productService.DeleteImageAsync(imageId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف الصورة بنجاح" });
                else
                    return NotFound(new { success = false, message = "الصورة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/products/{productId}/images/{imageId}/set-primary
        // ===================================
        [HttpPatch("{productId}/images/{imageId}/set-primary")]
        public async Task<IActionResult> SetPrimaryImage(Guid productId, Guid imageId)
        {
            try
            {
                var result = await _productService.SetPrimaryImageAsync(imageId, productId);
                if (result)
                    return Ok(new { success = true, message = "تم تعيين الصورة الرئيسية بنجاح" });
                else
                    return NotFound(new { success = false, message = "الصورة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/products/{id}/stock
        // ===================================
        [HttpPatch("{id}/stock")]
        public async Task<IActionResult> UpdateStock(Guid id, [FromBody] int quantity)
        {
            try
            {
                var result = await _productService.UpdateStockAsync(id, quantity);
                if (result)
                    return Ok(new { success = true, message = "تم تحديث المخزون بنجاح" });
                else
                    return NotFound(new { success = false, message = "المنتج غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/{id}
        // ===================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _productService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المنتج بنجاح" });
                else
                    return NotFound(new { success = false, message = "المنتج غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}