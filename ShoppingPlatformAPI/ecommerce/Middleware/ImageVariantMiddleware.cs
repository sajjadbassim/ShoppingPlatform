using ecommerce.Services.FileService;

namespace ecommerce.Middleware
{
    // /uploads/...?w=600 → يحوّل الطلب للنسخة المصغّرة قبل UseStaticFiles، فتخدمها كأي ملف ثابت.
    // أي فشل في التصغير (صورة تالفة مثلاً) يُخدم معه الأصل بدلاً من خطأ
    public class ImageVariantMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ImageVariants _variants;
        private readonly ILogger<ImageVariantMiddleware> _logger;

        public ImageVariantMiddleware(RequestDelegate next, ImageVariants variants, ILogger<ImageVariantMiddleware> logger)
        {
            _next = next;
            _variants = variants;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var request = context.Request;
            if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method))
                && request.Path.StartsWithSegments("/uploads")
                && int.TryParse(request.Query["w"], out var width))
            {
                try
                {
                    var variant = await _variants.EnsureAsync(request.Path.Value!, width, context.RequestAborted);
                    if (variant != null) request.Path = variant;
                }
                catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "تعذّر تصغير الصورة {Path}", request.Path.Value);
                }
            }

            await _next(context);
        }
    }
}
