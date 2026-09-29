using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Promotion
{
    public class UpdatePromotionDto
    {
        [MaxLength(255)]
        public string? Name { get; set; }

        [MaxLength(255)]
        public string? NameAr { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? DiscountValue { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MaxDiscountAmount { get; set; }

        public bool? IsActive { get; set; }

        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
