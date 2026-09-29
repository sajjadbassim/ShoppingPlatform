using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class CouponRepository : ICouponRepository
    {
        private readonly AppDbContext _context;

        public CouponRepository(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<Coupon?> GetByIdAsync(Guid id)
        {
            return await _context.Coupons
                .Include(c => c.Vendor)
                .Include(c => c.Category)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        // ===================================
        // GetByCodeAsync
        // ===================================
        public async Task<Coupon?> GetByCodeAsync(string code)
        {
            return await _context.Coupons
                .Include(c => c.Vendor)
                .Include(c => c.Category)
                .FirstOrDefaultAsync(c => c.Code.ToUpper() == code.ToUpper());
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<Coupon>> GetAllAsync()
        {
            return await _context.Coupons
                .Include(c => c.Vendor)
                .Include(c => c.Category)
                .OrderByDescending(c => c.CreatedAt)
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // GetPagedAsync
        // ===================================
        public async Task<(IEnumerable<Coupon> Coupons, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Coupons
                .Include(c => c.Vendor)
                .Include(c => c.Category)
                .AsQueryable();

            if (isActive.HasValue)
                query = query.Where(c => c.IsActive == isActive.Value);

            query = query.OrderByDescending(c => c.CreatedAt);

            var totalCount = await query.CountAsync();

            var coupons = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return (coupons, totalCount);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<Coupon> CreateAsync(Coupon coupon)
        {
            coupon.CreatedAt = DateTime.UtcNow;
            coupon.UpdatedAt = DateTime.UtcNow;

            await _context.Coupons.AddAsync(coupon);
            await _context.SaveChangesAsync();
            return coupon;
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<Coupon> UpdateAsync(Coupon coupon)
        {
            coupon.UpdatedAt = DateTime.UtcNow;
            _context.Coupons.Update(coupon);
            await _context.SaveChangesAsync();
            return coupon;
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var coupon = await _context.Coupons.FindAsync(id);
            if (coupon == null)
                return false;

            _context.Coupons.Remove(coupon);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // CodeExistsAsync
        // ===================================
        public async Task<bool> CodeExistsAsync(string code)
        {
            return await _context.Coupons
                .AnyAsync(c => c.Code.ToUpper() == code.ToUpper());
        }

        // ===================================
        // GetUserUsageCountAsync
        // ===================================
        public async Task<int> GetUserUsageCountAsync(Guid couponId, Guid userId)
        {
            return await _context.CouponUsages
                .CountAsync(u => u.CouponId == couponId && u.UserId == userId);
        }

        // ===================================
        // RecordUsageAsync
        // ===================================
        public async Task RecordUsageAsync(CouponUsage usage)
        {
            await _context.CouponUsages.AddAsync(usage);
            await _context.SaveChangesAsync();
        }

        // ===================================
        // IncrementUsageCountAsync
        // ===================================
        public async Task IncrementUsageCountAsync(Guid couponId)
        {
            await _context.Coupons
                .Where(c => c.Id == couponId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsageCount, c => c.UsageCount + 1));
        }
    }
}