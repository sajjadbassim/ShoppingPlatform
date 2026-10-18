using ecommerce.Core.Constants;
using ecommerce.Services.ActivityLogService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace ecommerce.Filters
{
    // كل طلب يغيّر بيانات (غير GET) نجح ونفّذه أدمن/عمليات/متجر/سائق → سطر في سجل النشاط.
    // ما تغيّر فعلاً يلتقطه ActivityChangeInterceptor أثناء الحفظ
    public class ActivityLogFilter : IAsyncActionFilter
    {
        private readonly IActivityLogService _log;

        public ActivityLogFilter(IActivityLogService log) => _log = log;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var executed = await next();

            var http = context.HttpContext;
            if (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method) || HttpMethods.IsOptions(http.Request.Method)) return;
            if (http.User.Identity?.IsAuthenticated != true) return;
            if (executed.Exception != null && !executed.ExceptionHandled) return;
            if (executed.Result is IStatusCodeActionResult { StatusCode: >= 400 }) return;
            if (context.ActionDescriptor is not ControllerActionDescriptor d) return;
            if (ActivityActions.IsIgnored(d.ControllerName, d.ActionName)) return;

            await _log.RecordActionAsync(http, d.ControllerName, d.ActionName);
        }
    }
}
