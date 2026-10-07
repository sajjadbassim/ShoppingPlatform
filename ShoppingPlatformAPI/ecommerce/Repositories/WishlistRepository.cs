using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class WishlistRepository : IWishlistRepository
    {
        private readonly AppDbContext _context;

        public WishlistRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Wishlist> GetByIdAsync(Guid id)
        {
            return await _context.Wishlists
                .Include(w => w.Product)
                    .ThenInclude(p => p.Images)
                .Include(w => w.Product.Vendor)
                .FirstOrDefaultAsync(w => w.Id == id);
        }

        public async Task<IEnumerable<Wishlist>> GetByUserIdAsync(Guid userId)
        {
            return await _context.Wishlists
                .Include(w => w.Product)
                    .ThenInclude(p => p.Images)
                .Include(w => w.Product.Vendor)
                .Include(w => w.Product.Category)
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.CreatedAt)
                .ToListAsync();
        }

        public async Task<Wishlist> GetByUserAndProductAsync(Guid userId, Guid productId)
        {
            return await _context.Wishlists
                .FirstOrDefaultAsync(w => w.UserId == userId && w.ProductId == productId);
        }

        public async Task<bool> ExistsAsync(Guid userId, Guid productId)
        {
            return await _context.Wishlists
                .AnyAsync(w => w.UserId == userId && w.ProductId == productId);
        }

        public async Task<Wishlist> CreateAsync(Wishlist wishlist)
        {
            wishlist.CreatedAt = DateTime.UtcNow;
            await _context.Wishlists.AddAsync(wishlist);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(wishlist.Id);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var wishlist = await _context.Wishlists.FindAsync(id);
            if (wishlist == null)
                return false;

            _context.Wishlists.Remove(wishlist);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteByUserAndProductAsync(Guid userId, Guid productId)
        {
            var wishlist = await GetByUserAndProductAsync(userId, productId);
            if (wishlist == null)
                return false;

            _context.Wishlists.Remove(wishlist);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> GetCountByUserAsync(Guid userId)
        {
            return await _context.Wishlists.CountAsync(w => w.UserId == userId);
        }

        public async Task<bool> ClearUserWishlistAsync(Guid userId)
        {
            var items = await _context.Wishlists
                .Where(w => w.UserId == userId)
                .ToListAsync();

            if (!items.Any())
                return false;

            _context.Wishlists.RemoveRange(items);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}