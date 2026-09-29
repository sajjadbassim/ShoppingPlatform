using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class CartRepository : ICartRepository
    {
        private readonly AppDbContext _context;

        public CartRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Cart> GetByUserIdAsync(Guid userId)
        {
            return await _context.Carts
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Vendor)
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Category)
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Images)
                // ✅ Variant + خصائصه
                .Include(c => c.Items)
                    .ThenInclude(i => i.Variant)
                        .ThenInclude(v => v.AttributeValues)
                            .ThenInclude(av => av.AttributeValue)
                                .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(c => c.UserId == userId);
        }

        public async Task<Cart> GetByIdAsync(Guid cartId)
        {
            return await _context.Carts
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Vendor)
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Category)
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p.Images)
                // ✅ Variant + خصائصه
                .Include(c => c.Items)
                    .ThenInclude(i => i.Variant)
                        .ThenInclude(v => v.AttributeValues)
                            .ThenInclude(av => av.AttributeValue)
                                .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(c => c.Id == cartId);
        }

        // ✅ يفرق بين نفس المنتج بـ variants مختلفة
        public async Task<CartItem> GetCartItemAsync(Guid cartId, Guid productId, Guid? variantId = null)
        {
            return await _context.CartItems
                .Include(ci => ci.Product)
                .Include(ci => ci.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(ci =>
                    ci.CartId == cartId &&
                    ci.ProductId == productId &&
                    ci.VariantId == variantId);
        }

        public async Task<Cart> CreateAsync(Cart cart)
        {
            cart.CreatedAt = DateTime.UtcNow;
            cart.UpdatedAt = DateTime.UtcNow;

            await _context.Carts.AddAsync(cart);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(cart.Id);
        }

        public async Task<CartItem> AddItemAsync(CartItem cartItem)
        {
            cartItem.CreatedAt = DateTime.UtcNow;
            cartItem.UpdatedAt = DateTime.UtcNow;

            await _context.CartItems.AddAsync(cartItem);
            await _context.SaveChangesAsync();

            return await _context.CartItems
                .Include(ci => ci.Product)
                    .ThenInclude(p => p.Vendor)
                .Include(ci => ci.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(ci => ci.Id == cartItem.Id);
        }

        public async Task<CartItem> UpdateItemAsync(CartItem cartItem)
        {
            cartItem.UpdatedAt = DateTime.UtcNow;

            _context.CartItems.Update(cartItem);
            await _context.SaveChangesAsync();

            return await _context.CartItems
                .Include(ci => ci.Product)
                .Include(ci => ci.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(ci => ci.Id == cartItem.Id);
        }

        public async Task<bool> RemoveItemAsync(Guid cartId, Guid productId, Guid? variantId = null)
        {
            var cartItem = await GetCartItemAsync(cartId, productId, variantId);
            if (cartItem == null)
                return false;

            _context.CartItems.Remove(cartItem);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> ClearCartAsync(Guid cartId)
        {
            var cartItems = await _context.CartItems
                .Where(ci => ci.CartId == cartId)
                .ToListAsync();

            if (!cartItems.Any())
                return false;

            _context.CartItems.RemoveRange(cartItems);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<IEnumerable<CartItem>> GetCartItemsAsync(Guid cartId)
        {
            return await _context.CartItems
                .Include(ci => ci.Product)
                    .ThenInclude(p => p.Vendor)
                .Include(ci => ci.Product)
                    .ThenInclude(p => p.Category)
                .Include(ci => ci.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(ci => ci.CartId == cartId)
                .ToListAsync();
        }
    }
}