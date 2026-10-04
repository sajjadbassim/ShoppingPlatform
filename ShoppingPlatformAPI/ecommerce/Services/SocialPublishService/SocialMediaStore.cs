using ecommerce.Core.Exceptions;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace ecommerce.Services.SocialPublishService
{
    public record SocialUploadDto(string Url, string Type);

    // صور وفيديوهات يرفعها التاجر من الاستوديو للنشر على حسابات التواصل (غير صور المنتج).
    // تُحفظ في wwwroot/uploads/social/v-{vendorId}/ — المجلد يثبت الملكية فلا يحتاج جدولاً،
    // والمنصات تجلبها من الرابط العام. ما لا يستخدمه أي منشور يُحذف تلقائياً (CleanupUnused)
    public interface ISocialMediaStore
    {
        Task<SocialUploadDto> UploadAsync(Guid userId, IFormFile file, CancellationToken ct = default);
        bool IsVendorUpload(Guid vendorId, string url);
        int CleanupUnused(IReadOnlySet<string> keep, DateTime olderThanUtc);
    }

    public class SocialMediaStore : ISocialMediaStore
    {
        public const long MaxImageBytes = 15L * 1024 * 1024;
        public const long MaxVideoBytes = 100L * 1024 * 1024;
        public const string TypeImage = "image";
        public const string TypeVideo = "video";

        private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
        // إنستغرام يقبل MP4 و MOV (H.264 أو HEVC) — فيديو الآيفون MOV
        private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mov" };

        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<SocialMediaStore> _logger;

        public SocialMediaStore(AppDbContext context, IWebHostEnvironment env, ILogger<SocialMediaStore> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        public static bool IsVideo(string url) => VideoExtensions.Contains(Path.GetExtension(url.Split('?')[0]));

        public async Task<SocialUploadDto> UploadAsync(Guid userId, IFormFile file, CancellationToken ct = default)
        {
            var vendorId = await _context.Vendors.Where(v => v.OwnerId == userId).Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct)
                ?? throw new ForbiddenException("هذا الحساب غير مرتبط بمتجر");

            if (file == null || file.Length == 0)
                throw new BusinessRuleException("اختر صورة أو فيديو");
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var isVideo = VideoExtensions.Contains(ext);
            if (!isVideo && !ImageExtensions.Contains(ext))
                throw new BusinessRuleException("الصيغ المقبولة: JPG و PNG و WebP للصور، و MP4 و MOV للفيديو");
            if (file.Length > (isVideo ? MaxVideoBytes : MaxImageBytes))
                throw new BusinessRuleException(isVideo ? "الفيديو أكبر من 100 ميغابايت" : "الصورة أكبر من 15 ميغابايت");

            // التحقق من المحتوى لا من الامتداد فقط
            await using (var stream = file.OpenReadStream())
            {
                if (isVideo ? !await HasMp4SignatureAsync(stream, ct) : !IsDecodableImage(stream))
                    throw new BusinessRuleException(isVideo ? "ملف الفيديو تالف أو بصيغة غير مدعومة" : "ملف الصورة تالف أو بصيغة غير مدعومة");
            }

            var dir = Path.Combine(SocialRoot, VendorFolder(vendorId));
            Directory.CreateDirectory(dir);
            var name = $"{Guid.NewGuid():N}{(ext == ".jpeg" ? ".jpg" : ext)}";
            await using (var output = File.Create(Path.Combine(dir, name)))
                await file.CopyToAsync(output, ct);

            return new SocialUploadDto($"/uploads/social/{VendorFolder(vendorId)}/{name}", isVideo ? TypeVideo : TypeImage);
        }

        // رفعه هذا المتجر وما زال موجوداً
        public bool IsVendorUpload(Guid vendorId, string url)
        {
            var prefix = $"/uploads/social/{VendorFolder(vendorId)}/";
            if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return false;
            var name = url[prefix.Length..];
            if (name.Length == 0 || name.IndexOfAny(new[] { '/', '\\' }) >= 0 || name.Contains("..")) return false;
            return File.Exists(Path.Combine(SocialRoot, VendorFolder(vendorId), name));
        }

        // حذف المرفوعات القديمة التي لا يستخدمها أي منشور (رُفعت ولم تُنشر، أو حُذف سجلها)
        public int CleanupUnused(IReadOnlySet<string> keep, DateTime olderThanUtc)
        {
            if (!Directory.Exists(SocialRoot)) return 0;
            var removed = 0;
            foreach (var dir in Directory.EnumerateDirectories(SocialRoot, "v-*"))
            {
                foreach (var path in Directory.EnumerateFiles(dir))
                {
                    var url = $"/uploads/social/{Path.GetFileName(dir)}/{Path.GetFileName(path)}";
                    if (keep.Contains(url) || File.GetLastWriteTimeUtc(path) > olderThanUtc) continue;
                    try { File.Delete(path); removed++; }
                    catch (IOException ex) { _logger.LogDebug("Could not delete {Path}: {Error}", path, ex.Message); }
                }
            }
            return removed;
        }

        private string SocialRoot => Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads", "social");
        private static string VendorFolder(Guid vendorId) => $"v-{vendorId:N}";

        private static bool IsDecodableImage(Stream stream)
        {
            using var codec = SKCodec.Create(stream);
            return codec != null && codec.Info.Width > 0 && codec.Info.Height > 0;
        }

        // MP4 و MOV: الصندوق الأول (ftyp) يبدأ عند البايت 4
        private static async Task<bool> HasMp4SignatureAsync(Stream stream, CancellationToken ct)
        {
            var header = new byte[12];
            var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
            return read >= 8 && header[4] == (byte)'f' && header[5] == (byte)'t' && header[6] == (byte)'y' && header[7] == (byte)'p';
        }
    }
}
