using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class PromotionRepository : IPromotionRepository
    {
        private readonly AppDbContext _context;

        public PromotionRepository(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<Promotion?> GetByIdAsync(Guid id)
        {
            return await _context.Promotions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<Promotion>> GetAllAsync()
        {
            return await _context.Promotions
                .OrderByDescending(p => p.CreatedAt)
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // GetPagedAsync
        // ===================================
        public async Task<(IEnumerable<Promotion> Promotions, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            string? targetType = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Promotions.AsQueryable();

            if (isActive.HasValue)
                query = query.Where(p => p.IsActive == isActive.Value);

            if (!string.IsNullOrWhiteSpace(targetType))
                query = query.Where(p => p.TargetType == targetType);

            query = query.OrderByDescending(p => p.CreatedAt);

            var totalCount = await query.CountAsync();

            var promotions = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return (promotions, totalCount);
        }

        // ===================================
        // GetActivePromotionsAsync
        // ===================================
        public async Task<IEnumerable<Promotion>> GetActivePromotionsAsync()
        {
            var now = DateTime.UtcNow;

            return await _context.Promotions
                .Where(p =>
                    p.IsActive &&
                    (p.StartsAt == null || p.StartsAt <= now) &&
                    (p.ExpiresAt == null || p.ExpiresAt >= now))
                .OrderByDescending(p => p.CreatedAt)
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // GetBestPromotionForProductAsync
        // الأولوية: product > category > vendor > all
        // ===================================
        public async Task<Promotion?> GetBestPromotionForProductAsync(
            Guid productId,
            Guid categoryId,
            Guid vendorId)
        {
            var now = DateTime.UtcNow;

            var activePromotions = await _context.Promotions
                .Where(p =>
                    p.IsActive &&
                    (p.StartsAt == null || p.StartsAt <= now) &&
                    (p.ExpiresAt == null || p.ExpiresAt >= now) &&
                    (
                        (p.TargetType == PromotionTargetType.PRODUCT && p.TargetId == productId) ||
                        (p.TargetType == PromotionTargetType.CATEGORY && p.TargetId == categoryId) ||
                        (p.TargetType == PromotionTargetType.VENDOR && p.TargetId == vendorId) ||
                        (p.TargetType == PromotionTargetType.ALL)
                    ))
                .AsNoTracking()
                .ToListAsync();

            // نفس قاعدة الاختيار المستخدمة في قوائم المنتجات
            return PromotionPricing.SelectBest(
                activePromotions, productId,
                categoryId == Guid.Empty ? null : categoryId, vendorId);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<Promotion> CreateAsync(Promotion promotion)
        {
            promotion.CreatedAt = DateTime.UtcNow;
            promotion.UpdatedAt = DateTime.UtcNow;

            await _context.Promotions.AddAsync(promotion);
            await _context.SaveChangesAsync();
            return promotion;
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<Promotion> UpdateAsync(Promotion promotion)
        {
            promotion.UpdatedAt = DateTime.UtcNow;
            _context.Promotions.Update(promotion);
            await _context.SaveChangesAsync();
            return promotion;
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var promotion = await _context.Promotions.FindAsync(id);
            if (promotion == null)
                return false;

            _context.Promotions.Remove(promotion);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}