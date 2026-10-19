using SkiaSharp;

namespace ecommerce.Services.FileService
{
    // نسخ مصغّرة WebP من الصور المرفوعة: /uploads/products/x.jpg?w=600 يُخدم من /uploads/_w/600/products/x.jpg.webp
    // تُولَّد عند أول طلب وتُحفظ على القرص، فتعمل للصور القديمة أيضاً دون ترحيل.
    // العروض محصورة في ثلاثة (لا يمكن طلب آلاف المقاسات لإشغال الخادم)، وأي عرض آخر يُقرَّب لأقرب واحد أكبر منه
    public class ImageVariants
    {
        public static readonly int[] Widths = { 200, 600, 1200 };
        private const int WebpQuality = 80;
        private const string VariantsDir = "_w";
        private static readonly string[] ResizableExtensions = { ".jpg", ".jpeg", ".png", ".webp" }; // GIF يبقى أصلياً حتى لا تضيع حركته

        // التصغير ثقيل على المعالج — لا نسمح بأكثر من بضع عمليات في نفس الوقت
        private static readonly SemaphoreSlim Gate = new(Math.Max(2, Environment.ProcessorCount / 2));

        private readonly IWebHostEnvironment _env;

        public ImageVariants(IWebHostEnvironment env) => _env = env;

        public static int SnapWidth(int requested) =>
            Widths.FirstOrDefault(w => w >= requested, Widths[^1]);

        // المسار النسبي للنسخة المصغّرة (يولّدها إن لم توجد) — null = تُخدم الصورة الأصلية كما هي
        public async Task<string?> EnsureAsync(string relativeUrl, int requestedWidth, CancellationToken ct = default)
        {
            var source = ResolveSource(relativeUrl);
            if (source == null || requestedWidth <= 0 || !File.Exists(source)) return null;

            var width = SnapWidth(requestedWidth);
            var (variantPath, variantUrl) = VariantOf(source, width);
            if (File.Exists(variantPath)) return variantUrl;

            await Gate.WaitAsync(ct);
            try
            {
                // طلب آخر ربما ولّدها ونحن ننتظر
                if (File.Exists(variantPath)) return variantUrl;

                var bytes = Resize(source, width);
                if (bytes == null) return null;

                Directory.CreateDirectory(Path.GetDirectoryName(variantPath)!);
                // الكتابة لملف مؤقت ثم النقل: لا يُخدم ملف نصف مكتوب
                var temp = variantPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
                await File.WriteAllBytesAsync(temp, bytes, ct);
                File.Move(temp, variantPath, overwrite: true);
                return variantUrl;
            }
            finally
            {
                Gate.Release();
            }
        }

        // تُحذف مع الصورة الأصلية
        public void Delete(string relativeUrl)
        {
            var source = ResolveSource(relativeUrl);
            if (source == null) return;
            foreach (var width in Widths)
            {
                var (path, _) = VariantOf(source, width);
                try { if (File.Exists(path)) File.Delete(path); }
                catch (IOException) { /* تبقى بلا ضرر */ }
            }
        }

        // لا تكبير: الصورة الأصغر من العرض المطلوب تُحوَّل WebP بعرضها الأصلي
        internal static byte[]? Resize(string sourcePath, int width)
        {
            using var codec = SKCodec.Create(sourcePath);
            if (codec == null) return null;
            var origin = codec.EncodedOrigin;
            using var bitmap = SKBitmap.Decode(codec);
            if (bitmap == null) return null;

            // صور الهاتف تُحفظ مدوّرة مع علامة EXIF للاتجاه — نطبّقها وإلا ظهرت الصورة مائلة
            var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
                or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
            var orientedW = swap ? bitmap.Height : bitmap.Width;
            var orientedH = swap ? bitmap.Width : bitmap.Height;

            var tw = Math.Min(width, orientedW);
            var th = Math.Max(1, (int)Math.Round((double)orientedH * tw / orientedW));

            using var surface = SKSurface.Create(new SKImageInfo(tw, th, SKColorType.Rgba8888, SKAlphaType.Premul));
            var canvas = surface.Canvas;
            canvas.Clear(SKColors.Transparent);
            canvas.SetMatrix(OrientationMatrix(origin, tw, th));

            using var image = SKImage.FromBitmap(bitmap);
            var dest = swap ? SKRect.Create(th, tw) : SKRect.Create(tw, th);
            canvas.DrawImage(image, dest, new SKSamplingOptions(SKCubicResampler.Mitchell));

            using var snapshot = surface.Snapshot();
            using var data = snapshot.Encode(SKEncodedImageFormat.Webp, WebpQuality);
            return data?.ToArray();
        }

        // x' = ScaleX·x + SkewX·y + TransX ، y' = SkewY·x + ScaleY·y + TransY
        private static SKMatrix OrientationMatrix(SKEncodedOrigin origin, int w, int h) => origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, w, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, w, -1, 0, h, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, h, 0, 0, 1),
            _ => SKMatrix.Identity,
        };

        private string WebRoot => _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        private string UploadsRoot => Path.GetFullPath(Path.Combine(WebRoot, "uploads")) + Path.DirectorySeparatorChar;

        // داخل wwwroot/uploads فقط (لا ../)، ولا نصغّر النسخ المصغّرة نفسها
        private string? ResolveSource(string relativeUrl)
        {
            if (string.IsNullOrWhiteSpace(relativeUrl) || !relativeUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
                return null;
            var full = Path.GetFullPath(Path.Combine(WebRoot, relativeUrl.TrimStart('/').Split('?')[0]));
            if (!full.StartsWith(UploadsRoot, StringComparison.OrdinalIgnoreCase)) return null;
            if (full.StartsWith(UploadsRoot + VariantsDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return null;
            return ResizableExtensions.Contains(Path.GetExtension(full).ToLowerInvariant()) ? full : null;
        }

        private (string Path, string Url) VariantOf(string sourceFullPath, int width)
        {
            var rest = Path.GetRelativePath(UploadsRoot, sourceFullPath);
            var path = Path.Combine(UploadsRoot, VariantsDir, width.ToString(), rest + ".webp");
            var url = "/uploads/" + Path.GetRelativePath(UploadsRoot, path).Replace('\\', '/');
            return (path, url);
        }
    }
}
