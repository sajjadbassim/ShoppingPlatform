using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Promotion
{
    public class CreatePromotionDto
    {
        [Required(ErrorMessage = "اسم العرض مطلوب")]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(255)]
        public string? NameAr { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required(ErrorMessage = "نوع الهدف مطلوب")]
        public string TargetType { get; set; } // product | category | vendor | all

        public Guid? TargetId { get; set; } // مطلوب إذا لم يكن all

        [Required(ErrorMessage = "نوع الخصم مطلوب")]
        public string DiscountType { get; set; } // percentage | fixed

        [Required(ErrorMessage = "قيمة الخصم مطلوبة")]
        [Range(0.01, double.MaxValue)]
        public decimal DiscountValue { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MaxDiscountAmount { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
