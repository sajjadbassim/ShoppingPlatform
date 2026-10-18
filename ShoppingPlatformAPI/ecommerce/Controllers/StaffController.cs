using System.Security.Claims;
using ecommerce.Core.Constants;
using ecommerce.Services.StaffService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // موظفو المتجر — صاحب المتجر فقط (موظفوه ممنوعون بـ StaffPermissionFilter، والخدمة تتحقق من الملكية)
    [ApiController]
    [Route("api/vendor-staff")]
    [Authorize(Roles = UserRoles.Vendor)]
    public class VendorStaffController : ControllerBase
    {
        private readonly IStaffService _staff;
        public VendorStaffController(IStaffService staff) => _staff = staff;
        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // GET: api/vendor-staff — الموظفون + قائمة الصلاحيات المتاحة
        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct) => Ok(new
        {
            success = true,
            data = await _staff.ListVendorStaffAsync(UserId, ct),
            permissions = StaffPermissions.Vendor.Select(p => new { key = p.Key, label = p.Label, desc = p.Desc }),
        });

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateStaffDto dto, CancellationToken ct)
            => Ok(new { success = true, data = await _staff.CreateVendorStaffAsync(UserId, dto, ct), message = "تمت إضافة الموظف — يدخل برقمه وكلمة المرور" });

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStaffDto dto, CancellationToken ct)
            => Ok(new { success = true, data = await _staff.UpdateVendorStaffAsync(UserId, id, dto, ct), message = "تم الحفظ" });

        [HttpPut("{id:guid}/toggle")]
        public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
        {
            var s = await _staff.ToggleVendorStaffAsync(UserId, id, ct);
            return Ok(new { success = true, data = s, message = s.IsActive ? "تم تفعيل الموظف" : "تم إيقاف الموظف — خرج من حسابه" });
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
        {
            await _staff.RemoveVendorStaffAsync(UserId, id, ct);
            return Ok(new { success = true, message = "تمت إزالة الموظف من المتجر" });
        }
    }

    // المسؤولون — الأدمن الكامل فقط (المحدود ممنوع بـ StaffPermissionFilter)
    [ApiController]
    [Route("api/admin-staff")]
    [Authorize(Roles = UserRoles.Admin)]
    public class AdminStaffController : ControllerBase
    {
        private readonly IStaffService _staff;
        public AdminStaffController(IStaffService staff) => _staff = staff;
        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct) => Ok(new
        {
            success = true,
            data = await _staff.ListAdminsAsync(ct),
            permissions = StaffPermissions.Admin.Select(p => new { key = p.Key, label = p.Label, desc = p.Desc }),
        });

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateStaffDto dto, CancellationToken ct)
            => Ok(new { success = true, data = await _staff.CreateAdminAsync(UserId, dto, ct), message = "تمت إضافة المسؤول" });

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStaffDto dto, CancellationToken ct)
            => Ok(new { success = true, data = await _staff.UpdateAdminAsync(UserId, id, dto, ct), message = "تم الحفظ" });

        [HttpPut("{id:guid}/toggle")]
        public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
        {
            var s = await _staff.ToggleAdminAsync(UserId, id, ct);
            return Ok(new { success = true, data = s, message = s.IsActive ? "تم تفعيل المسؤول" : "تم إيقاف المسؤول" });
        }
    }
}
