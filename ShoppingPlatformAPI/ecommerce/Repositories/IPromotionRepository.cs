using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IPromotionRepository
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<Promotion?> GetByIdAsync(Guid id);
        Task<IEnumerable<Promotion>> GetAllAsync();
        Task<(IEnumerable<Promotion> Promotions, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            string? targetType = null,
            int pageNumber = 1,
            int pageSize = 20);
        Task<Promotion> CreateAsync(Promotion promotion);
        Task<Promotion> UpdateAsync(Promotion promotion);
        Task<bool> DeleteAsync(Guid id);

        // ===================================
        // جلب العروض النشطة
        // ===================================
        Task<IEnumerable<Promotion>> GetActivePromotionsAsync();

        // ===================================
        // جلب العرض المنطبق على منتج محدد
        // الأولوية: product > category > vendor > all
        // ===================================
        Task<Promotion?> GetBestPromotionForProductAsync(
            Guid productId,
            Guid categoryId,
            Guid vendorId);
    }
}