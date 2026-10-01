using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ecommerce.Core.Constants;

namespace ecommerce.Core.Models
{
    // إعدادات التوصيل (صف واحد)
    [Table("delivery_settings")]
    public class DeliverySettings
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        // من يتحمّل أجرة التوصيل عند رفض الزبون: CUSTOMER | VENDOR | NONE
        [Required]
        [MaxLength(20)]
        [Column("refusal_fee_payer")]
        public string RefusalFeePayer { get; set; } = Constants.RefusalFeePayer.Customer;

        // الرفض الجزئي على حساب الزبون دائماً (استلم جزءاً من الطلب) — الرفض الكامل يتبع RefusalFeePayer
        [Column("partial_refusal_customer_pays")]
        public bool PartialRefusalCustomerPays { get; set; } = false;

        // مهلة تأكيد المتجر للطلب الجديد (دقائق) — يغيّرها الأدمن، وتُطبَّق على الطلبات الجديدة
        [Column("confirmation_timeout_minutes")]
        public int ConfirmationTimeoutMinutes { get; set; } = 5;

        // حدود سرعة التوصيل (دقائق من الطلب حتى الوصول): ≤ السريع أخضر، ≥ البطيء أحمر، وبينهما أصفر
        [Column("delivery_fast_minutes")]
        public int DeliveryFastMinutes { get; set; } = 45;

        [Column("delivery_slow_minutes")]
        public int DeliverySlowMinutes { get; set; } = 90;

        // العمولة العامة للمنصة (تُطبَّق على المتاجر بلا عمولة خاصة)
        [MaxLength(20)]
        [Column("default_commission_type")]
        public string DefaultCommissionType { get; set; } = "PERCENTAGE";

        [Column("default_commission_value", TypeName = "decimal(12,2)")]
        public decimal DefaultCommissionValue { get; set; } = 0;

        // مناطق التوصيل: OFF (سعر كل متجر الثابت) | ALL (كل المتاجر) | SELECTED (المتاجر المحددة فقط)
        [MaxLength(10)]
        [Column("zones_mode")]
        public string ZonesMode { get; set; } = "OFF";

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_by")]
        public Guid? UpdatedBy { get; set; }
    }
}
