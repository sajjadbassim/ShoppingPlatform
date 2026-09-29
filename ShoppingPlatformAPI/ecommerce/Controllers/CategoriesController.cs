using ecommerce.Core.DTO.Category;
using ecommerce.Core.DTO.Common;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    //[Authorize]
    public class CategoriesController : Controller
    {
        private readonly ICategoryService _categoryService;

        public CategoriesController(ICategoryService categoryService)
        {
            _categoryService = categoryService;
        }

        // ✅ POST: api/categories - مع رفع الأيقونة
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create([FromForm] CategoryCreateDto dto)
        {
            try
            {
                var category = await _categoryService.CreateAsync(dto);
                return Ok(new { success = true, data = category });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories/{id}
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var category = await _categoryService.GetByIdAsync(id);
                return Ok(new { success = true, data = category });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] bool onlyActive = true)
        {
            try
            {
                var categories = await _categoryService.GetAllAsync(onlyActive);
                return Ok(new { success = true, data = categories });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories/parent/{parentId}
        // GET: api/categories/parent/{parentId}?onlyActive=true
        // ملاحظة: لجلب التصنيفات الرئيسية (ParentId = null) استخدم: api/categories/parent
        [HttpGet("children/{parentId:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByParentId(Guid parentId, [FromQuery] bool onlyActive = true)
        {
            try
            {
                var categories = await _categoryService.GetByParentIdAsync(parentId, onlyActive);
                return Ok(new { success = true, data = categories });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories/root
        [HttpGet("root")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRootCategories([FromQuery] bool onlyActive = true)
        {
            try
            {
                var categories = await _categoryService.GetByParentIdAsync(null, onlyActive);
                return Ok(new { success = true, data = categories });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories/name/{name}
        [HttpGet("name/{name}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByName(string name)
        {
            try
            {
                var category = await _categoryService.GetByNameAsync(name);
                return Ok(new { success = true, data = category });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/categories/Arbicname/{name}
        [HttpGet("Arbicname/{name}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByArabicName(string name)
        {
            try
            {
                var category = await _categoryService.GetByArbicNameAsync(name);
                return Ok(new { success = true, data = category });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ✅ PUT: api/categories/{id} - مع رفع أيقونة جديدة
        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(Guid id, [FromForm] CategoryUpdateDto dto)
        {
            try
            {
                var category = await _categoryService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = category });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ✅ POST: api/categories/{id}/icon - تحديث الأيقونة فقط
        [HttpPost("{id}/icon")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateIcon(Guid id, IFormFile icon)
        {
            try
            {
                if (icon == null)
                    return BadRequest(new { success = false, message = "الأيقونة مطلوبة" });

                var category = await _categoryService.UpdateIconAsync(id, icon);
                return Ok(new { success = true, data = category, message = "تم تحديث الأيقونة بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ✅ DELETE: api/categories/{id}/icon - حذف الأيقونة
        [HttpDelete("{id}/icon")]
        public async Task<IActionResult> DeleteIcon(Guid id)
        {
            try
            {
                var result = await _categoryService.DeleteIconAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف الأيقونة بنجاح" });
                else
                    return NotFound(new { success = false, message = "الأيقونة غير موجودة" });
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


        // GET: api/categories/paged
        [HttpGet("paged")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPaged(
            [FromQuery] PaginationParams pagination,
            [FromQuery] Guid? parentId = null,
            [FromQuery] bool onlyActive = true)
        {
            try
            {
                var result = await _categoryService.GetPagedAsync(
                    pagination,
                    parentId,
                    onlyActive
                );

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

        // DELETE: api/categories/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var isActive = await _categoryService.DeleteAsync(id);

                if (isActive == null)
                    return NotFound(new { success = false, message = "التصنيف غير موجود" });

                var message = isActive.Value ? "تم تفعيل التصنيف" : "تم تعطيل التصنيف";
                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}