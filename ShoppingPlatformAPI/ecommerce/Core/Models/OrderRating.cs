using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // OrderRating — تقييم تجربة الطلب
    // تقييم شامل: التوصيل + المتجر + السائق
    // ===================================
    [Table("order_ratings")]
    public class OrderRating
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Required]
        [Column("customer_id")]
        public Guid CustomerId { get; set; }

        // ===================================
        // تقييم التوصيل العام (1-5)
        // ===================================
        [Required]
        [Range(1, 5)]
        [Column("delivery_rating")]
        public int DeliveryRating { get; set; }

        [MaxLength(1000)]
        [Column("delivery_comment")]
        public string? DeliveryComment { get; set; }

        // ===================================
        // تقييم السرعة (1-5)
        // ===================================
        [Range(1, 5)]
        [Column("speed_rating")]
        public int? SpeedRating { get; set; }

        // ===================================
        // تقييم حالة المنتجات عند الاستلام (1-5)
        // ===================================
        [Range(1, 5)]
        [Column("packaging_rating")]
        public int? PackagingRating { get; set; }

        // ===================================
        // هل سيوصي بالمتجر؟
        // ===================================
        [Column("would_recommend")]
        public bool? WouldRecommend { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("CustomerId")]
        public virtual User Customer { get; set; }

        public virtual ICollection<SubOrderRating> SubOrderRatings { get; set; } = new List<SubOrderRating>();
    }

    // ===================================
    // SubOrderRating — تقييم كل متجر على حدة
    // ===================================
    [Table("sub_order_ratings")]
    public class SubOrderRating
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("order_rating_id")]
        public Guid OrderRatingId { get; set; }

        [Required]
        [Column("sub_order_id")]
        public Guid SubOrderId { get; set; }

        [Required]
        [Column("vendor_id")]
        public Guid VendorId { get; set; }

        // تقييم المتجر (1-5)
        [Required]
        [Range(1, 5)]
        [Column("vendor_rating")]
        public int VendorRating { get; set; }

        [MaxLength(1000)]
        [Column("vendor_comment")]
        public string? VendorComment { get; set; }

        // تقييم السائق (1-5) — اختياري
        [Range(1, 5)]
        [Column("driver_rating")]
        public int? DriverRating { get; set; }

        [Column("driver_id")]
        public Guid? DriverId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("OrderRatingId")]
        public virtual OrderRating OrderRating { get; set; }

        [ForeignKey("SubOrderId")]
        public virtual SubOrder SubOrder { get; set; }

        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }
    }
}