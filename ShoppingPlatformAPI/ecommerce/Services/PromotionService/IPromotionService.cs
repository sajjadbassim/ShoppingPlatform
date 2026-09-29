using ecommerce.Core.DTO.Promotion;

namespace ecommerce.Services
{
    public interface IPromotionService
    {
        // ===================================
        // للعميل / عام
        // ===================================
        Task<IEnumerable<PromotionDto>> GetActiveAsync();
        Task<ProductPromotionDto> GetProductPriceAsync(Guid productId);

        // ===================================
        // Admin
        // ===================================
        Task<PromotionDto> GetByIdAsync(Guid id);
        Task<IEnumerable<PromotionDto>> GetAllAsync();
        Task<(IEnumerable<PromotionDto> Promotions, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            string? targetType = null,
            int pageNumber = 1,
            int pageSize = 20);
        Task<PromotionDto> CreateAsync(CreatePromotionDto dto);
        Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto);
        Task<bool> DeleteAsync(Guid id);

        // ===================================
        // Helper - يُستخدم من ProductService
        // لحساب السعر الفعلي عند جلب المنتجات
        // ===================================
        Task<decimal> CalculateFinalPriceAsync(Guid productId, Guid categoryId, Guid vendorId, decimal originalPrice);
    }
}
