namespace ecommerce.Services.FileService
{
    public class FileService : IFileService
    {
        private readonly IWebHostEnvironment _environment;
        private readonly long _maxFileSize = 5 * 1024 * 1024; // 5MB
        private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

        public FileService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public async Task<string> SaveImageAsync(IFormFile file, string folder = "products")
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("الملف غير صالح");

            // التحقق من الحجم
            if (file.Length > _maxFileSize)
                throw new ArgumentException($"حجم الصورة يجب أن لا يتجاوز {_maxFileSize / 1024 / 1024}MB");

            // التحقق من الامتداد
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
                throw new ArgumentException("صيغة الصورة غير مدعومة. الصيغ المسموحة: jpg, jpeg, png, gif, webp");

            // الامتداد وحده يمكن تزويره — نتحقق من توقيع الملف الفعلي
            if (!await HasImageSignatureAsync(file, extension))
                throw new ArgumentException("الملف ليس صورة صالحة");

            // إنشاء اسم فريد للملف
            var fileName = $"{Guid.NewGuid()}{extension}";
            var folderPath = Path.Combine(_environment.WebRootPath, "uploads", folder);

            // التأكد من وجود المجلد
            if (!Directory.Exists(folderPath))
                Directory.CreateDirectory(folderPath);

            var filePath = Path.Combine(folderPath, fileName);

            // حفظ الملف
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // إرجاع المسار النسبي
            return $"/uploads/{folder}/{fileName}";
        }

        public async Task<List<string>> SaveImagesAsync(List<IFormFile> files, string folder = "products")
        {
            if (files == null || files.Count == 0)
                return new List<string>();

            if (files.Count > 5)
                throw new ArgumentException("لا يمكن رفع أكثر من 5 صور");

            var imageUrls = new List<string>();

            foreach (var file in files)
            {
                try
                {
                    var imageUrl = await SaveImageAsync(file, folder);
                    imageUrls.Add(imageUrl);
                }
                catch (Exception ex)
                {
                    // حذف الصور التي تم رفعها في حالة حدوث خطأ
                    await DeleteImagesAsync(imageUrls);
                    throw new Exception($"فشل رفع الصورة: {ex.Message}");
                }
            }

            return imageUrls;
        }

        public async Task<bool> DeleteImageAsync(string imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
                return false;

            try
            {
                var filePath = Path.GetFullPath(Path.Combine(_environment.WebRootPath, imageUrl.TrimStart('/')));

                // الحذف داخل مجلد الرفع فقط
                var uploadsRoot = Path.GetFullPath(Path.Combine(_environment.WebRootPath, "uploads")) + Path.DirectorySeparatorChar;
                if (!filePath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
                    return false;

                if (File.Exists(filePath))
                {
                    await Task.Run(() => File.Delete(filePath));
                    return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        private static async Task<bool> HasImageSignatureAsync(IFormFile file, string extension)
        {
            var header = new byte[12];
            int read;
            using (var stream = file.OpenReadStream())
                read = await stream.ReadAsync(header.AsMemory(0, header.Length));

            bool Starts(params byte[] sig) => read >= sig.Length && header.AsSpan(0, sig.Length).SequenceEqual(sig);

            return extension switch
            {
                ".jpg" or ".jpeg" => Starts(0xFF, 0xD8, 0xFF),
                ".png" => Starts(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
                ".gif" => Starts(0x47, 0x49, 0x46, 0x38),                               // GIF8
                ".webp" => Starts(0x52, 0x49, 0x46, 0x46) && read >= 12 &&               // RIFF....WEBP
                           header.AsSpan(8, 4).SequenceEqual(new byte[] { 0x57, 0x45, 0x42, 0x50 }),
                _ => false
            };
        }

        public async Task<bool> DeleteImagesAsync(List<string> imageUrls)
        {
            if (imageUrls == null || imageUrls.Count == 0)
                return false;

            var allDeleted = true;
            foreach (var imageUrl in imageUrls)
            {
                var deleted = await DeleteImageAsync(imageUrl);
                if (!deleted)
                    allDeleted = false;
            }

            return allDeleted;
        }
    }
}
