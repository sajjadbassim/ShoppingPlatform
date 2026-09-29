using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.CouponDto
{
    public class CreateCouponDto
    {
        [Required(ErrorMessage = "كود الكوبون مطلوب")]
        [MaxLength(50)]
        public string Code { get; set; }

        [MaxLength(255)]
        public string? Description { get; set; }

        [Required(ErrorMessage = "نوع الخصم مطلوب")]
        public string DiscountType { get; set; } // percentage | fixed

        [Required(ErrorMessage = "قيمة الخصم مطلوبة")]
        [Range(0.01, double.MaxValue, ErrorMessage = "قيمة الخصم يجب أن تكون أكبر من 0")]
        public decimal DiscountValue { get; set; }

        [Range(0, double.MaxValue)]
        public decimal MinOrderAmount { get; set; } = 0;

        [Range(0, double.MaxValue)]
        public decimal? MaxDiscountAmount { get; set; }

        [Range(1, int.MaxValue)]
        public int? UsageLimit { get; set; }

        [Range(1, int.MaxValue)]
        public int UserUsageLimit { get; set; } = 1;

        public Guid? VendorId { get; set; }
        public Guid? CategoryId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
