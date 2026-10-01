using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("orders")]
    public class Order
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        [Column("order_number")]
        public string OrderNumber { get; set; }

        [Required]
        [Column("customer_id")]
        public Guid CustomerId { get; set; }

        [Required]
        [Column("address_id")]
        public Guid AddressId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "PENDING_CONFIRMATION";

        [Required]
        [Column("subtotal", TypeName = "decimal(10,2)")]
        public decimal Subtotal { get; set; }

        [Column("delivery_fees", TypeName = "decimal(10,2)")]
        public decimal DeliveryFees { get; set; } = 0;

        [Required]
        [Column("total_amount", TypeName = "decimal(10,2)")]
        public decimal TotalAmount { get; set; }

        [MaxLength(50)]
        [Column("payment_method")]
        public string PaymentMethod { get; set; } = "COD";

        [MaxLength(50)]
        [Column("payment_status")]
        public string PaymentStatus { get; set; } = "PENDING";

        // ===== موقع التوصيل وقت الطلب (نسخة من دبوس العنوان) — تعديل العنوان لاحقاً لا يغيّر وجهة الطلب =====
        [Column("delivery_latitude", TypeName = "decimal(10,8)")]
        public decimal? DeliveryLatitude { get; set; }

        [Column("delivery_longitude", TypeName = "decimal(11,8)")]
        public decimal? DeliveryLongitude { get; set; }

        // منطقة التوصيل وقت الطلب (نسخة ثابتة — لا تتغير إن عُدّلت المنطقة لاحقاً)
        [Column("delivery_zone_id")]
        public Guid? DeliveryZoneId { get; set; }

        [MaxLength(100)]
        [Column("delivery_zone_name")]
        public string? DeliveryZoneName { get; set; }

        // ===== الدفع عند الاستلام: ما استلمه السائق نقداً، ومتى سلّمه للعمليات =====
        [Column("cash_collected_amount", TypeName = "decimal(10,2)")]
        public decimal? CashCollectedAmount { get; set; }

        [Column("cash_collected_at")]
        public DateTime? CashCollectedAt { get; set; }

        [Column("cash_collected_by_driver_id")]
        public Guid? CashCollectedByDriverId { get; set; }

        [Column("cash_settled_at")]
        public DateTime? CashSettledAt { get; set; }

        [Column("cash_settled_by")]
        public Guid? CashSettledBy { get; set; }

        // أجرة التوصيل عند الرفض: قيمتها ومن يتحمّلها (RefusalFeePayer) حسب الإعداد وقت الرفض
        [Column("refusal_fee_amount", TypeName = "decimal(10,2)")]
        public decimal? RefusalFeeAmount { get; set; }

        [MaxLength(20)]
        [Column("refusal_fee_payer")]
        public string? RefusalFeePayer { get; set; }

        [Column("customer_notes")]
        public string CustomerNotes { get; set; }

        [Column("cancellation_reason")]
        public string? CancellationReason { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("CustomerId")]
        public virtual User Customer { get; set; }

        [ForeignKey("AddressId")]
        public virtual Address Address { get; set; }

        public virtual ICollection<SubOrder> SubOrders { get; set; }

        public virtual ICollection<OrderStatusLog> StatusLogs { get; set; }

        [Column("discount_amount", TypeName = "decimal(10,2)")]
        public decimal DiscountAmount { get; set; } = 0;

        [MaxLength(50)]
        [Column("coupon_code")]
        public string? CouponCode { get; set; }
    }
}
