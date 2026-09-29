using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("coupons")]
    public class Coupon
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        [Column("code")]
        public string Code { get; set; } // مثل: SUMMER25

        [MaxLength(255)]
        [Column("description")]
        public string? Description { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("discount_type")]
        public string DiscountType { get; set; } // percentage | fixed

        [Required]
        [Column("discount_value", TypeName = "decimal(10,2)")]
        public decimal DiscountValue { get; set; } // 25 (يعني 25% أو 25 دينار)

        [Column("min_order_amount", TypeName = "decimal(10,2)")]
        public decimal MinOrderAmount { get; set; } = 0; // الحد الأدنى للطلب

        [Column("max_discount_amount", TypeName = "decimal(10,2)")]
        public decimal? MaxDiscountAmount { get; set; } // سقف الخصم عند النسبة المئوية

        [Column("usage_limit")]
        public int? UsageLimit { get; set; } // null = غير محدود

        [Column("usage_count")]
        public int UsageCount { get; set; } = 0; // عدد مرات الاستخدام الفعلي

        [Column("user_usage_limit")]
        public int UserUsageLimit { get; set; } = 1; // عدد مرات الاستخدام لكل مستخدم

        // تقييد الكوبون على بائع أو تصنيف معين (اختياري)
        [Column("vendor_id")]
        public Guid? VendorId { get; set; }

        [Column("category_id")]
        public Guid? CategoryId { get; set; }

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

        // Navigation Properties
        [ForeignKey("VendorId")]
        public virtual Vendor? Vendor { get; set; }

        [ForeignKey("CategoryId")]
        public virtual Category? Category { get; set; }

        public virtual ICollection<CouponUsage> Usages { get; set; } = new List<CouponUsage>();
    }

    // ===================================
    // جدول تتبع استخدام الكوبونات
    // ===================================
    [Table("coupon_usages")]
    public class CouponUsage
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("coupon_id")]
        public Guid CouponId { get; set; }

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Required]
        [Column("discount_amount", TypeName = "decimal(10,2)")]
        public decimal DiscountAmount { get; set; } // المبلغ المخصوم الفعلي

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("CouponId")]
        public virtual Coupon Coupon { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }

        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }
    }
}