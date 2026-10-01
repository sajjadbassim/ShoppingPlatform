using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public static class AvatarSources
    {
        public const string Upload = "upload";
        public const string Google = "google";
        public const string None = "none";      // حذفها المستخدم بنفسه — لا نعيد صورة Google بعدها
    }

    public interface IAvatarService
    {
        Task<string> UploadAsync(Guid userId, IFormFile file);
        Task RemoveAsync(Guid userId);
        // نسخ صورة Google إن لم يرفع المستخدم صورة بنفسه — لا يحفظ (المستدعي يحفظ) ولا يرمي أخطاء
        Task SyncGoogleAsync(User user, string? pictureUrl);
    }

    // جلب صورة Google (يُستبدل في الاختبارات)
    public interface IGooglePictureFetcher
    {
        Task<byte[]?> FetchAsync(string url);
    }

    public class GooglePictureFetcher : IGooglePictureFetcher
    {
        private readonly IHttpClientFactory _http;
        public GooglePictureFetcher(IHttpClientFactory http) => _http = http;

        public async Task<byte[]?> FetchAsync(string url)
        {
            // روابط صور Google فقط
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps
                || !uri.Host.EndsWith(".googleusercontent.com", StringComparison.OrdinalIgnoreCase))
                return null;

            var client = _http.CreateClient("google-avatar");
            using var res = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
            if (!res.IsSuccessStatusCode) return null;
            if (res.Content.Headers.ContentLength > AvatarService.MaxBytes) return null;

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var ms = new MemoryStream();
            var buffer = new byte[8192];
            int read;
            while ((read = await stream.ReadAsync(buffer)) > 0)
            {
                ms.Write(buffer, 0, read);
                if (ms.Length > AvatarService.MaxBytes) return null;
            }
            return ms.ToArray();
        }
    }

    public class AvatarService : IAvatarService
    {
        public const long MaxBytes = 3 * 1024 * 1024;
        private const string Folder = "avatars";

        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IGooglePictureFetcher _fetcher;
        private readonly ILogger<AvatarService> _logger;

        public AvatarService(AppDbContext context, IWebHostEnvironment env, IGooglePictureFetcher fetcher, ILogger<AvatarService> logger)
        {
            _context = context;
            _env = env;
            _fetcher = fetcher;
            _logger = logger;
        }

        public async Task<string> UploadAsync(Guid userId, IFormFile file)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");
            if (file == null || file.Length == 0)
                throw new BusinessRuleException("اختر صورة");
            if (file.Length > MaxBytes)
                throw new BusinessRuleException("حجم الصورة يجب ألا يتجاوز 3MB");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var url = await SaveAsync(ms.ToArray())
                ?? throw new BusinessRuleException("صيغة الصورة غير مدعومة — استخدم JPG أو PNG أو WEBP");

            var old = user.AvatarUrl;
            user.AvatarUrl = url;
            user.AvatarSource = AvatarSources.Upload;
            await _context.SaveChangesAsync();
            DeleteLocal(old);
            return url;
        }

        public async Task RemoveAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new NotFoundException("المستخدم غير موجود");
            var old = user.AvatarUrl;
            user.AvatarUrl = null;
            user.AvatarSource = AvatarSources.None;
            await _context.SaveChangesAsync();
            DeleteLocal(old);
        }

        public async Task SyncGoogleAsync(User user, string? pictureUrl)
        {
            if (string.IsNullOrWhiteSpace(pictureUrl)) return;
            // صورة رفعها المستخدم أو حذفها بنفسه لا تُستبدل
            if (user.AvatarSource is AvatarSources.Upload or AvatarSources.None) return;
            if (user.GooglePictureUrl == pictureUrl && user.AvatarUrl != null) return;

            try
            {
                var bytes = await _fetcher.FetchAsync(Larger(pictureUrl));
                var url = bytes == null ? null : await SaveAsync(bytes);
                if (url == null) return;

                var old = user.AvatarUrl;
                user.AvatarUrl = url;
                user.AvatarSource = AvatarSources.Google;
                user.GooglePictureUrl = pictureUrl;
                DeleteLocal(old);
            }
            catch (Exception ex)
            {
                // الصورة لا تُفشل الدخول
                _logger.LogWarning(ex, "تعذّر نسخ صورة Google للمستخدم {UserId}", user.Id);
            }
        }

        // روابط Google تنتهي عادةً بـ =s96-c (96px) — نطلب 256px
        private static string Larger(string url)
        {
            var i = url.LastIndexOf("=s", StringComparison.Ordinal);
            return i > 0 && url.IndexOf('/', i) < 0 ? url[..i] + "=s256-c" : url;
        }

        // نحدد النوع من محتوى الملف نفسه لا من اسمه
        private static string? DetectExtension(byte[] b)
        {
            if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return ".jpg";
            if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return ".png";
            if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return ".webp";
            return null;
        }

        private async Task<string?> SaveAsync(byte[] bytes)
        {
            var ext = DetectExtension(bytes);
            if (ext == null) return null;
            var dir = Path.Combine(_env.WebRootPath, "uploads", Folder);
            Directory.CreateDirectory(dir);
            var name = $"{Guid.NewGuid():N}{ext}";
            await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
            return $"/uploads/{Folder}/{name}";
        }

        private void DeleteLocal(string? url)
        {
            if (string.IsNullOrEmpty(url) || !url.StartsWith($"/uploads/{Folder}/")) return;
            try
            {
                var path = Path.Combine(_env.WebRootPath, "uploads", Folder, Path.GetFileName(url));
                if (File.Exists(path)) File.Delete(path);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "تعذّر حذف الصورة القديمة {Url}", url); }
        }
    }
}
