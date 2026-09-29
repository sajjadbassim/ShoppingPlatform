using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface ICartRepository
    {
        Task<Cart> GetByUserIdAsync(Guid userId);
        Task<Cart> GetByIdAsync(Guid cartId);
        Task<CartItem> GetCartItemAsync(Guid cartId, Guid productId, Guid? variantId = null);
        Task<Cart> CreateAsync(Cart cart);
        Task<CartItem> AddItemAsync(CartItem cartItem);
        Task<CartItem> UpdateItemAsync(CartItem cartItem);
        Task<bool> RemoveItemAsync(Guid cartId, Guid productId, Guid? variantId = null);
        Task<bool> ClearCartAsync(Guid cartId);
        Task<IEnumerable<CartItem>> GetCartItemsAsync(Guid cartId);
    }
}