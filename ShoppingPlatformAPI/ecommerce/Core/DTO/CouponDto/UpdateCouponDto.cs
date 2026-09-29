using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.CouponDto
{
    public class UpdateCouponDto
    {
        [MaxLength(255)]
        public string? Description { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? DiscountValue { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MinOrderAmount { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MaxDiscountAmount { get; set; }

        [Range(1, int.MaxValue)]
        public int? UsageLimit { get; set; }

        [Range(1, int.MaxValue)]
        public int? UserUsageLimit { get; set; }

        public bool? IsActive { get; set; }

        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
