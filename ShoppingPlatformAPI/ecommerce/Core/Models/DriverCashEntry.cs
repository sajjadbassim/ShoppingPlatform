using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // نقد استلمه سائق بعينه من الزبون (ثمن ما سلّمه، أو أجرة رفض) — سطر لكل عملية تحصيل.
    // الطلب الموزّع على سائقين له سطر لكل سائق، فلا يُحسب نقد أحدهما على الآخر.
    [Table("driver_cash_entries")]
    public class DriverCashEntry
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Column("driver_id")]
        public Guid DriverId { get; set; }

        [Column("amount", TypeName = "decimal(10,2)")]
        public decimal Amount { get; set; }

        // DELIVERY | REFUSAL_FEE
        [Required, MaxLength(20)]
        [Column("kind")]
        public string Kind { get; set; } = DriverCashKind.Delivery;

        [Column("collected_at")]
        public DateTime CollectedAt { get; set; } = DateTime.UtcNow;

        [Column("settled_at")]
        public DateTime? SettledAt { get; set; }

        [Column("settled_by")]
        public Guid? SettledBy { get; set; }

        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver Driver { get; set; }
    }

    public static class DriverCashKind
    {
        public const string Delivery = "DELIVERY";
        public const string RefusalFee = "REFUSAL_FEE";
    }
}
