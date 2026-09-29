using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // جدول المراجعات الرئيسي
    // ===================================
    [Table("reviews")]
    public class Review
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        [Column("order_id")]
        public Guid OrderId { get; set; } // للتحقق أن المستخدم اشترى المنتج

        [Required]
        [Range(1, 5)]
        [Column("rating")]
        public int Rating { get; set; }

        [MaxLength(200)]
        [Column("title")]
        public string? Title { get; set; }

        [MaxLength(2000)]
        [Column("body")]
        public string? Body { get; set; }

        [Column("helpful_count")]
        public int HelpfulCount { get; set; } = 0;

        [Column("is_verified_purchase")]
        public bool IsVerifiedPurchase { get; set; } = true;

        [Column("is_approved")]
        public bool IsApproved { get; set; } = true; // يصبح false عند الإبلاغ عنه 3 مرات

        [MaxLength(1000)]
        [Column("vendor_reply")]
        public string? VendorReply { get; set; }

        [Column("vendor_reply_at")]
        public DateTime? VendorReplyAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        // Navigation Properties
        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }

        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        public virtual ICollection<ReviewImage> Images { get; set; } = new List<ReviewImage>();
        public virtual ICollection<ReviewHelpful> HelpfulVotes { get; set; } = new List<ReviewHelpful>();
        public virtual ICollection<ReviewReport> Reports { get; set; } = new List<ReviewReport>();
    }

    // ===================================
    // جدول صور المراجعة
    // ===================================
    [Table("review_images")]
    public class ReviewImage
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("review_id")]
        public Guid ReviewId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("image_url")]
        public string ImageUrl { get; set; }

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ReviewId")]
        public virtual Review Review { get; set; }
    }

    // ===================================
    // جدول تصويت "مفيدة"
    // ===================================
    [Table("review_helpfuls")]
    public class ReviewHelpful
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("review_id")]
        public Guid ReviewId { get; set; }

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ReviewId")]
        public virtual Review Review { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }

    // ===================================
    // جدول الإبلاغ عن مراجعة
    // ===================================
    [Table("review_reports")]
    public class ReviewReport
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("review_id")]
        public Guid ReviewId { get; set; }

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("reason")]
        public string Reason { get; set; } // spam | offensive | fake | irrelevant

        [MaxLength(500)]
        [Column("details")]
        public string? Details { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ReviewId")]
        public virtual Review Review { get; set; }

        [ForeignKey("UserId")]
        public virtual User User { get; set; }
    }
}