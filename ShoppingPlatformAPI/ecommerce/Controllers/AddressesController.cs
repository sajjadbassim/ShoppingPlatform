using ecommerce.Core.DTO.Addresses;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AddressesController : Controller
    {

        private readonly IAddressService _addressService;

        public AddressesController(IAddressService addressService)
        {
            _addressService = addressService;
        }

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : Guid.Empty;
        }

        // GET: api/addresses
        [HttpGet]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var addresses = await _addressService.GetAllAsync();
                return Ok(new { success = true, data = addresses });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }



        // POST: api/addresses
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AddressCreateDto dto)
        {
            try
            {
                dto.UserId = GetCurrentUserId();
                var address = await _addressService.CreateAsync(dto);
                return Ok(new { success = true, data = address });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/addresses/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var address = await _addressService.GetByIdAsync(id);
                if (address.UserId != GetCurrentUserId() && !User.IsInRole("ADMIN"))
                    return Forbid();

                return Ok(new { success = true, data = address });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/addresses/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetByUserId(Guid userId)
        {
            try
            {
                if (userId != GetCurrentUserId() && !User.IsInRole("ADMIN"))
                    return Forbid();

                var addresses = await _addressService.GetByUserIdAsync(userId);
                return Ok(new { success = true, data = addresses });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/addresses/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] AddressUpdateDto dto)
        {
            try
            {
                var existing = await _addressService.GetByIdAsync(id);
                if (existing.UserId != GetCurrentUserId() && !User.IsInRole("ADMIN"))
                    return Forbid();

                var address = await _addressService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = address });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/addresses/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var existing = await _addressService.GetByIdAsync(id);
                if (existing.UserId != GetCurrentUserId() && !User.IsInRole("ADMIN"))
                    return Forbid();

                var result = await _addressService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف العنوان بنجاح" });
                else
                    return NotFound(new { success = false, message = "العنوان غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}
