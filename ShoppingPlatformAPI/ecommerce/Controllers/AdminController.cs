using ecommerce.Common;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Admin;
using ecommerce.Core.DTO.Common;
using ecommerce.Services.AdminService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMIN")]
    public class AdminController : Controller
    {
        private readonly IAdminService _adminService;

        public AdminController(IAdminService adminService)
        {
            _adminService = adminService;
        }

        // ===================================
        // Dashboard Stats
        // ===================================

        // GET: api/admin/dashboard/stats
        [HttpGet("dashboard/stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            try
            {
                var stats = await _adminService.GetDashboardStatsAsync();
                return Ok(new { success = true, data = stats });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // User Management
        // ===================================

        // GET: api/admin/users
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers([FromQuery] string role = null)
        {
            try
            {
                var users = await _adminService.GetAllUsersAsync(role);
                return Ok(new { success = true, data = users });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/admin/users/search?term=&role=&pageNumber=&pageSize=
        // بحث مُقسّم صفحات بالاسم أو الهاتف أو البريد (لمنتقي المستخدمين)
        [HttpGet("users/search")]
        [Authorize(Policy = PolicyNames.AdminOnly)]
        public async Task<ActionResult<ApiResponse<Common.PagedResponse<UserSearchResponseDto>>>> SearchUsers(
            [FromQuery] string? term,
            [FromQuery] string? role,
            [FromQuery] PaginationParams pagination,
            CancellationToken ct)
        {
            var result = await _adminService.SearchUsersAsync(term, role, pagination, ct);
            return Ok(ApiResponse<Common.PagedResponse<UserSearchResponseDto>>.Ok(result));
        }

        // POST: api/admin/users/ops
        [HttpPost("users/ops")]
        public async Task<IActionResult> CreateOpsUser([FromBody] CreateOpsUserDto dto)
        {
            try
            {
                var user = await _adminService.CreateOpsUserAsync(dto);
                return Ok(new { success = true, data = user, message = "تم إنشاء حساب Ops بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/admin/users/{id}/toggle-status
        [HttpPut("users/{id}/toggle-status")]
        public async Task<IActionResult> ToggleUserStatus(Guid id)
        {
            try
            {
                var isActive = await _adminService.ToggleUserStatusAsync(id);
                var message = isActive ? "تم تفعيل المستخدم" : "تم إيقاف المستخدم";
                return Ok(new { success = true, isActive, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/admin/users/{id}
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            try
            {
                var result = await _adminService.DeleteUserAsync(id);
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

        // ===================================
        // Vendor Management
        // ===================================

        // GET: api/admin/vendors
        [HttpGet("vendors")]
        public async Task<IActionResult> GetAllVendors([FromQuery] bool? isActive = null)
        {
            try
            {
                var vendors = await _adminService.GetAllVendorsAsync(isActive);
                return Ok(new { success = true, data = vendors });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/admin/vendors/{id}/toggle-status
        [HttpPut("vendors/{id}/toggle-status")]
        public async Task<IActionResult> ToggleVendorStatus(Guid id)
        {
            try
            {
                var isActive = await _adminService.ToggleVendorStatusAsync(id);
                var message = isActive ? "تم تفعيل المتجر" : "تم إيقاف المتجر";
                return Ok(new { success = true, isActive, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // Product Management
        // ===================================

        // GET: api/admin/products
        [HttpGet("products")]
        public async Task<IActionResult> GetAllProducts([FromQuery] bool? isActive = null)
        {
            try
            {
                var products = await _adminService.GetAllProductsAsync(isActive);
                return Ok(new { success = true, data = products });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/admin/products/{id}/toggle-status
        [HttpPut("products/{id}/toggle-status")]
        public async Task<IActionResult> ToggleProductStatus(Guid id)
        {
            try
            {
                var isActive = await _adminService.ToggleProductStatusAsync(id);
                var message = isActive ? "تم تفعيل المنتج" : "تم إيقاف المنتج";
                return Ok(new { success = true, isActive, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/admin/products/bulk-update-status
        [HttpPut("products/bulk-update-status")]
        public async Task<IActionResult> BulkUpdateProductsStatus([FromBody] BulkUpdateStatusDto dto)
        {
            try
            {
                var result = await _adminService.BulkUpdateProductsStatusAsync(dto.ProductIds, dto.IsActive);
                var message = dto.IsActive ? "تم تفعيل المنتجات" : "تم إيقاف المنتجات";
                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // Reports
        // ===================================

        // GET: api/admin/reports/sales
        [HttpGet("reports/sales")]
        public async Task<IActionResult> GetSalesReport(
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
                var end = endDate ?? DateTime.UtcNow;

                var report = await _adminService.GetSalesReportAsync(start, end);
                return Ok(new { success = true, data = report });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/admin/reports/top-vendors
        [HttpGet("reports/top-vendors")]
        public async Task<IActionResult> GetTopVendors([FromQuery] int count = 10)
        {
            try
            {
                var topVendors = await _adminService.GetTopVendorsAsync(count);
                return Ok(new { success = true, data = topVendors });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/admin/reports/top-products
        [HttpGet("reports/top-products")]
        public async Task<IActionResult> GetTopProducts([FromQuery] int count = 10)
        {
            try
            {
                var topProducts = await _adminService.GetTopProductsAsync(count);
                return Ok(new { success = true, data = topProducts });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


        // PUT: api/Admin/users/{id}/change-role
        [HttpPut("users/{id}/change-role")]
        public async Task<IActionResult> ChangeUserRole(Guid id, [FromBody] ChangeUserRoleDto dto)
        {
            try
            {
                var message = await _adminService.ChangeUserRoleAsync(id, dto.NewRole);
                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }


    }
    public class BulkUpdateStatusDto
    {
        public List<Guid> ProductIds { get; set; }
        public bool IsActive { get; set; }
  
    }





}
