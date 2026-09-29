using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface ICouponRepository
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<Coupon?> GetByIdAsync(Guid id);
        Task<Coupon?> GetByCodeAsync(string code);
        Task<IEnumerable<Coupon>> GetAllAsync();
        Task<(IEnumerable<Coupon> Coupons, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20);
        Task<Coupon> CreateAsync(Coupon coupon);
        Task<Coupon> UpdateAsync(Coupon coupon);
        Task<bool> DeleteAsync(Guid id);

        // ===================================
        // Validation
        // ===================================
        Task<bool> CodeExistsAsync(string code);
        Task<int> GetUserUsageCountAsync(Guid couponId, Guid userId);

        // ===================================
        // Usage
        // ===================================
        Task RecordUsageAsync(CouponUsage usage);
        Task IncrementUsageCountAsync(Guid couponId);
    }
}