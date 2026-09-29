using ecommerce.Core.DTO.Wishlist;

namespace ecommerce.Services
{
    public interface IWishlistService
    {
        Task<IEnumerable<WishlistDto>> GetUserWishlistAsync(Guid userId);
        Task<WishlistDto> AddToWishlistAsync(Guid userId, AddToWishlistDto dto);
        Task<bool> RemoveFromWishlistAsync(Guid userId, Guid productId);
        Task<bool> IsInWishlistAsync(Guid userId, Guid productId);
        Task<int> GetWishlistCountAsync(Guid userId);
        Task<bool> ClearWishlistAsync(Guid userId);
        Task<bool> ToggleWishlistAsync(Guid userId, Guid productId);
    }
}
