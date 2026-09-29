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
