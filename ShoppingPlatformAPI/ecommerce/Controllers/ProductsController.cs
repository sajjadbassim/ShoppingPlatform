using System.Security.Claims;
using ecommerce.Services.EngagementService;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Constants;
using ecommerce.Services.ProductService.ProductService;
using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ecommerce.Core.Exceptions;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : Controller
    {
        private readonly IProductService _productService;
        private readonly IVendorAccessService _access;
        private readonly ICustomerEngagementService _engagement;

        public ProductsController(IProductService productService, IVendorAccessService access, ICustomerEngagementService engagement)
        {
            _productService = productService;
            _access = access;
            _engagement = engagement;
        }

        private Guid CurrentUserId =>
            Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

        // ===================================
        // GET: api/products/buy-again?scope=grocery — ما طلبه الزبون سابقاً ومتوفر الآن
        // ===================================
        [HttpGet("buy-again")]
        [Authorize]
        public async Task<IActionResult> BuyAgain([FromQuery] string? scope = null, [FromQuery] int max = 20)
            => Ok(new { success = true, data = await _productService.GetBuyAgainAsync(CurrentUserId, scope, max) });

        // ===================================
        // «أعلمني عند التوفر»: GET حالة الاشتراك، POST اشتراك، DELETE إلغاء
        // ===================================
        [HttpGet("{id:guid}/stock-alert")]
        [Authorize]
        public async Task<IActionResult> GetStockAlert(Guid id, [FromQuery] Guid? variantId = null, CancellationToken ct = default)
            => Ok(new { success = true, data = await _engagement.GetStockAlertAsync(CurrentUserId, id, variantId, ct) });

        [HttpPost("{id:guid}/stock-alert")]
        [Authorize]
        public async Task<IActionResult> SubscribeStockAlert(Guid id, [FromQuery] Guid? variantId = null, CancellationToken ct = default)
            => Ok(new { success = true, message = "سنُعلمك فور توفره", data = await _engagement.SubscribeStockAlertAsync(CurrentUserId, id, variantId, ct) });

        [HttpDelete("{id:guid}/stock-alert")]
        [Authorize]
        public async Task<IActionResult> UnsubscribeStockAlert(Guid id, [FromQuery] Guid? variantId = null, CancellationToken ct = default)
            => Ok(new { success = true, message = "تم إلغاء التنبيه", data = await _engagement.UnsubscribeStockAlertAsync(CurrentUserId, id, variantId, ct) });

        // المنتجات المعطّلة لا تُعرض في القوائم العامة إلا للإدارة والعمليات
        private bool IsStaff => User.IsInRole("ADMIN") || User.IsInRole("OPS");
        private bool? VisibleIsActive(bool? requested) => IsStaff ? requested : null;

        // ===================================
        // GET: api/products
        // ===================================
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] int limit = 100)
        {
            try
            {
                // حد أعلى للنتائج — للقوائم الكاملة استخدم /paged
                var products = (await _productService.GetAllAsync()).Take(Math.Clamp(limit, 1, 200));
                return Ok(new { success = true, data = products });
            }
            catch (AppException ex)
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
                    minPrice, maxPrice, isAvailable, VisibleIsActive(isActive),
                    pageNumber, pageSize);

                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (AppException ex)
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

                // المنتج المعطّل/المحذوف أو من متجر/فئة معطّلة: يراه صاحب المتجر والإدارة فقط
                if (!await _productService.IsPubliclyVisibleAsync(id) &&
                    !await _access.CanManageVendorAsync(product.VendorId))
                    return NotFound(new { success = false, message = "المنتج غير موجود" });

                return Ok(new { success = true, data = product });
            }
            catch (AppException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/vendor/{vendorId}
        // ===================================
        [HttpGet("vendor/{vendorId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByVendor(Guid vendorId, [FromQuery] bool includeHidden = false)
        {
            try
            {
                // صاحب المتجر والإدارة يرون المنتجات حتى لو المتجر غير مفعّل (مثلاً بانتظار الموافقة)
                var canManage = await _access.CanManageVendorAsync(vendorId);
                // includeHidden (لوحة البائع) يُحترم للمالك والإدارة فقط
                var products = await _productService.GetByVendorAsync(
                    vendorId, includeInactiveVendor: canManage, includeHidden: canManage && includeHidden);
                return Ok(new { success = true, data = products });
            }
            catch (AppException ex)
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
            catch (AppException ex)
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
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/unified-search?term=كلمة&maxResults=5&scope=general|grocery
        // ✅ بحث موحد في المنتجات والمتاجر والتصنيفات
        // ===================================
        [HttpGet("unified-search")]
        [AllowAnonymous]
        public async Task<IActionResult> UnifiedSearch(
            [FromQuery] string term,
            [FromQuery] int maxResults = 5,
            [FromQuery] string? scope = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(term))
                    return BadRequest(new { success = false, message = "كلمة البحث مطلوبة" });

                var result = await _productService.UnifiedSearchAsync(term, Math.Clamp(maxResults, 1, 20), scope);
                return Ok(new { success = true, data = result });
            }
            catch (AppException ex)
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
                filter.IsActive = VisibleIsActive(filter.IsActive);
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
            catch (AppException ex)
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
                filter.IsActive = VisibleIsActive(filter.IsActive);
                var result = await _productService.GetAdvancedFilteredAsync(filter);

                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products — مع الصور
        // ===================================
        [HttpPost]
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        public async Task<IActionResult> Create([FromForm] CreateProductDto dto)
        {
            // المنتج يُنشأ فقط في متجر يملكه المستخدم
            await _access.EnsureCanManageVendorAsync(dto.VendorId);

            try
            {
                var product = await _productService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = product.Id },
                    new { success = true, data = product });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/products/{id} — مع صور جديدة
        // ===================================
        // POST: api/products/{id}/duplicate — نسخة مخفية من المنتج (للتاجر صاحب المنتج)
        [HttpPost("{id}/duplicate")]
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        public async Task<IActionResult> Duplicate(Guid id)
        {
            await _access.EnsureCanManageProductAsync(id);
            var copy = await _productService.DuplicateAsync(id);
            return Ok(new { success = true, data = copy, message = "تم إنشاء نسخة مخفية من المنتج" });
        }

        [HttpPut("{id}")]
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        public async Task<IActionResult> Update(Guid id, [FromForm] UpdateProductDto dto)
        {
            await _access.EnsureCanManageProductAsync(id);

            try
            {
                var product = await _productService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = product });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/{id}/images
        // ===================================
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        [HttpPost("{id}/images")]
        [Consumes("multipart/form-data")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> AddImage(Guid id, IFormFile image)
        {
            await _access.EnsureCanManageProductAsync(id);


            try
            {
                if (image == null)
                    return BadRequest(new { success = false, message = "الصورة مطلوبة" });

                var productImage = await _productService.AddImageAsync(id, image);
                return Ok(new { success = true, data = productImage, message = "تم إضافة الصورة بنجاح" });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/images/{imageId}
        // ===================================
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        [HttpDelete("images/{imageId}")]
        public async Task<IActionResult> DeleteImage(Guid imageId)
        {
            await _access.EnsureCanManageProductImageAsync(imageId);


            try
            {
                var result = await _productService.DeleteImageAsync(imageId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف الصورة بنجاح" });
                else
                    return NotFound(new { success = false, message = "الصورة غير موجودة" });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/products/{productId}/images/{imageId}/set-primary
        // ===================================
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        [HttpPatch("{productId}/images/{imageId}/set-primary")]
        public async Task<IActionResult> SetPrimaryImage(Guid productId, Guid imageId)
        {
            await _access.EnsureCanManageProductAsync(productId);
            await _access.EnsureCanManageProductImageAsync(imageId);


            try
            {
                var result = await _productService.SetPrimaryImageAsync(imageId, productId);
                if (result)
                    return Ok(new { success = true, message = "تم تعيين الصورة الرئيسية بنجاح" });
                else
                    return NotFound(new { success = false, message = "الصورة غير موجودة" });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/products/{id}/stock
        // ===================================
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        [HttpPatch("{id}/stock")]
        public async Task<IActionResult> UpdateStock(Guid id, [FromBody] int quantity)
        {
            await _access.EnsureCanManageProductAsync(id);


            try
            {
                var result = await _productService.UpdateStockAsync(id, quantity);
                if (result)
                    return Ok(new { success = true, message = "تم تحديث المخزون بنجاح" });
                else
                    return NotFound(new { success = false, message = "المنتج غير موجود" });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/{id}
        // ===================================
        [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            await _access.EnsureCanManageProductAsync(id);


            try
            {
                var result = await _productService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المنتج بنجاح" });
                else
                    return NotFound(new { success = false, message = "المنتج غير موجود" });
            }
            catch (AppException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}