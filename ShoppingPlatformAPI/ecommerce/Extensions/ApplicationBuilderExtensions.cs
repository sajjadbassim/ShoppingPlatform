using ecommerce.Middleware;

namespace ecommerce.Extensions
{
    public static class ApplicationBuilderExtensions
    {
        // يُستدعى أول شيء في الـ Pipeline حتى يلتقط استثناءات كل ما بعده
        public static IApplicationBuilder UseAppExceptionHandling(this IApplicationBuilder app) =>
            app.UseMiddleware<ExceptionHandlingMiddleware>();
    }
}
