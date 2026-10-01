using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("sub_orders")]

    public class SubOrder
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Required]
        [Column("vendor_id")]
        public Guid VendorId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("sub_order_number")]
        public string SubOrderNumber { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "PENDING_CONFIRMATION";

        [Required]
        [Column("subtotal", TypeName = "decimal(10,2)")]
        public decimal Subtotal { get; set; }

        [Column("delivery_fee", TypeName = "decimal(10,2)")]
        public decimal DeliveryFee { get; set; } = 0;

        [Column("confirmed_by")]
        public Guid? ConfirmedBy { get; set; }

        [Column("confirmed_at")]
        public DateTime? ConfirmedAt { get; set; }

        [Column("confirmation_deadline")]
        public DateTime? ConfirmationDeadline { get; set; }

        [Column("cancellation_reason")]
        public string? CancellationReason { get; set; }

        [Column("cancelled_by")]
        public Guid? CancelledBy { get; set; }

        [Column("cancelled_at")]
        public DateTime? CancelledAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }

        [ForeignKey("ConfirmedBy")]
        public virtual User ConfirmedByUser { get; set; }

        [ForeignKey("CancelledBy")]
        public virtual User CancelledByUser { get; set; }


        [Column("driver_id")]
        public Guid? DriverId { get; set; }

        [Column("assigned_at")]
        public DateTime? AssignedAt { get; set; }

        // السائق أكّد استلام الطلب من المتجر
        [Column("picked_up_at")]
        public DateTime? PickedUpAt { get; set; }

        // تعذّر التسليم: السبب (DeliveryFailureReason) والوقت
        [MaxLength(30)]
        [Column("failure_reason")]
        public string? FailureReason { get; set; }

        [MaxLength(300)]
        [Column("failure_note")]
        public string? FailureNote { get; set; }

        [Column("failed_at")]
        public DateTime? FailedAt { get; set; }

        // Navigation Property
        [ForeignKey("DriverId")]
        public virtual Driver? Driver { get; set; }
        public virtual ICollection<SubOrderItem> Items { get; set; }


        public virtual ICollection<OrderStatusLog> StatusLogs { get; set; }


    }
}
