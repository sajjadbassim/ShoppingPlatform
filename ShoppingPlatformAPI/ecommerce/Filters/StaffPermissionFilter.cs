using System.Security.Claims;
using ecommerce.Core.Constants;
using ecommerce.Services.AuthService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ecommerce.Filters
{
    // يفرض صلاحيات الحسابات المساعدة على كل واجهة: موظف المتجر بما سمح به صاحبه، والمسؤول المحدود بما سمح به الأدمن.
    // صاحب المتجر والأدمن الكامل والأدوار الأخرى لا يمرّون بأي قيد هنا
    public class StaffPermissionFilter : IAsyncActionFilter
    {
        private readonly IUserSessionValidator _sessions;

        public StaffPermissionFilter(IUserSessionValidator sessions) => _sessions = sessions;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var user = context.HttpContext.User;
            var role = user.FindFirstValue(ClaimTypes.Role);
            if ((role == UserRoles.Vendor || role == UserRoles.Admin)
                && Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                && context.ActionDescriptor is ControllerActionDescriptor d)
            {
                var (permissions, staffVendorId) = await _sessions.GetAccessAsync(userId, context.HttpContext.RequestAborted);
                var restricted = role == UserRoles.Vendor ? staffVendorId != null : permissions != null;
                if (restricted && !Allowed(role, d.ControllerName, d.ActionName, context.HttpContext.Request.Method, StaffPermissions.Parse(permissions)))
                {
                    context.Result = new ObjectResult(new { success = false, message = "لا تملك صلاحية لهذا القسم — اطلبها من صاحب الحساب" })
                    { StatusCode = StatusCodes.Status403Forbidden };
                    return;
                }
            }
            await next();
        }

        public static bool Allowed(string role, string controller, string action, string method, HashSet<string> granted)
        {
            var map = role == UserRoles.Vendor ? StaffPermissions.VendorMap : StaffPermissions.AdminMap;
            // صلاحية الإجراء نفسه أولاً (حذف السجل مثلاً) — ثم أقسام الحساب الشخصي المتاحة للجميع
            var exact = map.TryGetValue($"{controller}.{action}", out var actionPermission);
            if (!exact && StaffPermissions.PersonalControllers.Contains(controller)) return true;
            var (found, permission) = exact ? (true, actionPermission) : StaffPermissions.Lookup(map, controller, action);
            // غير مذكور: القراءة متاحة (بيانات عامة)، والتعديل ممنوع — أي واجهة جديدة آمنة افتراضياً
            if (!found) return HttpMethods.IsGet(method);
            if (permission == null) return true;
            if (permission == StaffPermissions.Full) return false;
            return granted.Contains(permission);
        }
    }
}
