using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Services.VendorService.VendorService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VendorsController : Controller
    {
        private readonly IVendorService _vendorService;

        public VendorsController(IVendorService vendorService)
        {
            _vendorService = vendorService;
        }

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        // ✅ POST: api/vendors - مع رفع اللوجو
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create([FromForm] VendorCreateDto dto)
        {
            try
            {
                var ownerId = GetCurrentUserId();
                var vendor = await _vendorService.CreateAsync(dto, ownerId);
                return Ok(new { success = true, data = vendor });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
        
        // GET: api/vendors/{id}
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var vendor = await _vendorService.GetByIdAsync(id);
                return Ok(new { success = true, data = vendor });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/vendors
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] bool onlyActive = true)
        {
            try
            {
                var vendors = await _vendorService.GetAllAsync(onlyActive);
                return Ok(new { success = true, data = vendors });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ✅ PUT: api/vendors/{id} - مع رفع لوجو جديد
        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(Guid id, [FromForm] VendorUpdateDto dto)
        {
            try
            {
                var vendor = await _vendorService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = vendor });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ✅ POST: api/vendors/{id}/logo - تحديث اللوجو فقط
        [HttpPost("{id}/logo")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateLogo(Guid id, IFormFile logo)
        {
            try
            {
                if (logo == null)
                    return BadRequest(new { success = false, message = "اللوجو مطلوب" });

                var vendor = await _vendorService.UpdateLogoAsync(id, logo);
                return Ok(new { success = true, data = vendor, message = "تم تحديث اللوجو بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ✅ DELETE: api/vendors/{id}/logo - حذف اللوجو
        [HttpDelete("{id}/logo")]
        public async Task<IActionResult> DeleteLogo(Guid id)
        {
            try
            {
                var result = await _vendorService.DeleteLogoAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف اللوجو بنجاح" });
                else
                    return NotFound(new { success = false, message = "اللوجو غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        // DELETE: api/vendors/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _vendorService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف التاجر بنجاح" });
                else
                    return NotFound(new { success = false, message = "التاجر غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/vendors/phone/{phone}
        [HttpGet("phone/{phone}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByPhone(string phone)
        {
            try
            {
                var vendor = await _vendorService.GetByPhoneAsync(phone);
                return Ok(new { success = true, data = vendor });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // =======================
        // Pagination
        // =======================

        // GET: api/vendors/paged
        [HttpGet("paged")]
        [AllowAnonymous]
        public async Task<IActionResult> GetVendorsPaged(
            [FromQuery] PaginationParams pagination,
            [FromQuery] string searchTerm = null,
            [FromQuery] bool? onlyActive = null)
        {
            try
            {
                pagination ??= new PaginationParams();

                var result = await _vendorService.GetVendorsPagedAsync(
                    searchTerm,
                    onlyActive,
                    pagination.PageNumber,
                    pagination.PageSize
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
    }
}