using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("promotions")]
    public class Promotion
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(255)]
        [Column("name")]
        public string Name { get; set; } // مثل: "تخفيضات الصيف"

        [MaxLength(255)]
        [Column("name_ar")]
        public string? NameAr { get; set; }

        [MaxLength(500)]
        [Column("description")]
        public string? Description { get; set; }

        // ===================================
        // نوع العرض: على منتج / تصنيف / بائع
        // ===================================
        [Required]
        [MaxLength(20)]
        [Column("target_type")]
        public string TargetType { get; set; } // product | category | vendor | all

        [Column("target_id")]
        public Guid? TargetId { get; set; } // ID المنتج أو التصنيف أو البائع

        // ===================================
        // نوع الخصم
        // ===================================
        [Required]
        [MaxLength(20)]
        [Column("discount_type")]
        public string DiscountType { get; set; } // percentage | fixed

        [Required]
        [Column("discount_value", TypeName = "decimal(10,2)")]
        public decimal DiscountValue { get; set; }

        // سقف الخصم عند النسبة المئوية
        [Column("max_discount_amount", TypeName = "decimal(10,2)")]
        public decimal? MaxDiscountAmount { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("starts_at")]
        public DateTime? StartsAt { get; set; }

        [Column("expires_at")]
        public DateTime? ExpiresAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}