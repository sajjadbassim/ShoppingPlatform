using ecommerce.Core.Exceptions;
using ecommerce.Filters;
using ecommerce.Services.ImageToolsService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ecommerce.Controllers
{
    // أدوات صور المنتج في تطبيق التاجر (الملكية يتحقق منها VendorRouteAccessFilter، والموظف يحتاج صلاحية المنتجات)
    [ApiController]
    [Route("api/vendors/{vendorId}/image-tools")]
    [Authorize(Policy = "OpsOrAdminOrVendor")]
    [TypeFilter(typeof(VendorRouteAccessFilter))]
    public class ProductImageToolsController : Controller
    {
        private const long MaxBytes = 12 * 1024 * 1024;
        private static readonly string[] Allowed = { "image/jpeg", "image/png", "image/webp" };
        private readonly IBackgroundRemovalService _bg;

        public ProductImageToolsController(IBackgroundRemovalService bg) => _bg = bg;

        // يعيد الصورة بلا خلفية (PNG شفاف) مباشرة، ووقت الانتظار والمعالجة في الترويسات للقياس
        [HttpPost("remove-background")]
        [EnableRateLimiting("image-tools")]
        [RequestSizeLimit(MaxBytes + 512 * 1024)]
        public async Task<IActionResult> RemoveBackground(Guid vendorId, IFormFile file, CancellationToken ct)
        {
            if (file == null || file.Length == 0) throw new BusinessRuleException("لم تُرسل صورة");
            if (file.Length > MaxBytes) throw new BusinessRuleException("حجم الصورة كبير جداً (الحد 12MB)");
            if (!Allowed.Contains(file.ContentType?.ToLowerInvariant())) throw new BusinessRuleException("صيغة الصورة غير مدعومة");

            await using var stream = file.OpenReadStream();
            var result = await _bg.RemoveAsync(stream, file.FileName, file.ContentType!, ct);
            if (result.QueueMs is int q) Response.Headers["X-Queue-Ms"] = q.ToString();
            if (result.ProcessMs is int p) Response.Headers["X-Process-Ms"] = p.ToString();
            return File(result.Png, "image/png");
        }
    }
}
