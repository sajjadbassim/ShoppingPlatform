using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Controllers
{
    // روابط المشاركة: واتساب وفيسبوك وإنستغرام لا تشغّل JavaScript، فتقرأ معاينة الرابط (صورة/اسم/سعر) من هذه الصفحة،
    // والزائر يُحوَّل فوراً لصفحة المنتج أو المتجر في الموقع. المسار تحت /api ليمرّ عبر نفس الوكيل في أي استضافة
    [ApiController]
    [Route("api/share")]
    [AllowAnonymous]
    public class ShareController : ControllerBase
    {
        private const string SiteName = "منصة واسط التجارية";

        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public ShareController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // GET: api/share/products/{id}
        [HttpGet("products/{id:guid}")]
        public async Task<IActionResult> Product(Guid id, CancellationToken ct)
        {
            var hidden = (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).ToList();
            var product = await _context.Products.AsNoTracking()
                .Where(p => p.Id == id && p.IsActive && !p.IsDeleted && p.Vendor.IsActive &&
                            (p.CategoryId == null || !hidden.Contains(p.CategoryId.Value)))
                .Select(p => new
                {
                    p.Name, p.NameAr, p.Description, p.Price, p.WeightStepKg,
                    Vendor = p.Vendor.NameAr ?? p.Vendor.Name,
                    Image = p.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.ImageUrl).FirstOrDefault()
                })
                .FirstOrDefaultAsync(ct);
            var path = $"/products/{id}";
            if (product == null) return Redirect("/");

            var name = product.NameAr ?? product.Name;
            // سعر البيع بالوزن يُعرض لكل كغم
            var price = product.WeightStepKg is > 0 ? product.Price / product.WeightStepKg.Value : product.Price;
            var priceText = $"{price.ToString("N0", CultureInfo.InvariantCulture)} د.ع{(product.WeightStepKg.HasValue ? " / كغم" : "")}";
            var description = $"{priceText} — من {product.Vendor}" +
                              (string.IsNullOrWhiteSpace(product.Description) ? "" : $" · {Shorten(product.Description, 140)}");
            return Page(name, description, product.Image, path, "product",
                extra: $"<meta property=\"product:price:amount\" content=\"{price.ToString("0.##", CultureInfo.InvariantCulture)}\">" +
                       "<meta property=\"product:price:currency\" content=\"IQD\">");
        }

        // GET: api/share/stores/{id}
        [HttpGet("stores/{id:guid}")]
        public async Task<IActionResult> Store(Guid id, CancellationToken ct)
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .Where(v => v.Id == id && v.IsActive)
                .Select(v => new { v.Name, v.NameAr, v.Description, v.CoverImageUrl, v.LogoUrl })
                .FirstOrDefaultAsync(ct);
            if (vendor == null) return Redirect("/");

            var name = vendor.NameAr ?? vendor.Name;
            var description = string.IsNullOrWhiteSpace(vendor.Description)
                ? $"تسوّق من {name} على {SiteName}"
                : Shorten(vendor.Description, 160);
            return Page(name, description, vendor.CoverImageUrl ?? vendor.LogoUrl, $"/stores/{id}", "website");
        }

        private ContentResult Page(string title, string description, string? image, string path, string type, string extra = "")
        {
            var site = SiteUrl();
            var url = site + path;
            var imageUrl = string.IsNullOrWhiteSpace(image) ? site + "/pwa-512x512.png"
                : image.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? image : site + image;
            string E(string value) => WebUtility.HtmlEncode(value);

            var html = new StringBuilder()
                .Append("<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">")
                .Append($"<title>{E(title)} | {E(SiteName)}</title>")
                .Append($"<meta name=\"description\" content=\"{E(description)}\">")
                .Append($"<meta property=\"og:type\" content=\"{type}\">")
                .Append($"<meta property=\"og:site_name\" content=\"{E(SiteName)}\">")
                .Append("<meta property=\"og:locale\" content=\"ar_IQ\">")
                .Append($"<meta property=\"og:title\" content=\"{E(title)}\">")
                .Append($"<meta property=\"og:description\" content=\"{E(description)}\">")
                .Append($"<meta property=\"og:image\" content=\"{E(imageUrl)}\">")
                .Append($"<meta property=\"og:url\" content=\"{E(url)}\">")
                .Append("<meta name=\"twitter:card\" content=\"summary_large_image\">")
                .Append(extra)
                .Append($"<link rel=\"canonical\" href=\"{E(url)}\">")
                .Append($"<meta http-equiv=\"refresh\" content=\"0;url={E(path)}\">")
                .Append($"<script>location.replace({JsonSerializer.Serialize(path)})</script>")
                .Append($"</head><body><a href=\"{E(path)}\">{E(title)}</a></body></html>");

            Response.Headers.CacheControl = "public, max-age=600";
            return Content(html.ToString(), "text/html; charset=utf-8");
        }

        // عنوان الموقع العام: الإعداد Share:SiteUrl، ثم ترويسات الوكيل، ثم عنوان الطلب نفسه
        private string SiteUrl()
        {
            var configured = _config["Share:SiteUrl"];
            if (!string.IsNullOrWhiteSpace(configured)) return configured.TrimEnd('/');

            var host = Request.Headers["X-Forwarded-Host"].FirstOrDefault()?.Split(',')[0].Trim();
            var proto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault()?.Split(',')[0].Trim();
            return $"{(string.IsNullOrWhiteSpace(proto) ? Request.Scheme : proto)}://{(string.IsNullOrWhiteSpace(host) ? Request.Host.Value : host)}";
        }

        private static string Shorten(string text, int max)
        {
            var clean = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return clean.Length <= max ? clean : clean[..max].TrimEnd() + "…";
        }
    }
}
