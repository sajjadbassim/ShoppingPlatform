using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class ProductImageRepository : IProductImageRepository
    {
        private readonly AppDbContext _context;

        public ProductImageRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ProductImage>> GetByProductIdAsync(Guid productId)
        {
            return await _context.ProductImages
                .Where(i => i.ProductId == productId)
                .OrderBy(i => i.DisplayOrder)
                .ToListAsync();
        }

        public async Task<ProductImage> GetByIdAsync(Guid id)
        {
            return await _context.ProductImages.FindAsync(id);
        }

        public async Task<ProductImage> CreateAsync(ProductImage image)
        {
            await _context.ProductImages.AddAsync(image);
            await _context.SaveChangesAsync();
            return image;
        }

        public async Task<List<ProductImage>> CreateManyAsync(List<ProductImage> images)
        {
            await _context.ProductImages.AddRangeAsync(images);
            await _context.SaveChangesAsync();
            return images;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var image = await _context.ProductImages.FindAsync(id);
            if (image == null)
                return false;

            _context.ProductImages.Remove(image);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteByProductIdAsync(Guid productId)
        {
            var images = await _context.ProductImages
                .Where(i => i.ProductId == productId)
                .ToListAsync();

            if (images.Count == 0)
                return false;

            _context.ProductImages.RemoveRange(images);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> SetPrimaryImageAsync(Guid imageId, Guid productId)
        {
            // إزالة الصورة الرئيسية السابقة
            var currentPrimary = await _context.ProductImages
                .Where(i => i.ProductId == productId && i.IsPrimary)
                .ToListAsync();

            foreach (var img in currentPrimary)
            {
                img.IsPrimary = false;
            }

            // تعيين الصورة الجديدة كرئيسية
            var newPrimary = await _context.ProductImages.FindAsync(imageId);
            if (newPrimary == null || newPrimary.ProductId != productId)
                return false;

            newPrimary.IsPrimary = true;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
