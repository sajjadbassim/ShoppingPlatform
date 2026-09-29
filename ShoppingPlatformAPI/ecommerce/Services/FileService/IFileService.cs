namespace ecommerce.Services.FileService
{
    public interface IFileService
    {
        Task<string> SaveImageAsync(IFormFile file, string folder = "products");
        Task<List<string>> SaveImagesAsync(List<IFormFile> files, string folder = "products");
        Task<bool> DeleteImageAsync(string imageUrl);
        Task<bool> DeleteImagesAsync(List<string> imageUrls);
    }
}
