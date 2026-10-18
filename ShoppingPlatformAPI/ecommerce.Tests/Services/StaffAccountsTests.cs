using System.Reflection;
using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Filters;
using ecommerce.Services.StaffService;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    // الحسابات المساعدة: موظفو المتجر والمسؤولون المحدودون — من يُسمح له بماذا
    public class StaffAccountsTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly User _owner = new() { Phone = "07700000001", FullName = "صاحب", Role = UserRoles.Vendor };
        private readonly User _admin = new() { Phone = "07700000002", FullName = "أدمن", Role = UserRoles.Admin };
        private readonly Vendor _vendor;

        public StaffAccountsTests()
        {
            _vendor = new Vendor { Name = "A", OwnerId = _owner.Id };
            _context.AddRange(_owner, _admin, _vendor);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();
        private StaffService Service() => new(_context);

        private static CreateStaffDto NewStaff(string phone, params string[] permissions) =>
            new() { FullName = "موظف", Phone = phone, Password = "123456", Permissions = permissions.ToList() };

        // ===== الفلتر =====
        private static bool Vendor(string c, string a, string m, params string[] p) => StaffPermissionFilter.Allowed(UserRoles.Vendor, c, a, m, p.ToHashSet());
        private static bool Admin(string c, string a, string m, params string[] p) => StaffPermissionFilter.Allowed(UserRoles.Admin, c, a, m, p.ToHashSet());

        [Fact]
        public void VendorStaff_OnlyGrantedSections()
        {
            Assert.True(Vendor("VendorDashboard", "ConfirmOrder", "POST", StaffPermissions.Orders));
            Assert.False(Vendor("VendorDashboard", "ConfirmOrder", "POST", StaffPermissions.Products));
            Assert.False(Vendor("Products", "Update", "PUT", StaffPermissions.Orders));
            Assert.True(Vendor("Products", "Update", "PUT", StaffPermissions.Products));
            Assert.False(Vendor("VendorFinance", "Me", "GET", StaffPermissions.Orders));       // الأرباح تحتاج صلاحيتها حتى للقراءة
            Assert.True(Vendor("VendorDashboard", "GetDashboard", "GET"));                    // الرئيسية للجميع
            Assert.False(Vendor("VendorStaff", "Create", "POST", StaffPermissions.Vendor.Select(p => p.Key).ToArray()));   // الموظفون لصاحب المتجر فقط
            Assert.True(Vendor("UserPreferences", "Update", "PUT"));                           // حسابه الشخصي
            Assert.True(Vendor("Categories", "GetAll", "GET"));                                // قراءة عامة
            Assert.False(Vendor("SomethingNew", "Do", "POST", StaffPermissions.Orders));       // واجهة جديدة غير مذكورة: ممنوعة
        }

        [Fact]
        public void LimitedAdmin_OnlyGrantedSections()
        {
            Assert.True(Admin("Coupons", "Create", "POST", StaffPermissions.Coupons));
            Assert.False(Admin("Finance", "Balances", "GET", StaffPermissions.Coupons));
            Assert.False(Admin("AdminStaff", "List", "GET", StaffPermissions.Admin.Select(p => p.Key).ToArray()));
            Assert.False(Admin("Admin", "ChangeUserRole", "PUT", StaffPermissions.Users));
            Assert.True(Admin("Admin", "GetDashboardStats", "GET"));
            Assert.True(Admin("ActivityLog", "Get", "GET", StaffPermissions.Coupons));          // يرى نشاطه
            Assert.False(Admin("ActivityLog", "PurgeOld", "DELETE", StaffPermissions.Coupons));  // لا يحذف السجل بلا صلاحيته
            Assert.True(Admin("ActivityLog", "PurgeOld", "DELETE", StaffPermissions.Activity));
            Assert.True(Admin("OpsDriverAccounts", "CashCustody", "GET", StaffPermissions.AdminFinance));
            Assert.False(Admin("OpsDriverAccounts", "UpdateSettings", "PUT", StaffPermissions.AdminFinance));
        }

        // كل مفتاح في خرائط الصلاحيات وأوصاف السجل يطابق Controller.Action موجوداً — اسم خاطئ يعني قسماً بلا حماية أو وصفاً لا يظهر
        [Fact]
        public void Maps_ReferToRealControllersAndActions()
        {
            var actions = typeof(ecommerce.Controllers.AuthController).Assembly.GetTypes()
                .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract && t.Name.EndsWith("Controller"))
                .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .Select(m => $"{t.Name[..^"Controller".Length]}.{m.Name}")
                    .Append(t.Name[..^"Controller".Length]))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var keys = StaffPermissions.VendorMap.Keys.Concat(StaffPermissions.AdminMap.Keys)
                .Concat(ActivityActions.LabelKeys.Where(k => !k.StartsWith("auth.")));
            Assert.Empty(keys.Where(k => !actions.Contains(k)));
        }

        // ===== موظفو المتجر =====
        [Fact]
        public async Task Owner_ManagesStaff_StaffResolvesStore_RemovedStaffLosesIt()
        {
            var staff = await Service().CreateVendorStaffAsync(_owner.Id, NewStaff("07700000010", "orders", "bogus", "orders"));
            Assert.Equal(new[] { "orders" }, staff.Permissions);
            Assert.Equal(_vendor.Id, await VendorMembership.VendorIdOfAsync(_context, staff.Id));

            // موظف لا يدير الموظفين، ولا بلا صلاحيات، ولا برقم مكرر
            await Assert.ThrowsAsync<ForbiddenException>(() => Service().CreateVendorStaffAsync(staff.Id, NewStaff("07700000011", "orders")));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateVendorStaffAsync(_owner.Id, NewStaff("07700000012")));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateVendorStaffAsync(_owner.Id, NewStaff("07700000010", "orders")));

            var updated = await Service().UpdateVendorStaffAsync(_owner.Id, staff.Id, new UpdateStaffDto { Permissions = new() { "products", "orders" } });
            Assert.Equal(new[] { "orders", "products" }, updated.Permissions);

            await Service().RemoveVendorStaffAsync(_owner.Id, staff.Id);
            Assert.Null(await VendorMembership.VendorIdOfAsync(_context, staff.Id));
            Assert.Empty(await Service().ListVendorStaffAsync(_owner.Id));
        }

        // ===== المسؤولون =====
        [Fact]
        public async Task Admins_LastFullAdminCannotBeRestrictedOrDisabled()
        {
            var limited = await Service().CreateAdminAsync(_admin.Id, NewStaff("07700000020", "coupons", "finance"));
            Assert.False(limited.FullAccess);
            Assert.Equal(new[] { "coupons", "finance" }, limited.Permissions);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().UpdateAdminAsync(_admin.Id, _admin.Id, new UpdateStaffDto { Permissions = new() { "coupons" } }));
            var other = await Service().CreateAdminAsync(_admin.Id, new CreateStaffDto { FullName = "ب", Phone = "07700000021", Password = "123456", FullAccess = true });
            // الآن يوجد أدمنان كاملان: يمكن تقييد أحدهما، لكن لا يمكن تقييد الأخير ولا إيقافه
            await Service().UpdateAdminAsync(_admin.Id, other.Id, new UpdateStaffDto { Permissions = new() { "users" } });
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().ToggleAdminAsync(other.Id, _admin.Id));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().UpdateAdminAsync(other.Id, _admin.Id, new UpdateStaffDto { Permissions = new() { "users" } }));
        }
    }
}
