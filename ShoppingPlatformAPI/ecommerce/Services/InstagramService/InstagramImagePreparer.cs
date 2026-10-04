using SkiaSharp;

namespace ecommerce.Services.InstagramService
{
    // تجهيز صور المنتج للنشر على إنستغرام: إنستغرام يقبل JPEG فقط وبنسبة بين 4:5 و1.91:1.
    // صور المنتجات غالباً WebP/PNG بخلفية شفافة وبأبعاد مختلفة، فتُرسم وسط مربع 1080×1080 بخلفية بيضاء
    // (الشفافية تصبح بيضاء لا سوداء) وتُحفظ JPEG في wwwroot/uploads/social ليجلبها إنستغرام من الرابط العام
    public interface IInstagramImagePreparer
    {
        // يعيد المسار النسبي للصورة المجهزة (/uploads/social/...jpg)
        Task<string> PrepareAsync(string sourceRelativeUrl, CancellationToken ct = default);
        void Delete(IEnumerable<string> preparedRelativeUrls);
    }

    public class InstagramImagePreparer : IInstagramImagePreparer
    {
        public const int Size = 1080;
        private const float PaddingRatio = 0.06f;
        private const int JpegQuality = 90;
        private const string Folder = "social";

        private readonly IWebHostEnvironment _env;

        public InstagramImagePreparer(IWebHostEnvironment env) => _env = env;

        public async Task<string> PrepareAsync(string sourceRelativeUrl, CancellationToken ct = default)
        {
            var sourcePath = ResolveUploadPath(sourceRelativeUrl)
                ?? throw new InvalidOperationException("مسار الصورة غير صالح");
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException("صورة المنتج غير موجودة على الخادم", sourceRelativeUrl);

            var bytes = await File.ReadAllBytesAsync(sourcePath, ct);
            using var source = SKBitmap.Decode(bytes)
                ?? throw new InvalidOperationException("تعذّر قراءة صورة المنتج (صيغة غير مدعومة)");

            using var surface = SKSurface.Create(new SKImageInfo(Size, Size, SKColorType.Rgba8888, SKAlphaType.Premul));
            var canvas = surface.Canvas;
            canvas.Clear(SKColors.White);

            // احتواء الصورة داخل المربع مع هامش، دون قص
            var box = Size * (1 - 2 * PaddingRatio);
            var scale = Math.Min(box / source.Width, box / source.Height);
            var w = source.Width * scale;
            var h = source.Height * scale;
            var dest = SKRect.Create((Size - w) / 2, (Size - h) / 2, w, h);
            using var image = SKImage.FromBitmap(source);
            canvas.DrawImage(image, dest, new SKSamplingOptions(SKCubicResampler.Mitchell));

            using var snapshot = surface.Snapshot();
            using var data = snapshot.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);

            var dir = Path.Combine(WebRoot, "uploads", Folder);
            Directory.CreateDirectory(dir);
            var name = $"ig-{Guid.NewGuid():N}.jpg";
            await using (var file = File.Create(Path.Combine(dir, name)))
                data.SaveTo(file);

            return $"/uploads/{Folder}/{name}";
        }

        public void Delete(IEnumerable<string> preparedRelativeUrls)
        {
            foreach (var url in preparedRelativeUrls)
            {
                // الصور التي جهّزها هو فقط (ig-*) — لا مرفوعات التاجر (v-*) ولا صور المنتجات
                if (!url.StartsWith($"/uploads/{Folder}/ig-", StringComparison.OrdinalIgnoreCase)) continue;
                var path = ResolveUploadPath(url);
                try { if (path != null && File.Exists(path)) File.Delete(path); }
                catch (IOException) { /* تُحذف في المرة القادمة أو تبقى بلا ضرر */ }
            }
        }

        private string WebRoot => _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");

        // داخل wwwroot/uploads فقط — يمنع الوصول لملفات أخرى عبر مسار مثل ../
        private string? ResolveUploadPath(string relativeUrl)
        {
            if (string.IsNullOrWhiteSpace(relativeUrl) || !relativeUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
                return null;
            var root = Path.GetFullPath(Path.Combine(WebRoot, "uploads")) + Path.DirectorySeparatorChar;
            var full = Path.GetFullPath(Path.Combine(WebRoot, relativeUrl.TrimStart('/').Split('?')[0]));
            return full.StartsWith(root, StringComparison.OrdinalIgnoreCase) ? full : null;
        }
    }
}
