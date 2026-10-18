using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // مهمة إرجاع: بضاعة لم تُسلَّم للزبون (تعذّر التسليم، أو قطع رُفضت عند الباب) تعود مع نفس السائق إلى متجرها،
    // أو مرتجع بعد الاستلام (customer_return): سائق تعيّنه العمليات يأخذ القطع من الزبون (AT_CUSTOMER) ثم يوصلها للمتجر.
    // ليست طلباً: لا رقم طلب، ولا تدخل في الطلبات والمبيعات، ولا يراها الزبون. أجرتها صفر — لا يتحمّلها أحد.
    // مهمة لكل متجر (طلب من 3 متاجر = 3 محطات إرجاع). السائق يبقى متاحاً لطلبات جديدة ويُرجعها حين يتاح له،
    // ولا يُنهي دوامه قبلها. المتجر يؤكد الاستلام فيعود المخزون — وأي نقص يعوّضه المتجر مع سائقه.
    [Table("return_trips")]
    public class ReturnTrip
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("order_id")]
        public Guid OrderId { get; set; }

        [Column("sub_order_id")]
        public Guid SubOrderId { get; set; }

        [Column("vendor_id")]
        public Guid VendorId { get; set; }

        [Column("driver_id")]
        public Guid DriverId { get; set; }

        // رفض عند الباب: سجل الإرجاع المرتبط (يُعلَّم «أُعيد للمخزون» عند استلام المتجر)
        [Column("return_id")]
        public Guid? ReturnId { get; set; }

        // سبب تعذّر التسليم (DeliveryFailureReason) أو door_refusal
        [Required, MaxLength(30)]
        [Column("reason")]
        public string Reason { get; set; }

        // AT_CUSTOMER (مرتجع لم يأخذه السائق من الزبون بعد) | WITH_DRIVER | RECEIVED
        [Required, MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = ReturnTripStatus.WithDriver;

        [Column("delivery_fee", TypeName = "decimal(10,2)")]
        public decimal DeliveryFee { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // مرتجع بعد الاستلام: متى أخذ السائق القطع من الزبون
        [Column("picked_up_at")]
        public DateTime? PickedUpAt { get; set; }

        [Column("received_at")]
        public DateTime? ReceivedAt { get; set; }

        [Column("received_by")]
        public Guid? ReceivedBy { get; set; }

        [ForeignKey("OrderId")]
        public virtual Order Order { get; set; }

        [ForeignKey("SubOrderId")]
        public virtual SubOrder SubOrder { get; set; }

        [ForeignKey("VendorId")]
        public virtual Vendor Vendor { get; set; }

        [ForeignKey("DriverId")]
        public virtual Driver Driver { get; set; }

        public virtual Return? Return { get; set; }

        public virtual ICollection<ReturnTripItem> Items { get; set; } = new List<ReturnTripItem>();
    }

    [Table("return_trip_items")]
    public class ReturnTripItem
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("return_trip_id")]
        public Guid ReturnTripId { get; set; }

        [Column("sub_order_item_id")]
        public Guid SubOrderItemId { get; set; }

        [Column("product_id")]
        public Guid ProductId { get; set; }

        [Column("variant_id")]
        public Guid? VariantId { get; set; }

        [Required, MaxLength(300)]
        [Column("product_name")]
        public string ProductName { get; set; }

        [Column("quantity")]
        public int Quantity { get; set; }

        [ForeignKey("ReturnTripId")]
        public virtual ReturnTrip ReturnTrip { get; set; }
    }

    public static class ReturnTripStatus
    {
        public const string AtCustomer = "AT_CUSTOMER";
        public const string WithDriver = "WITH_DRIVER";
        public const string Received = "RECEIVED";

        // مفتوحة: لم يستلمها المتجر بعد
        public static readonly string[] Open = { AtCustomer, WithDriver };
    }

    public static class ReturnTripReason
    {
        public const string DoorRefusal = "door_refusal";
        public const string CustomerReturn = "customer_return";
    }
}
