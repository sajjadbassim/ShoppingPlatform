using ecommerce.Core.DTO.Review;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class ReviewRepository : IReviewRepository
    {
        private readonly AppDbContext _context;

        public ReviewRepository(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<Review?> GetByIdAsync(Guid id)
        {
            return await _context.Reviews.FindAsync(id);
        }

        // ===================================
        // GetByIdWithDetailsAsync
        // ===================================
        public async Task<Review?> GetByIdWithDetailsAsync(Guid id)
        {
            return await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        // ===================================
        // GetByProductAsync
        // ===================================
        public async Task<IEnumerable<Review>> GetByProductAsync(Guid productId)
        {
            return await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .Where(r => r.ProductId == productId && r.IsApproved)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetByUserAsync
        // ===================================
        public async Task<IEnumerable<Review>> GetByUserAsync(Guid userId)
        {
            return await _context.Reviews
                .Include(r => r.Product)
                .Include(r => r.Images)
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetFilteredAsync - بحث وفلتر مرن
        // ===================================
        public async Task<(IEnumerable<Review> Reviews, int TotalCount)> GetFilteredAsync(
            Guid? productId = null,
            Guid? vendorId = null,
            int? rating = null,
            bool? verifiedOnly = null,
            bool? withImagesOnly = null,
            string sortBy = "newest",
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Reviews
                .Include(r => r.Product)  // ✅ أضف هذا
                .Include(r => r.User)
                .Include(r => r.Images)
                .Where(r => r.IsApproved)
                .AsQueryable();

            // ===================================
            // 1. فلتر المنتج
            // ===================================
            if (productId.HasValue && productId.Value != Guid.Empty)
                query = query.Where(r => r.ProductId == productId.Value);

            // ===================================
            // 2. فلتر البائع
            // ===================================
            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(r => r.Product.VendorId == vendorId.Value);

            // ===================================
            // 3. فلتر التقييم
            // ===================================
            if (rating.HasValue)
                query = query.Where(r => r.Rating == rating.Value);

            // ===================================
            // 4. فلتر الشراء الموثق فقط
            // ===================================
            if (verifiedOnly == true)
                query = query.Where(r => r.IsVerifiedPurchase);

            // ===================================
            // 5. فلتر المراجعات التي تحتوي صور فقط
            // ===================================
            if (withImagesOnly == true)
                query = query.Where(r => r.Images.Any());

            // ===================================
            // 6. الترتيب
            // ===================================
            query = sortBy switch
            {
                "oldest" => query.OrderBy(r => r.CreatedAt),
                "highest" => query.OrderByDescending(r => r.Rating),
                "lowest" => query.OrderBy(r => r.Rating),
                "helpful" => query.OrderByDescending(r => r.HelpfulCount),
                _ => query.OrderByDescending(r => r.CreatedAt) // newest
            };

            var totalCount = await query.CountAsync();

            var reviews = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return (reviews, totalCount);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<Review> CreateAsync(Review review)
        {
            review.CreatedAt = DateTime.UtcNow;
            await _context.Reviews.AddAsync(review);
            await _context.SaveChangesAsync();
            return review;
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<Review> UpdateAsync(Review review)
        {
            review.UpdatedAt = DateTime.UtcNow;
            _context.Reviews.Update(review);
            await _context.SaveChangesAsync();
            return review;
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null)
                return false;

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // Validation
        // ===================================
        public async Task<bool> HasUserReviewedProductAsync(Guid userId, Guid productId)
        {
            return await _context.Reviews
                .AnyAsync(r => r.UserId == userId && r.ProductId == productId);
        }

        public async Task<bool> HasUserPurchasedProductAsync(Guid userId, Guid productId, Guid orderId)
        {
            return await _context.SubOrderItems
                .AnyAsync(i =>
                    i.SubOrder.Order.Id == orderId &&
                    i.SubOrder.Order.CustomerId == userId &&
                    i.ProductId == productId &&
                    i.SubOrder.Order.Status == "DELIVERED");
        }

        // ===================================
        // Summary
        // ===================================
        public async Task<ReviewSummaryDto> GetProductSummaryAsync(Guid productId)
        {
            var reviews = await _context.Reviews
                .Include(r => r.Images)
                .Where(r => r.ProductId == productId && r.IsApproved)
                .AsNoTracking()
                .ToListAsync();

            return BuildSummary(reviews);
        }

        public async Task<ReviewSummaryDto> GetVendorSummaryAsync(Guid vendorId)
        {
            var reviews = await _context.Reviews
                .Include(r => r.Images)
                .Where(r => r.Product.VendorId == vendorId && r.IsApproved)
                .AsNoTracking()
                .ToListAsync();

            return BuildSummary(reviews);
        }

        // ===================================
        // Helpful
        // ===================================
        public async Task<bool> HasUserVotedHelpfulAsync(Guid userId, Guid reviewId)
        {
            return await _context.ReviewHelpfuls
                .AnyAsync(h => h.UserId == userId && h.ReviewId == reviewId);
        }

        public async Task<bool> AddHelpfulVoteAsync(Guid userId, Guid reviewId)
        {
            var vote = new ReviewHelpful
            {
                UserId = userId,
                ReviewId = reviewId
            };

            await _context.ReviewHelpfuls.AddAsync(vote);

            // تحديث العداد مباشرة بدون تحميل الكائن كاملاً
            await _context.Reviews
                .Where(r => r.Id == reviewId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.HelpfulCount, r => r.HelpfulCount + 1));

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveHelpfulVoteAsync(Guid userId, Guid reviewId)
        {
            var vote = await _context.ReviewHelpfuls
                .FirstOrDefaultAsync(h => h.UserId == userId && h.ReviewId == reviewId);

            if (vote == null)
                return false;

            _context.ReviewHelpfuls.Remove(vote);

            await _context.Reviews
                .Where(r => r.Id == reviewId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.HelpfulCount, r => r.HelpfulCount - 1));

            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // Report
        // ===================================
        public async Task<bool> HasUserReportedAsync(Guid userId, Guid reviewId)
        {
            return await _context.ReviewReports
                .AnyAsync(r => r.UserId == userId && r.ReviewId == reviewId);
        }

        public async Task AddReportAsync(ReviewReport report)
        {
            await _context.ReviewReports.AddAsync(report);
            await _context.SaveChangesAsync();

            // إذا تجاوزت التقارير 3 → أخفِ المراجعة تلقائياً حتى مراجعة الـ Admin
            var reportsCount = await _context.ReviewReports
                .CountAsync(r => r.ReviewId == report.ReviewId);

            if (reportsCount >= 3)
            {
                await _context.Reviews
                    .Where(r => r.Id == report.ReviewId)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsApproved, false));
            }
        }

        // ===================================
        // Images
        // ===================================
        public async Task AddImagesAsync(List<ReviewImage> images)
        {
            await _context.ReviewImages.AddRangeAsync(images);
            await _context.SaveChangesAsync();
        }

        public async Task<ReviewImage?> GetImageByIdAsync(Guid imageId)
        {
            return await _context.ReviewImages.FindAsync(imageId);
        }

        public async Task<bool> DeleteImageAsync(Guid imageId)
        {
            var image = await _context.ReviewImages.FindAsync(imageId);
            if (image == null)
                return false;

            _context.ReviewImages.Remove(image);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // Admin
        // ===================================
        public async Task<(IEnumerable<Review> Reviews, int TotalCount)> GetReportedReviewsAsync(
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Images)
                .Include(r => r.Reports)
                .Where(r => !r.IsApproved)
                .OrderByDescending(r => r.Reports.Count)
                .AsQueryable();

            var totalCount = await query.CountAsync();

            var reviews = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return (reviews, totalCount);
        }

        public async Task<bool> ApproveReviewAsync(Guid reviewId)
        {
            var review = await _context.Reviews.FindAsync(reviewId);
            if (review == null)
                return false;

            // الموافقة على المراجعة
            await _context.Reviews
                .Where(r => r.Id == reviewId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsApproved, true));

            // مسح جميع التقارير المرتبطة بها
            await _context.ReviewReports
                .Where(r => r.ReviewId == reviewId)
                .ExecuteDeleteAsync();

            return true;
        }

        // ===================================
        // Private Helper
        // ===================================
        private static ReviewSummaryDto BuildSummary(List<Review> reviews)
        {
            if (!reviews.Any())
                return new ReviewSummaryDto();

            var distribution = reviews
                .GroupBy(r => r.Rating)
                .ToDictionary(g => g.Key, g => g.Count());

            return new ReviewSummaryDto
            {
                AverageRating = Math.Round(reviews.Average(r => r.Rating), 1),
                TotalReviews = reviews.Count,
                TotalWithImages = reviews.Count(r => r.Images.Any()),
                TotalVerified = reviews.Count(r => r.IsVerifiedPurchase),
                Distribution = new Dictionary<int, int>
                {
                    { 5, distribution.GetValueOrDefault(5) },
                    { 4, distribution.GetValueOrDefault(4) },
                    { 3, distribution.GetValueOrDefault(3) },
                    { 2, distribution.GetValueOrDefault(2) },
                    { 1, distribution.GetValueOrDefault(1) }
                }
            };
        }
    }
}