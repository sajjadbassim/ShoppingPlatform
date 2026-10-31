namespace ecommerce.Services.ImageToolsService
{
    public record BackgroundRemovalResult(byte[] Png, int? QueueMs, int? ProcessMs);

    // إزالة خلفية صورة منتج عبر الخدمة الداخلية على نفس الخادم (rembg على 127.0.0.1)
    public interface IBackgroundRemovalService
    {
        Task<BackgroundRemovalResult> RemoveAsync(Stream image, string fileName, string contentType, CancellationToken ct);
    }
}
