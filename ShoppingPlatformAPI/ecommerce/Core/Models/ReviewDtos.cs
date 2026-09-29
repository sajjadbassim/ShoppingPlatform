using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Review
{
    // ===================================
    // Create DTO
    // ===================================
    public class CreateReviewDto
    {
        [Required(ErrorMessage = "المنتج مطلوب")]
        public Guid ProductId { get; set; }

        [Required(ErrorMessage = "رقم الطلب مطلوب للتحقق من الشراء")]
        public Guid OrderId { get; set; }

        [Required(ErrorMessage = "التقييم مطلوب")]
        [Range(1, 5, ErrorMessage = "التقييم يجب أن يكون بين 1 و 5")]
        public int Rating { get; set; }

        [MaxLength(200, ErrorMessage = "العنوان لا يتجاوز 200 حرف")]
        public string? Title { get; set; }

        [MaxLength(2000, ErrorMessage = "نص المراجعة لا يتجاوز 2000 حرف")]
        public string? Body { get; set; }

        public List<IFormFile>? Images { get; set; }
    }

    // ===================================
    // Update DTO
    // ===================================
    public class UpdateReviewDto
    {
        [Range(1, 5, ErrorMessage = "التقييم يجب أن يكون بين 1 و 5")]
        public int? Rating { get; set; }

        [MaxLength(200, ErrorMessage = "العنوان لا يتجاوز 200 حرف")]
        public string? Title { get; set; }

        [MaxLength(2000, ErrorMessage = "نص المراجعة لا يتجاوز 2000 حرف")]
        public string? Body { get; set; }

        public List<IFormFile>? NewImages { get; set; }

        public List<Guid>? DeleteImageIds { get; set; } // معرفات الصور المراد حذفها
    }

    // ===================================
    // Report DTO
    // ===================================
    public class ReportReviewDto
    {
        [Required(ErrorMessage = "سبب الإبلاغ مطلوب")]
        public string Reason { get; set; } // spam | offensive | fake | irrelevant

        [MaxLength(500, ErrorMessage = "التفاصيل لا تتجاوز 500 حرف")]
        public string? Details { get; set; }
    }

    // ===================================
    // Query DTO (للفلترة والبحث)
    // ===================================
    public class ReviewQueryDto
    {
        public Guid? ProductId { get; set; }
        public Guid? VendorId { get; set; }

        [Range(1, 5)]
        public int? Rating { get; set; }

        public bool? VerifiedOnly { get; set; }
        public bool? WithImagesOnly { get; set; }

        // newest | oldest | highest | lowest | helpful
        public string SortBy { get; set; } = "newest";

        [Range(1, int.MaxValue, ErrorMessage = "رقم الصفحة يجب أن يكون أكبر من 0")]
        public int PageNumber { get; set; } = 1;

        [Range(1, 100, ErrorMessage = "حجم الصفحة يجب أن يكون بين 1 و 100")]
        public int PageSize { get; set; } = 20;
    }

    // ===================================
    // Response DTOs
    // ===================================
    public class ReviewDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public Guid UserId { get; set; }
        public string UserFullName { get; set; }
        public string? UserAvatarUrl { get; set; }
        public int Rating { get; set; }
        public string? Title { get; set; }
        public string? Body { get; set; }
        public int HelpfulCount { get; set; }
        public bool IsVerifiedPurchase { get; set; }
        public bool IsCurrentUserVotedHelpful { get; set; }
        public string? VendorReply { get; set; }
        public DateTime? VendorReplyAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public string? ProductName { get; set; }
        public string? ProductNameAr { get; set; }
        public List<ReviewImageDto> Images { get; set; } = new List<ReviewImageDto>();
    }

    public class ReviewImageDto
    {
        public Guid Id { get; set; }
        public string ImageUrl { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class ReviewSummaryDto
    {
        public double AverageRating { get; set; }
        public int TotalReviews { get; set; }
        public int TotalWithImages { get; set; }
        public int TotalVerified { get; set; }

        // توزيع النجوم 1-5
        public Dictionary<int, int> Distribution { get; set; } = new()
        {
            { 5, 0 }, { 4, 0 }, { 3, 0 }, { 2, 0 }, { 1, 0 }
        };
    }
}