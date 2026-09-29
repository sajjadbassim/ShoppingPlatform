using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IProductImageRepository
    {
        Task<List<ProductImage>> GetByProductIdAsync(Guid productId);
        Task<ProductImage> GetByIdAsync(Guid id);
        Task<ProductImage> CreateAsync(ProductImage image);
        Task<List<ProductImage>> CreateManyAsync(List<ProductImage> images);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> DeleteByProductIdAsync(Guid productId);
        Task<bool> SetPrimaryImageAsync(Guid imageId, Guid productId);
    }
}
