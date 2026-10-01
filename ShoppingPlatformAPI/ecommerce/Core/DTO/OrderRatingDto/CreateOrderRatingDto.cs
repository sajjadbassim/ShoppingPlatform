using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.OrderRating
{
    // ===================================
    // Request — إرسال التقييم
    // ===================================
    public class CreateOrderRatingDto
    {
        [Required(ErrorMessage = "تقييم التوصيل مطلوب")]
        [Range(1, 5, ErrorMessage = "التقييم يجب أن يكون بين 1 و 5")]
        public int DeliveryRating { get; set; }

        [MaxLength(1000)]
        public string? DeliveryComment { get; set; }

        [Range(1, 5)]
        public int? SpeedRating { get; set; }

        [Range(1, 5)]
        public int? PackagingRating { get; set; }

        public bool? WouldRecommend { get; set; }

        // تقييم كل متجر
        public List<CreateSubOrderRatingDto> SubOrderRatings { get; set; } = new();

        // تقييم كل سائق (مرة واحدة لكل سائق)
        public List<DriverRatingInputDto> DriverRatings { get; set; } = new();
    }

    public class DriverRatingInputDto
    {
        [Required]
        public Guid DriverId { get; set; }

        [Range(1, 5, ErrorMessage = "تقييم السائق يجب أن يكون بين 1 و 5")]
        public int Rating { get; set; }
    }

    // تقييم المتاجر وحدها (مستقل عن تقييم التجربة)
    public class CreateStoreRatingsDto
    {
        public List<CreateSubOrderRatingDto> SubOrderRatings { get; set; } = new();
        public List<DriverRatingInputDto> DriverRatings { get; set; } = new();
    }

    // ما قيّمه الزبون حتى الآن في هذا الطلب
    public class OrderRatingStatusDto
    {
        public bool HasRated { get; set; }                  // تقييم التجربة (التوصيل)
        public List<Guid> RatedSubOrderIds { get; set; } = new();
        public List<Guid> RatedDriverIds { get; set; } = new();
    }

    public class CreateSubOrderRatingDto
    {
        [Required]
        public Guid SubOrderId { get; set; }

        [Required]
        [Range(1, 5, ErrorMessage = "تقييم المتجر يجب أن يكون بين 1 و 5")]
        public int VendorRating { get; set; }

        [MaxLength(1000)]
        public string? VendorComment { get; set; }

        [Range(1, 5)]
        public int? DriverRating { get; set; }
    }

    // ===================================
    // Response — عرض التقييم
    // ===================================
    public class OrderRatingDto
    {
        public Guid Id { get; set; }
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }
        public string CustomerName { get; set; }

        public int? DeliveryRating { get; set; }
        public string? DeliveryComment { get; set; }
        public int? SpeedRating { get; set; }
        public int? PackagingRating { get; set; }
        public bool? WouldRecommend { get; set; }

        // متوسط التقييم الكلي
        public double OverallAverage { get; set; }

        public List<SubOrderRatingDto> SubOrderRatings { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }

    public class SubOrderRatingDto
    {
        public Guid Id { get; set; }
        public Guid SubOrderId { get; set; }
        public string SubOrderNumber { get; set; }
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }

        public int VendorRating { get; set; }
        public string? VendorComment { get; set; }
        public int? DriverRating { get; set; }
        public string? DriverName { get; set; }
    }

    // ===================================
    // Admin — إحصائيات التقييمات
    // ===================================
    public class RatingStatsDto
    {
        public double AverageDeliveryRating { get; set; }
        public double AverageSpeedRating { get; set; }
        public double AveragePackagingRating { get; set; }
        public double AverageVendorRating { get; set; }
        public double AverageDriverRating { get; set; }
        public int TotalRatings { get; set; }
        public int RecommendCount { get; set; }
        public double RecommendPercentage { get; set; }

        // توزيع التقييمات (1-5)
        public Dictionary<int, int> DeliveryRatingDistribution { get; set; } = new();
    }

    public class VendorRatingStatsDto
    {
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public double AverageRating { get; set; }
        public int TotalRatings { get; set; }
        public Dictionary<int, int> Distribution { get; set; } = new();
    }

    public class DriverRatingStatsDto
    {
        public Guid DriverId { get; set; }
        public string DriverName { get; set; }
        public double AverageRating { get; set; }
        public int TotalRatings { get; set; }
    }
}