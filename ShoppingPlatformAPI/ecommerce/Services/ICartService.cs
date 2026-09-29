using ecommerce.Core.DTO.Cart;

namespace ecommerce.Services
{
    public interface ICartService
    {
        Task<CartResponseDto> GetCartAsync(Guid userId);
        Task<CartResponseDto> AddToCartAsync(Guid userId, AddToCartDto dto);
        Task<CartResponseDto> UpdateQuantityAsync(Guid userId, UpdateCartItemDto dto);
        Task<CartResponseDto> RemoveFromCartAsync(Guid userId, Guid productId, Guid? variantId = null);
        Task<bool> ClearCartAsync(Guid userId);
    }
}