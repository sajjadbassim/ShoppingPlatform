using ecommerce.Core.DTO.Users;
using ecommerce.Core.Models;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : Controller
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        private Guid? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim) : null;
        }

        // GET: api/users/{id}
        [HttpGet("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetById(Guid id)
        {
            try
            {
                var user = await _userService.GetByIdAsync(id);
                return Ok(new { success = true, data = user });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/users/phone/{phone}
        [HttpGet("phone/{phone}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetByPhone(string phone)
        {
            try
            {
                var user = await _userService.GetByPhoneAsync(phone);
                return Ok(new { success = true, data = user });
            }
            catch (Exception ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // GET: api/users
        [HttpGet]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var users = await _userService.GetAllAsync();
                return Ok(new { success = true, data = users });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/users/role/{role}
        [HttpGet("role/{role}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetByRole(string role)
        {
            try
            {
                var users = await _userService.GetByRoleAsync(role);
                return Ok(new { success = true, data = users });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/users/{id}
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserDto dto)
        {
            try
            {
                var isAdmin = User.IsInRole("ADMIN");
                if (!isAdmin && GetCurrentUserId() != id)
                    return Forbid();

                var user = await _userService.UpdateAsync(id, dto);
                return Ok(new { success = true, data = user });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/users/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var result = await _userService.DeleteAsync(id);
                if (result)
                    return Ok(new { success = true, message = "تم حذف المستخدم بنجاح" });
                else
                    return NotFound(new { success = false, message = "المستخدم غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("paged")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetUsersPaged(
        [FromQuery] string role = null,
        [FromQuery] string searchTerm = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
        {
            try
            {
                var result = await _userService.GetUsersPagedAsync(
                    role,
                    searchTerm,
                    isActive,
                    pageNumber,
                    pageSize
                );

                return Ok(new
                {
                    success = true,
                    message = "تم جلب المستخدمين بنجاح",
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "حدث خطأ أثناء جلب المستخدمين",
                    error = ex.Message
                });
            }
        }

    }
}
