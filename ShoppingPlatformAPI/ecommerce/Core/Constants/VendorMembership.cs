using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Core.Constants
{
    // «متجري»: المتجر الذي يملكه المستخدم، أو الذي يعمل فيه موظفاً (User.StaffVendorId).
    // كل مكان كان يبحث بـ OwnerId == userId يمرّ من هنا كي يعمل الموظف مثل صاحبه (ضمن صلاحياته)
    public static class VendorMembership
    {
        public static async Task<Guid?> VendorIdOfAsync(AppDbContext context, Guid userId, CancellationToken ct = default)
        {
            var owned = await context.Vendors.AsNoTracking().Where(v => v.OwnerId == userId)
                .Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct);
            if (owned != null) return owned;
            return await context.Users.AsNoTracking().Where(u => u.Id == userId && u.IsActive)
                .Select(u => u.StaffVendorId).FirstOrDefaultAsync(ct);
        }

        // صاحب المتجر أو موظف فيه
        public static async Task<bool> IsMemberAsync(AppDbContext context, Guid userId, Guid vendorId, CancellationToken ct = default) =>
            await context.Vendors.AsNoTracking().AnyAsync(v => v.Id == vendorId && v.OwnerId == userId, ct)
            || await context.Users.AsNoTracking().AnyAsync(u => u.Id == userId && u.IsActive && u.StaffVendorId == vendorId, ct);
    }
}
