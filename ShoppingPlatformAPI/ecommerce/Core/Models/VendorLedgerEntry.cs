using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // حركة في دفتر حساب المتجر. Amount موجب = للمتجر على المنصة، سالب = يُخصم منه.
    // الرصيد = مجموع الحركات = ما تدين به المنصة للمتجر الآن.
    [Table("vendor_ledger_entries")]
    public class VendorLedgerEntry
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("vendor_id")]
        public Guid VendorId { get; set; }

        // SALE | COMMISSION | VENDOR_COUPON | REFUSAL_FEE | RETURN | RETURN_COMMISSION | PAYOUT | ADJUSTMENT
        [Required, MaxLength(30)]
        [Column("type")]
        public string Type { get; set; }

        [Column("amount", TypeName = "decimal(12,2)")]
        public decimal Amount { get; set; }

        [Column("order_id")]
        public Guid? OrderId { get; set; }

        [Column("sub_order_id")]
        public Guid? SubOrderId { get; set; }

        [Column("return_id")]
        public Guid? ReturnId { get; set; }

        [MaxLength(300)]
        [Column("description")]
        public string? Description { get; set; }

        // الدفعات: طريقة التحويل ورقمه
        [MaxLength(100)]
        [Column("reference")]
        public string? Reference { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("created_by")]
        public Guid? CreatedBy { get; set; }

        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }
    }
}
