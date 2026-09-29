using ecommerce.Core.DTO.HomePage;
using ecommerce.Services.HomeService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HomeController : Controller
    {
        private readonly IHomeService _homeService;

        public HomeController(IHomeService homeService)
        {
            _homeService = homeService;
        }

        // GET: api/home
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetHomePage()
        {
            try
            {
                var homePage = await _homeService.GetHomePageAsync();
                return Ok(new { success = true, data = homePage });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/home/banners
        [HttpGet("banners")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBanners([FromQuery] bool onlyActive = true)
        {
            try
            {
                var banners = await _homeService.GetBannersAsync(onlyActive);
                return Ok(new { success = true, data = banners });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/home/banners
        // ✅ multipart/form-data لقبول الصور
        [HttpPost("banners")]
        [Authorize(Roles = "ADMIN")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateBanner([FromForm] CreateBannerDto dto)
        {
            try
            {
                // التحقق أن واحداً منهما موجود
                if (dto.ImageFile == null)
                    return BadRequest(new { success = false, message = "الصورة مطلوبة" });
                var banner = await _homeService.CreateBannerAsync(dto);
                return Ok(new { success = true, data = banner, message = "تم إنشاء البانر بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/home/banners/{id}
        // ✅ multipart/form-data لقبول الصور
        [HttpPut("banners/{id}")]
        [Authorize(Roles = "ADMIN")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UpdateBanner(Guid id, [FromForm] UpdateBannerDto dto)
        {
            try
            {
                var banner = await _homeService.UpdateBannerAsync(id, dto);
                return Ok(new { success = true, data = banner, message = "تم تعديل البانر بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/home/banners/{id}
        [HttpDelete("banners/{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> DeleteBanner(Guid id)
        {
            try
            {
                var result = await _homeService.DeleteBannerAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف البانر بنجاح" });
                else
                    return NotFound(new { success = false, message = "البانر غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/home/sections
        [HttpGet("sections")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSections([FromQuery] bool onlyActive = true)
        {
            try
            {
                var sections = await _homeService.GetSectionsAsync(onlyActive);
                return Ok(new { success = true, data = sections });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/home/sections/{id}
        [HttpGet("sections/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSectionById(Guid id)
        {
            try
            {
                var section = await _homeService.GetSectionByIdAsync(id);
                return Ok(new { success = true, data = section });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // POST: api/home/sections
        [HttpPost("sections")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> CreateSection([FromBody] CreateHomeSectionDto dto)
        {
            try
            {
                var section = await _homeService.CreateSectionAsync(dto);
                return Ok(new { success = true, data = section, message = "تم إنشاء القسم بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/home/sections/{id}
        [HttpPut("sections/{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> UpdateSection(Guid id, [FromBody] UpdateHomeSectionDto dto)
        {
            try
            {
                var section = await _homeService.UpdateSectionAsync(id, dto);
                return Ok(new { success = true, data = section, message = "تم تعديل القسم بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/home/sections/{id}
        [HttpDelete("sections/{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> DeleteSection(Guid id)
        {
            try
            {
                var result = await _homeService.DeleteSectionAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف القسم بنجاح" });
                else
                    return NotFound(new { success = false, message = "القسم غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/home/sections/{id}/items
        [HttpPost("sections/{id}/items")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> AddSectionItem(Guid id, [FromBody] AddSectionItemDto dto)
        {
            try
            {
                var section = await _homeService.AddSectionItemAsync(id, dto);
                return Ok(new { success = true, data = section, message = "تم إضافة المنتج للقسم بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/home/sections/{id}/items/{productId}
        [HttpDelete("sections/{id}/items/{productId}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> RemoveSectionItem(Guid id, Guid productId)
        {
            try
            {
                var result = await _homeService.RemoveSectionItemAsync(id, productId);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المنتج من القسم بنجاح" });
                else
                    return NotFound(new { success = false, message = "المنتج غير موجود في هذا القسم" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}