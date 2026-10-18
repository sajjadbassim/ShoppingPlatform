using ecommerce.Core.Constants;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // جدول طلبات الإرجاع الرئيسي
    // ===================================
    [Table("returns")]
    public class Return
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        [Column("return_number")]
        public string ReturnNumber { get; set; } // مثل: RET-20240308-0001

        [Required]
        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Required]
        [Column("customer_id")]
        public Guid CustomerId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = ReturnStatus.PENDING; // PENDING | APPROVED | REJECTED | COMPLETED

        [Required]
        [MaxLength(50)]
        [Column("reason")]
        public string Reason { get; set; } // defective | wrong_item | not_as_described | changed_mind | other

        [Column("details")]
        public string? Details { get; set; }

        // من راجع الطلب (Admin/Ops)
        [Column("reviewed_by")]
        public Guid? ReviewedBy { get; set; }

        [Column("reviewed_at")]
        public DateTime? ReviewedAt { get; set; }

        [Column("rejection_reason")]
        public string? RejectionReason { get; set; }

        // إعادة البضاعة للمخزون — يدوية بعد استلامها وفحصها، ومرة واحدة فقط
        [Column("is_restocked")]
        public bool IsRestocked { get; set; } = false;

        // رفض عند الباب (سجّله السائق) — مستثنى من المبيعات أصلاً فلا يُخصم من المتجر مرة ثانية
        [Column("is_door_refusal")]
        public bool IsDoorRefusal { get; set; } = false;

        [Column("restocked_at")]
        public DateTime? RestockedAt { get; set; }

        [Column("restocked_by")]
        public Guid? RestockedBy { get; set; }

        // الاسترداد: المبلغ المستحق للزبون يُحسب عند القبول (قيمة القطع ناقص نصيبها من الخصم)،
        // ويصبح الإرجاع «مكتمل» حين تُسجّل الإدارة أنها ردّت المبلغ
        [Column("refund_amount", TypeName = "decimal(18,2)")]
        public decimal? RefundAmount { get; set; }

        [Column("refunded_at")]
        public DateTime? RefundedAt { get; set; }

        // قيمة نقاط القطع المُرجعة التي صرفها الزبون قبل الإرجاع — خُصمت من RefundAmount
        [Column("points_deduction_amount", TypeName = "decimal(18,2)")]
        public decimal? PointsDeductionAmount { get; set; }

        [Column("refunded_by")]
        public Guid? RefundedBy { get; set; }

        // إرجاع بعد الاستلام: السائق يأخذ القطع من الزبون إلى متجرها (ReturnTrip). يُردّ المال، ويُخصم من المتجر،
        // ويعود المخزون — بعد أن تؤكد كل المتاجر استلام قطعها فقط
        [Column("items_received_at")]
        public DateTime? ItemsReceivedAt { get; set; }

        // أجرة استلام القطع من الزبون (أجرة توصيل متاجرها) ومن يتحمّلها — CUSTOMER تُخصم من المبلغ المردود
        [Column("pickup_fee_amount", TypeName = "decimal(18,2)")]
        public decimal PickupFeeAmount { get; set; }

        [MaxLength(20)]
        [Column("pickup_fee_payer")]
        public string? PickupFeePayer { get; set; }

        // سبب تغيير العمليات لمن يتحمّل أجرة الاستلام (استثناء لهذا الإرجاع عن إعداد الأدمن)
        [MaxLength(300)]
        [Column("pickup_fee_override_reason")]
        public string? PickupFeeOverrideReason { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("CustomerId")]
        public virtual User Customer { get; set; }

        [ForeignKey("ReviewedBy")]
        public virtual User? ReviewedByUser { get; set; }

        public virtual ICollection<ReturnItem> Items { get; set; } = new List<ReturnItem>();
        public virtual ICollection<ReturnImage> Images { get; set; } = new List<ReturnImage>();
    }

    // ===================================
    // عناصر طلب الإرجاع
    // ===================================
    [Table("return_items")]
    public class ReturnItem
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("return_id")]
        public Guid ReturnId { get; set; }

        [Required]
        [Column("product_id")]
        public Guid ProductId { get; set; }

        // المتغير المُرجَع (إن وُجد) — لإعادة الكمية إلى مخزون المتغير الصحيح
        [Column("variant_id")]
        public Guid? VariantId { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("product_name")]
        public string ProductName { get; set; } // نحفظ الاسم وقت الإرجاع

        [Required]
        [Column("quantity")]
        public int Quantity { get; set; }

        [Required]
        [Column("unit_price", TypeName = "decimal(10,2)")]
        public decimal UnitPrice { get; set; }

        // Navigation Properties
        [ForeignKey("ReturnId")]
        public virtual Return Return { get; set; }

        [ForeignKey("ProductId")]
        public virtual Product Product { get; set; }

        [ForeignKey("VariantId")]
        public virtual ProductVariant? Variant { get; set; }
    }

    // ===================================
    // صور طلب الإرجاع
    // ===================================
    [Table("return_images")]
    public class ReturnImage
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("return_id")]
        public Guid ReturnId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("image_url")]
        public string ImageUrl { get; set; }

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ReturnId")]
        public virtual Return Return { get; set; }
    }
}