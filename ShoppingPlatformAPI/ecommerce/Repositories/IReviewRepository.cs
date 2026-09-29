using ecommerce.Core.DTO.Review;
using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IReviewRepository
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<Review?> GetByIdAsync(Guid id);
        Task<Review?> GetByIdWithDetailsAsync(Guid id);
        Task<Review> CreateAsync(Review review);
        Task<Review> UpdateAsync(Review review);
        Task<bool> DeleteAsync(Guid id);

        // ===================================
        // جلب وفلترة
        // ===================================
        Task<IEnumerable<Review>> GetByProductAsync(Guid productId);
        Task<IEnumerable<Review>> GetByUserAsync(Guid userId);
        Task<(IEnumerable<Review> Reviews, int TotalCount)> GetFilteredAsync(
            Guid? productId = null,
            Guid? vendorId = null,
            int? rating = null,
            bool? verifiedOnly = null,
            bool? withImagesOnly = null,
            string sortBy = "newest",
            int pageNumber = 1,
            int pageSize = 20);

        // ===================================
        // Validation
        // ===================================
        Task<bool> HasUserReviewedProductAsync(Guid userId, Guid productId);
        Task<bool> HasUserPurchasedProductAsync(Guid userId, Guid productId, Guid orderId);

        // ===================================
        // Summary (ملخص التقييمات)
        // ===================================
        Task<ReviewSummaryDto> GetProductSummaryAsync(Guid productId);
        Task<ReviewSummaryDto> GetVendorSummaryAsync(Guid vendorId);

        // ===================================
        // Helpful (مفيدة)
        // ===================================
        Task<bool> HasUserVotedHelpfulAsync(Guid userId, Guid reviewId);
        Task<bool> AddHelpfulVoteAsync(Guid userId, Guid reviewId);
        Task<bool> RemoveHelpfulVoteAsync(Guid userId, Guid reviewId);

        // ===================================
        // Report (الإبلاغ)
        // ===================================
        Task<bool> HasUserReportedAsync(Guid userId, Guid reviewId);
        Task AddReportAsync(ReviewReport report);

        // ===================================
        // Images (الصور)
        // ===================================
        Task AddImagesAsync(List<ReviewImage> images);
        Task<ReviewImage?> GetImageByIdAsync(Guid imageId);
        Task<bool> DeleteImageAsync(Guid imageId);

        // ===================================
        // Admin
        // ===================================
        Task<(IEnumerable<Review> Reviews, int TotalCount)> GetReportedReviewsAsync(
            int pageNumber = 1,
            int pageSize = 20);
        Task<bool> ApproveReviewAsync(Guid reviewId);
    }
}