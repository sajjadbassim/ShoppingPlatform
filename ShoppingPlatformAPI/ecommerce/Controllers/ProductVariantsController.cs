using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Product;
using ecommerce.Services;
using ecommerce.Services.ProductService;
using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/products/{productId}/variants")]
    [Authorize(Policy = PolicyNames.OpsOrAdminOrVendor)]

    public class ProductVariantsController : Controller
    {
        private readonly IVariantService _variantService;
        private readonly IVendorAccessService _access;

        public ProductVariantsController(IVariantService variantService, IVendorAccessService access)
        {
            _variantService = variantService;
            _access = access;
        }

        // ===================================
        // GET: api/products/{productId}/variants/attributes
        // جلب خصائص المنتج مع قيمها
        // ===================================
        [HttpGet("attributes")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAttributes(Guid productId)
        {
            try
            {
                var attributes = await _variantService.GetAttributesAsync(productId);
                return Ok(new { success = true, data = attributes });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/{productId}/variants/attributes
        // إضافة خاصية جديدة مع قيمها
        // ===================================
        [HttpPost("attributes")]
        public async Task<IActionResult> CreateAttribute(Guid productId, [FromBody] CreateProductAttributeDto dto)
        {
            await _access.EnsureCanManageProductAsync(productId);


            try
            {
                var attribute = await _variantService.CreateAttributeAsync(productId, dto);
                return Ok(new { success = true, data = attribute, message = "تم إضافة الخاصية بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/products/{productId}/variants/attributes/{attributeId}
        // تعديل خاصية
        // ===================================
        [HttpPut("attributes/{attributeId}")]
        public async Task<IActionResult> UpdateAttribute(Guid productId, Guid attributeId, [FromBody] UpdateProductAttributeDto dto)
        {
            await _access.EnsureCanManageAttributeAsync(productId, attributeId);


            try
            {
                var attribute = await _variantService.UpdateAttributeAsync(attributeId, dto);
                return Ok(new { success = true, data = attribute, message = "تم تعديل الخاصية بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/{productId}/variants/attributes/{attributeId}
        // حذف خاصية مع قيمها
        // ===================================
        [HttpDelete("attributes/{attributeId}")]
        public async Task<IActionResult> DeleteAttribute(Guid productId, Guid attributeId)
        {
            await _access.EnsureCanManageAttributeAsync(productId, attributeId);


            try
            {
                var result = await _variantService.DeleteAttributeAsync(attributeId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف الخاصية بنجاح" });
                else
                    return NotFound(new { success = false, message = "الخاصية غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/{productId}/variants/attributes/{attributeId}/values
        // إضافة قيمة جديدة لخاصية
        // ===================================
        [HttpPost("attributes/{attributeId}/values")]
        public async Task<IActionResult> AddAttributeValue(Guid productId, Guid attributeId, [FromBody] CreateAttributeValueDto dto)
        {
            await _access.EnsureCanManageAttributeAsync(productId, attributeId);


            try
            {
                var value = await _variantService.AddAttributeValueAsync(attributeId, dto);
                return Ok(new { success = true, data = value, message = "تم إضافة القيمة بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/{productId}/variants/attributes/{attributeId}/values/{valueId}
        // حذف قيمة خاصية
        // ===================================
        [HttpDelete("attributes/{attributeId}/values/{valueId}")]
        public async Task<IActionResult> DeleteAttributeValue(Guid productId, Guid attributeId, Guid valueId)
        {
            await _access.EnsureCanManageAttributeValueAsync(productId, attributeId, valueId);


            try
            {
                var result = await _variantService.DeleteAttributeValueAsync(valueId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف القيمة بنجاح" });
                else
                    return NotFound(new { success = false, message = "القيمة غير موجودة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/{productId}/variants
        // جلب كل متغيرات المنتج
        // ===================================
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetVariants(Guid productId)
        {
            try
            {
                var variants = await _variantService.GetVariantsAsync(productId);
                return Ok(new { success = true, data = variants });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/products/{productId}/variants/{variantId}
        // تفاصيل متغير محدد
        // ===================================
        [HttpGet("{variantId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetVariantById(Guid productId, Guid variantId)
        {
            try
            {
                var variant = await _variantService.GetVariantByIdAsync(variantId);
                return Ok(new { success = true, data = variant });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/products/{productId}/variants
        // إنشاء متغير جديد
        // ===================================
        [HttpPost]
        public async Task<IActionResult> CreateVariant(Guid productId, [FromBody] CreateProductVariantDto dto)
        {
            await _access.EnsureCanManageProductAsync(productId);


            try
            {
                var variant = await _variantService.CreateVariantAsync(productId, dto);
                return Ok(new { success = true, data = variant, message = "تم إنشاء المتغير بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/products/{productId}/variants/{variantId}
        // تعديل متغير
        // ===================================
        [HttpPut("{variantId}")]
        public async Task<IActionResult> UpdateVariant(Guid productId, Guid variantId, [FromBody] UpdateProductVariantDto dto)
        {
            await _access.EnsureCanManageVariantAsync(productId, variantId);


            try
            {
                var variant = await _variantService.UpdateVariantAsync(variantId, dto);
                return Ok(new { success = true, data = variant, message = "تم تعديل المتغير بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/products/{productId}/variants/{variantId}
        // حذف متغير
        // ===================================
        [HttpDelete("{variantId}")]
        public async Task<IActionResult> DeleteVariant(Guid productId, Guid variantId)
        {
            await _access.EnsureCanManageVariantAsync(productId, variantId);


            try
            {
                var result = await _variantService.DeleteVariantAsync(variantId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المتغير بنجاح" });
                else
                    return NotFound(new { success = false, message = "المتغير غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}