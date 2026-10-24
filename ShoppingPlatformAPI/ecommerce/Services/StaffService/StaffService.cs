using System.ComponentModel.DataAnnotations;
using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.StaffService
{
    // الحسابات المساعدة: موظفو المتجر (يديرهم صاحبه) والمسؤولون المحدودون (يديرهم الأدمن الكامل).
    // كل موظف حساب مستقل برقمه وكلمة مروره، فيظهر كل ما يفعله باسمه في سجل النشاط.
    // تغيير الصلاحيات أو الإيقاف يبطل توكن الموظف فوراً (UserSessionInterceptor)
    public interface IStaffService
    {
        Task<List<StaffDto>> ListVendorStaffAsync(Guid ownerId, CancellationToken ct = default);
        Task<StaffDto> CreateVendorStaffAsync(Guid ownerId, CreateStaffDto dto, CancellationToken ct = default);
        Task<StaffDto> UpdateVendorStaffAsync(Guid ownerId, Guid staffId, UpdateStaffDto dto, CancellationToken ct = default);
        Task<StaffDto> ToggleVendorStaffAsync(Guid ownerId, Guid staffId, CancellationToken ct = default);
        Task RemoveVendorStaffAsync(Guid ownerId, Guid staffId, CancellationToken ct = default);

        Task<List<StaffDto>> ListAdminsAsync(CancellationToken ct = default);
        Task<StaffDto> CreateAdminAsync(Guid actingId, CreateStaffDto dto, CancellationToken ct = default);
        Task<StaffDto> UpdateAdminAsync(Guid actingId, Guid adminId, UpdateStaffDto dto, CancellationToken ct = default);
        Task<StaffDto> ToggleAdminAsync(Guid actingId, Guid adminId, CancellationToken ct = default);
    }

    public class StaffService : IStaffService
    {
        private readonly AppDbContext _context;

        public StaffService(AppDbContext context) => _context = context;

        // ===================================
        // موظفو المتجر — صاحب المتجر فقط
        // ===================================
        private async Task<Vendor> OwnedVendorAsync(Guid ownerId, CancellationToken ct) =>
            await _context.Vendors.FirstOrDefaultAsync(v => v.OwnerId == ownerId, ct)
            ?? throw new ForbiddenException("إدارة الموظفين لصاحب المتجر فقط");

        private async Task<User> StaffOfAsync(Guid vendorId, Guid staffId, CancellationToken ct) =>
            await _context.Users.FirstOrDefaultAsync(u => u.Id == staffId && u.StaffVendorId == vendorId, ct)
            ?? throw new NotFoundException("الموظف غير موجود");

        public async Task<List<StaffDto>> ListVendorStaffAsync(Guid ownerId, CancellationToken ct = default)
        {
            var vendor = await OwnedVendorAsync(ownerId, ct);
            var users = await _context.Users.AsNoTracking().Where(u => u.StaffVendorId == vendor.Id)
                .OrderByDescending(u => u.IsActive).ThenBy(u => u.FullName).ToListAsync(ct);
            return users.Select(Map).ToList();
        }

        public async Task<StaffDto> CreateVendorStaffAsync(Guid ownerId, CreateStaffDto dto, CancellationToken ct = default)
        {
            var vendor = await OwnedVendorAsync(ownerId, ct);
            var permissions = VendorPermissions(dto.Permissions);
            var user = await NewUserAsync(dto, UserRoles.Vendor, ct);
            user.StaffVendorId = vendor.Id;
            user.Permissions = permissions;
            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        public async Task<StaffDto> UpdateVendorStaffAsync(Guid ownerId, Guid staffId, UpdateStaffDto dto, CancellationToken ct = default)
        {
            var vendor = await OwnedVendorAsync(ownerId, ct);
            var user = await StaffOfAsync(vendor.Id, staffId, ct);
            if (dto.Permissions != null) user.Permissions = VendorPermissions(dto.Permissions);
            ApplyCommon(user, dto);
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        public async Task<StaffDto> ToggleVendorStaffAsync(Guid ownerId, Guid staffId, CancellationToken ct = default)
        {
            var vendor = await OwnedVendorAsync(ownerId, ct);
            var user = await StaffOfAsync(vendor.Id, staffId, ct);
            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        // إزالة: يُوقف الحساب ويُفصل عن المتجر — يبقى في سجل النشاط باسمه
        public async Task RemoveVendorStaffAsync(Guid ownerId, Guid staffId, CancellationToken ct = default)
        {
            var vendor = await OwnedVendorAsync(ownerId, ct);
            var user = await StaffOfAsync(vendor.Id, staffId, ct);
            user.IsActive = false;
            user.StaffVendorId = null;
            user.Permissions = "";
            await _context.SaveChangesAsync(ct);
        }

        // صلاحية واحدة على الأقل — موظف بلا صلاحيات لا يرى شيئاً
        private static string VendorPermissions(IEnumerable<string>? keys)
        {
            var csv = StaffPermissions.Normalize(keys, StaffPermissions.VendorKeys, StaffPermissions.Vendor.Select(p => p.Key));
            if (csv.Length == 0) throw new BusinessRuleException("اختر صلاحية واحدة على الأقل");
            return csv;
        }

        // ===================================
        // المسؤولون — الأدمن الكامل فقط (الفلتر يمنع المحدود)
        // ===================================
        public async Task<List<StaffDto>> ListAdminsAsync(CancellationToken ct = default)
        {
            var users = await _context.Users.AsNoTracking().Where(u => u.Role == UserRoles.Admin)
                .OrderByDescending(u => u.IsActive).ThenBy(u => u.Permissions != null).ThenBy(u => u.FullName).ToListAsync(ct);
            return users.Select(Map).ToList();
        }

        public async Task<StaffDto> CreateAdminAsync(Guid actingId, CreateStaffDto dto, CancellationToken ct = default)
        {
            var user = await NewUserAsync(dto, UserRoles.Admin, ct);
            user.Permissions = dto.FullAccess ? null : AdminPermissions(dto.Permissions);
            _context.Users.Add(user);
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        public async Task<StaffDto> UpdateAdminAsync(Guid actingId, Guid adminId, UpdateStaffDto dto, CancellationToken ct = default)
        {
            if (adminId == actingId) throw new BusinessRuleException("لا يمكنك تغيير صلاحياتك بنفسك");
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId && u.Role == UserRoles.Admin, ct)
                ?? throw new NotFoundException("المسؤول غير موجود");

            if (dto.FullAccess == true) user.Permissions = null;
            else if (dto.Permissions != null)
            {
                // تقييد آخر أدمن كامل يترك المنصة بلا من يدير الصلاحيات
                if (user.Permissions == null && user.IsActive) await EnsureAnotherFullAdminAsync(user.Id, ct);
                user.Permissions = AdminPermissions(dto.Permissions);
            }
            ApplyCommon(user, dto);
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        public async Task<StaffDto> ToggleAdminAsync(Guid actingId, Guid adminId, CancellationToken ct = default)
        {
            if (adminId == actingId) throw new BusinessRuleException("لا يمكنك إيقاف حسابك");
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminId && u.Role == UserRoles.Admin, ct)
                ?? throw new NotFoundException("المسؤول غير موجود");
            if (user.IsActive && user.Permissions == null) await EnsureAnotherFullAdminAsync(user.Id, ct);
            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync(ct);
            return Map(user);
        }

        private async Task EnsureAnotherFullAdminAsync(Guid exceptId, CancellationToken ct)
        {
            if (!await _context.Users.AnyAsync(u => u.Role == UserRoles.Admin && u.IsActive && u.Permissions == null && u.Id != exceptId, ct))
                throw new BusinessRuleException("يجب أن يبقى أدمن واحد على الأقل بصلاحيات كاملة");
        }

        private static string AdminPermissions(IEnumerable<string>? keys)
        {
            var csv = StaffPermissions.Normalize(keys, StaffPermissions.AdminKeys, StaffPermissions.Admin.Select(p => p.Key));
            if (csv.Length == 0) throw new BusinessRuleException("اختر صلاحية واحدة على الأقل، أو اجعله بصلاحيات كاملة");
            return csv;
        }

        // ===================================
        // مشترك
        // ===================================
        private async Task<User> NewUserAsync(CreateStaffDto dto, string role, CancellationToken ct)
        {
            var phone = PhoneNumber.Require(dto.Phone);
            if (await _context.Users.AnyAsync(u => u.Phone == phone, ct))
                throw new BusinessRuleException("رقم الهاتف مسجل لحساب آخر");
            var email = EmailAddress.Normalize(dto.Email);
            if (email.Length > 0)
            {
                if (!EmailAddress.IsValid(email)) throw new BusinessRuleException("البريد الإلكتروني غير صحيح");
                if (await _context.Users.AnyAsync(u => u.Email == email, ct))
                    throw new BusinessRuleException("البريد الإلكتروني مستخدم لحساب آخر");
            }
            if (string.IsNullOrWhiteSpace(dto.FullName)) throw new BusinessRuleException("الاسم مطلوب");
            return new User
            {
                Phone = phone,
                Email = email,   // الفارغ يُحفظ نصاً فارغاً: العمود لا يقبل null وفهرس البريد الفريد يتجاهل الفارغ
                FullName = dto.FullName.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = role,
                IsActive = true,
            };
        }

        private static void ApplyCommon(User user, UpdateStaffDto dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.FullName)) user.FullName = dto.FullName.Trim();
            if (!string.IsNullOrEmpty(dto.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }

        private static StaffDto Map(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Phone = u.Phone,
            Email = u.Email,
            IsActive = u.IsActive,
            FullAccess = u.Permissions == null,
            Permissions = StaffPermissions.Parse(u.Permissions).ToList(),
            LastLogin = u.LastLogin,
            CreatedAt = u.CreatedAt,
        };
    }

    public class CreateStaffDto
    {
        [Required(ErrorMessage = "الاسم مطلوب")]
        [MaxLength(100)]
        public string FullName { get; set; } = "";

        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        public string Phone { get; set; } = "";

        [MaxLength(255)]
        public string? Email { get; set; }

        [Required(ErrorMessage = "كلمة المرور مطلوبة")]
        [MinLength(6, ErrorMessage = "كلمة المرور 6 أحرف على الأقل")]
        [MaxLength(100)]
        public string Password { get; set; } = "";

        public List<string>? Permissions { get; set; }

        // للمسؤولين: صلاحيات كاملة (يدير المسؤولين أيضاً)
        public bool FullAccess { get; set; }
    }

    public class UpdateStaffDto
    {
        [MaxLength(100)]
        public string? FullName { get; set; }

        // فارغة = بلا تغيير
        [MinLength(6, ErrorMessage = "كلمة المرور 6 أحرف على الأقل")]
        [MaxLength(100)]
        public string? Password { get; set; }

        public List<string>? Permissions { get; set; }
        public bool? FullAccess { get; set; }
    }

    public class StaffDto
    {
        public Guid Id { get; set; }
        public string? FullName { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public bool IsActive { get; set; }
        public bool FullAccess { get; set; }
        public List<string> Permissions { get; set; } = new();
        public DateTime? LastLogin { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
