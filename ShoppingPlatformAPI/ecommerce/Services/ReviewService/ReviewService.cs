using ecommerce.Core.DTO.Review;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;

namespace ecommerce.Services
{
    public class ReviewService : IReviewService
    {
        private readonly IReviewRepository _reviewRepository;
        private readonly IFileService _fileService;
        private readonly AppDbContext _context;
        private readonly INotificationService _notificationService;

        public ReviewService(
            IReviewRepository reviewRepository,
            IFileService fileService,
            AppDbContext context,
            INotificationService notificationService)
        {
            _reviewRepository = reviewRepository;
            _fileService = fileService;
            _context = context;
            _notificationService = notificationService;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<ReviewDto> GetByIdAsync(Guid id)
        {
            var review = await _reviewRepository.GetByIdWithDetailsAsync(id);
            if (review == null)
                throw new Exception("المراجعة غير موجودة");

            return MapToDto(review, false);
        }

        // ===================================
        // GetFilteredAsync
        // ===================================
        public async Task<(IEnumerable<ReviewDto> Reviews, int TotalCount)> GetFilteredAsync(
            ReviewQueryDto query,
            Guid? currentUserId = null)
        {
            var (reviews, totalCount) = await _reviewRepository.GetFilteredAsync(
                query.ProductId,
                query.VendorId,
                query.Rating,
                query.VerifiedOnly,
                query.WithImagesOnly,
                query.SortBy,
                query.PageNumber,
                query.PageSize
            );

            // جلب المراجعات التي صوّت عليها المستخدم الحالي بـ "مفيدة"
            var helpfulVotedIds = new List<Guid>();
            if (currentUserId.HasValue)
            {
                var reviewIds = reviews.Select(r => r.Id).ToList();
                helpfulVotedIds = _context.ReviewHelpfuls
                    .Where(h => h.UserId == currentUserId.Value && reviewIds.Contains(h.ReviewId))
                    .Select(h => h.ReviewId)
                    .ToList();
            }

            var dtos = reviews.Select(r => MapToDto(r, helpfulVotedIds.Contains(r.Id)));

            return (dtos, totalCount);
        }

        // ===================================
        // CreateAsync - مع Transaction للأمان
        // ===================================
        public async Task<ReviewDto> CreateAsync(Guid userId, CreateReviewDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1️⃣ التحقق أن المستخدم اشترى المنتج فعلاً
                var hasPurchased = await _reviewRepository.HasUserPurchasedProductAsync(
                    userId, dto.ProductId, dto.OrderId);

                if (!hasPurchased)
                    throw new Exception("يجب شراء المنتج أولاً قبل كتابة مراجعة");

                // 2️⃣ التحقق أنه لم يراجع المنتج من قبل
                var alreadyReviewed = await _reviewRepository.HasUserReviewedProductAsync(
                    userId, dto.ProductId);

                if (alreadyReviewed)
                    throw new Exception("لقد كتبت مراجعة لهذا المنتج مسبقاً");

                // 3️⃣ إنشاء المراجعة
                var review = new Review
                {
                    UserId = userId,
                    ProductId = dto.ProductId,
                    OrderId = dto.OrderId,
                    Rating = dto.Rating,
                    Title = dto.Title,
                    Body = dto.Body,
                    IsVerifiedPurchase = true
                };

                var created = await _reviewRepository.CreateAsync(review);

                // 4️⃣ رفع الصور إذا وجدت
                if (dto.Images != null && dto.Images.Count > 0)
                {
                    if (dto.Images.Count > 5)
                        throw new Exception("لا يمكن رفع أكثر من 5 صور للمراجعة");

                    List<string> uploadedImages = new List<string>();

                    try
                    {
                        uploadedImages = await _fileService.SaveImagesAsync(dto.Images);

                        var reviewImages = new List<ReviewImage>();
                        for (int i = 0; i < uploadedImages.Count; i++)
                        {
                            reviewImages.Add(new ReviewImage
                            {
                                ReviewId = created.Id,
                                ImageUrl = uploadedImages[i],
                                DisplayOrder = i
                            });
                        }

                        await _reviewRepository.AddImagesAsync(reviewImages);
                    }
                    catch (Exception ex)
                    {
                        await _fileService.DeleteImagesAsync(uploadedImages);
                        await transaction.RollbackAsync();
                        throw new Exception($"فشل رفع الصور: {ex.Message}");
                    }
                }

                await transaction.CommitAsync();

                await _notificationService.NotifyNewReviewAsync(dto.ProductId, created.Id, dto.Rating);

                return await GetByIdAsync(created.Id);
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<ReviewDto> UpdateAsync(Guid userId, Guid reviewId, UpdateReviewDto dto)
        {
            var review = await _reviewRepository.GetByIdWithDetailsAsync(reviewId);
            if (review == null)
                throw new Exception("المراجعة غير موجودة");

            if (review.UserId != userId)
                throw new UnauthorizedAccessException("ليس لديك صلاحية تعديل هذه المراجعة");

            // تحديث الحقول
            if (dto.Rating.HasValue)
                review.Rating = dto.Rating.Value;

            if (!string.IsNullOrWhiteSpace(dto.Title))
                review.Title = dto.Title;

            if (!string.IsNullOrWhiteSpace(dto.Body))
                review.Body = dto.Body;

            // حذف صور محددة
            if (dto.DeleteImageIds != null && dto.DeleteImageIds.Count > 0)
            {
                foreach (var imageId in dto.DeleteImageIds)
                {
                    var image = await _reviewRepository.GetImageByIdAsync(imageId);
                    if (image != null && image.ReviewId == reviewId)
                    {
                        await _fileService.DeleteImageAsync(image.ImageUrl);
                        await _reviewRepository.DeleteImageAsync(imageId);
                    }
                }
            }

            // إضافة صور جديدة
            if (dto.NewImages != null && dto.NewImages.Count > 0)
            {
                var currentImagesCount = review.Images?.Count ?? 0;
                if (currentImagesCount + dto.NewImages.Count > 5)
                    throw new Exception("لا يمكن أن تحتوي المراجعة على أكثر من 5 صور");

                var imageUrls = await _fileService.SaveImagesAsync(dto.NewImages);
                var currentMaxOrder = review.Images?.Any() == true
                    ? review.Images.Max(i => i.DisplayOrder)
                    : -1;

                var reviewImages = new List<ReviewImage>();
                for (int i = 0; i < imageUrls.Count; i++)
                {
                    reviewImages.Add(new ReviewImage
                    {
                        ReviewId = reviewId,
                        ImageUrl = imageUrls[i],
                        DisplayOrder = currentMaxOrder + i + 1
                    });
                }

                await _reviewRepository.AddImagesAsync(reviewImages);
            }

            await _reviewRepository.UpdateAsync(review);
            return await GetByIdAsync(reviewId);
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid userId, Guid reviewId, bool isAdmin = false)
        {
            var review = await _reviewRepository.GetByIdWithDetailsAsync(reviewId);
            if (review == null)
                throw new Exception("المراجعة غير موجودة");

            if (!isAdmin && review.UserId != userId)
                throw new UnauthorizedAccessException("ليس لديك صلاحية حذف هذه المراجعة");

            // حذف الصور من الـ storage
            if (review.Images != null && review.Images.Count > 0)
            {
                var imageUrls = review.Images.Select(i => i.ImageUrl).ToList();
                await _fileService.DeleteImagesAsync(imageUrls);
            }

            return await _reviewRepository.DeleteAsync(reviewId);
        }

        // ===================================
        // GetProductSummaryAsync
        // ===================================
        public async Task<ReviewSummaryDto> GetProductSummaryAsync(Guid productId)
        {
            return await _reviewRepository.GetProductSummaryAsync(productId);
        }

        // ===================================
        // GetVendorSummaryAsync
        // ===================================
        public async Task<ReviewSummaryDto> GetVendorSummaryAsync(Guid vendorId)
        {
            return await _reviewRepository.GetVendorSummaryAsync(vendorId);
        }

        // ===================================
        // AddHelpfulVoteAsync
        // ===================================
        public async Task<bool> AddHelpfulVoteAsync(Guid userId, Guid reviewId)
        {
            var review = await _reviewRepository.GetByIdAsync(reviewId);
            if (review == null)
                throw new Exception("المراجعة غير موجودة");

            if (review.UserId == userId)
                throw new Exception("لا يمكنك التصويت على مراجعتك الخاصة");

            var alreadyVoted = await _reviewRepository.HasUserVotedHelpfulAsync(userId, reviewId);
            if (alreadyVoted)
                throw new Exception("لقد صوّت مسبقاً على هذه المراجعة");

            return await _reviewRepository.AddHelpfulVoteAsync(userId, reviewId);
        }

        // ===================================
        // RemoveHelpfulVoteAsync
        // ===================================
        public async Task<bool> RemoveHelpfulVoteAsync(Guid userId, Guid reviewId)
        {
            var hasVoted = await _reviewRepository.HasUserVotedHelpfulAsync(userId, reviewId);
            if (!hasVoted)
                throw new Exception("لم تصوّت على هذه المراجعة");

            return await _reviewRepository.RemoveHelpfulVoteAsync(userId, reviewId);
        }

        // ===================================
        // ReportAsync
        // ===================================
        public async Task<bool> ReportAsync(Guid userId, Guid reviewId, ReportReviewDto dto)
        {
            var review = await _reviewRepository.GetByIdAsync(reviewId);
            if (review == null)
                throw new Exception("المراجعة غير موجودة");

            if (review.UserId == userId)
                throw new Exception("لا يمكنك الإبلاغ عن مراجعتك الخاصة");

            var alreadyReported = await _reviewRepository.HasUserReportedAsync(userId, reviewId);
            if (alreadyReported)
                throw new Exception("لقد أبلغت عن هذه المراجعة مسبقاً");

            var validReasons = new[] { "spam", "offensive", "fake", "irrelevant" };
            if (!validReasons.Contains(dto.Reason.ToLower()))
                throw new Exception("سبب الإبلاغ غير صالح");

            var report = new ReviewReport
            {
                ReviewId = reviewId,
                UserId = userId,
                Reason = dto.Reason.ToLower(),
                Details = dto.Details
            };

            await _reviewRepository.AddReportAsync(report);
            return true;
        }

        // ===================================
        // Private Helper - MapToDto
        // ===================================
        private static ReviewDto MapToDto(Review review, bool isCurrentUserVotedHelpful)
        {
            return new ReviewDto
            {
                Id = review.Id,
                ProductId = review.ProductId,
                UserId = review.UserId,
                UserFullName = review.User?.FullName ?? string.Empty,
                UserAvatarUrl = null,
                Rating = review.Rating,
                Title = review.Title,
                Body = review.Body,
                HelpfulCount = review.HelpfulCount,
                IsVerifiedPurchase = review.IsVerifiedPurchase,
                IsCurrentUserVotedHelpful = isCurrentUserVotedHelpful,
                VendorReply = review.VendorReply,
                VendorReplyAt = review.VendorReplyAt,
                CreatedAt = review.CreatedAt,
                UpdatedAt = review.UpdatedAt,
                ProductName = review.Product?.Name,
                ProductNameAr = review.Product?.NameAr,
                Images = review.Images?.Select(i => new ReviewImageDto
                {
                    Id = i.Id,
                    ImageUrl = i.ImageUrl,
                    DisplayOrder = i.DisplayOrder
                }).ToList() ?? new List<ReviewImageDto>()
            };
        }
    }
}