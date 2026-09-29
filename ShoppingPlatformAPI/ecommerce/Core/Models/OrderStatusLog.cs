using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    [Table("order_status_logs")]
    public class OrderStatusLog
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("order_id")]
        public Guid? OrderId { get; set; }

        [Column("sub_order_id")]
        public Guid? SubOrderId { get; set; }

        [MaxLength(50)]
        [Column("old_status")]
        public string OldStatus { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("new_status")]
        public string NewStatus { get; set; }

        [Column("changed_by")]
        public Guid? ChangedBy { get; set; }

        [Column("reason")]
        public string Reason { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("SubOrderId")]
        public virtual SubOrder SubOrder { get; set; }

        [ForeignKey("ChangedBy")]
        public virtual User ChangedByUser { get; set; }
    }
}
