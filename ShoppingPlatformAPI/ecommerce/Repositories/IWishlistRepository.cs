using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IWishlistRepository
    {
        Task<Wishlist> GetByIdAsync(Guid id);
        Task<IEnumerable<Wishlist>> GetByUserIdAsync(Guid userId);
        Task<Wishlist> GetByUserAndProductAsync(Guid userId, Guid productId);
        Task<bool> ExistsAsync(Guid userId, Guid productId);
        Task<Wishlist> CreateAsync(Wishlist wishlist);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> DeleteByUserAndProductAsync(Guid userId, Guid productId);
        Task<int> GetCountByUserAsync(Guid userId);
        Task<bool> ClearUserWishlistAsync(Guid userId);
    }
}