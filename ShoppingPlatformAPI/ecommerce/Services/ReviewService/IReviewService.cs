using ecommerce.Core.DTO.Review;

namespace ecommerce.Services
{
    public interface IReviewService
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<ReviewDto> GetByIdAsync(Guid id);
        Task<ReviewDto> CreateAsync(Guid userId, CreateReviewDto dto);
        Task<ReviewDto> UpdateAsync(Guid userId, Guid reviewId, UpdateReviewDto dto);
        Task<bool> DeleteAsync(Guid userId, Guid reviewId, bool isAdmin = false);

        // ===================================
        // جلب وفلترة
        // ===================================
        Task<(IEnumerable<ReviewDto> Reviews, int TotalCount)> GetFilteredAsync(
            ReviewQueryDto query,
            Guid? currentUserId = null);

        // ===================================
        // Summary (ملخص التقييمات)
        // ===================================
        Task<ReviewSummaryDto> GetProductSummaryAsync(Guid productId);
        Task<ReviewSummaryDto> GetVendorSummaryAsync(Guid vendorId);

        // ===================================
        // Helpful (مفيدة)
        // ===================================
        Task<bool> AddHelpfulVoteAsync(Guid userId, Guid reviewId);
        Task<bool> RemoveHelpfulVoteAsync(Guid userId, Guid reviewId);

        // ===================================
        // Report (الإبلاغ)
        // ===================================
        Task<bool> ReportAsync(Guid userId, Guid reviewId, ReportReviewDto dto);
    }
}