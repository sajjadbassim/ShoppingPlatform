using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ecommerce.Filters
{
    // لمسارات api/vendors/{vendorId}/... : يمنع صاحب متجر من الوصول لبيانات متجر آخر بتغيير المعرّف في الرابط
    public class VendorRouteAccessFilter : IAsyncActionFilter
    {
        private readonly IVendorAccessService _access;

        public VendorRouteAccessFilter(IVendorAccessService access) => _access = access;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            if (!Guid.TryParse(context.RouteData.Values["vendorId"]?.ToString(), out var vendorId))
                throw new Core.Exceptions.NotFoundException("المتجر غير موجود");

            await _access.EnsureCanManageVendorAsync(vendorId, context.HttpContext.RequestAborted);
            await next();
        }
    }
}
