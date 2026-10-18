using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services.AdminService
{
    // إيقاف/حذف حساب: لا يوقف المدير نفسه، ولا يُوقف آخر مدير فعّال — وإلا تُقفل الإدارة على الجميع
    public static class AdminAccountGuard
    {
        public static async Task EnsureCanDisableAsync(IUserRepository users, User target, Guid actingUserId)
        {
            if (target.Id == actingUserId)
                throw new BusinessRuleException("لا يمكنك إيقاف حسابك أو حذفه");
            if (target.Role == UserRoles.Admin && target.IsActive && await users.CountActiveAdminsAsync() <= 1)
                throw new BusinessRuleException("لا يمكن إيقاف آخر مدير فعّال — فعّل مديراً آخر أولاً");
        }
    }
}
