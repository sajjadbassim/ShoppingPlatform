using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // فحص إصدار تطبيقات الموبايل: يعيد أقل إصدار مسموح وآخر إصدار ورابط المتجر
    // الإعداد في appsettings: "AppVersions": { "customer": { "android": { "minVersion", "latestVersion", "storeUrl" }, "ios": {...} } }
    [ApiController]
    [Route("api/app")]
    [AllowAnonymous]
    public class AppVersionController : ControllerBase
    {
        private readonly IConfiguration _config;

        public AppVersionController(IConfiguration config) => _config = config;

        // GET: api/app/version?app=customer&platform=android
        [HttpGet("version")]
        public IActionResult Version([FromQuery] string app = "customer", [FromQuery] string platform = "android")
        {
            var section = _config.GetSection($"AppVersions:{app.ToLowerInvariant()}:{platform.ToLowerInvariant()}");
            return Ok(new
            {
                success = true,
                data = new
                {
                    minVersion = section["MinVersion"] ?? "0.0.0",
                    latestVersion = section["LatestVersion"] ?? "0.0.0",
                    storeUrl = section["StoreUrl"],
                },
            });
        }
    }
}
