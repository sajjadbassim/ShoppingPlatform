using ecommerce.Core.Constants;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ecommerce.Core.Models
{
    // ===================================
    // LoyaltyAccount — حساب النقاط
    // ===================================
    [Table("loyalty_accounts")]
    public class LoyaltyAccount
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("balance")]
        public int Balance { get; set; } = 0;          // النقاط الحالية

        [Column("total_earned")]
        public int TotalEarned { get; set; } = 0;      // إجمالي المكتسب

        [Column("total_redeemed")]
        public int TotalRedeemed { get; set; } = 0;    // إجمالي المصروف

        [Column("tier")]
        public string Tier { get; set; } = LoyaltyTier.Bronze; // bronze | silver | gold | platinum

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public virtual User User { get; set; }
        public virtual ICollection<LoyaltyTransaction> Transactions { get; set; } = new List<LoyaltyTransaction>();
    }

    // ===================================
    // LoyaltyTransaction — سجل المعاملات
    // ===================================
    [Table("loyalty_transactions")]
    public class LoyaltyTransaction
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("account_id")]
        public Guid AccountId { get; set; }

        [Required]
        [Column("type")]
        public string Type { get; set; }  // earned | redeemed | expired | adjusted

        [Required]
        [Column("points")]
        public int Points { get; set; }   // موجب للكسب، سالب للصرف

        [Column("balance_after")]
        public int BalanceAfter { get; set; }

        [MaxLength(500)]
        [Column("description")]
        public string Description { get; set; }

        [MaxLength(500)]
        [Column("description_ar")]
        public string? DescriptionAr { get; set; }

        [Column("order_id")]
        public Guid? OrderId { get; set; }         // مرتبط بطلب

        // مفتاح يمنع تكرار منح نقاط لنفس الحدث، مثل "review:{productId}" لنقاط التقييم
        [MaxLength(100)]
        [Column("reference_key")]
        public string? ReferenceKey { get; set; }

        [Column("expires_at")]
        public DateTime? ExpiresAt { get; set; }   // صلاحية النقاط المكتسبة

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("AccountId")]
        public virtual LoyaltyAccount Account { get; set; }

        [ForeignKey("OrderId")]
        public virtual Order? Order { get; set; }
    }

    // ===================================
    // LoyaltySettings — إعدادات النظام
    // ===================================
    [Table("loyalty_settings")]
    public class LoyaltySettings
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Precision(18, 4)]
        // كم نقطة لكل 1 وحدة عملة
        [Column("points_per_currency_unit")]
        public decimal PointsPerCurrencyUnit { get; set; } = 1m; // كل 10 ريال = 10 نقاط مثلاً
       
        
        [Precision(18, 4)]
        // قيمة النقطة عند الاسترداد
        [Column("point_value")]
        public decimal PointValue { get; set; } = 0.01m; // 100 نقطة = 1 ريال

        // الحد الأدنى للاسترداد
        [Column("min_redemption_points")]
        public int MinRedemptionPoints { get; set; } = 100;

        [Precision(18, 4)]
        // الحد الأقصى للاسترداد كنسبة من الطلب
        [Column("max_redemption_percentage")]
        public decimal MaxRedemptionPercentage { get; set; } = 50m; // 50% من قيمة الطلب

        // صلاحية النقاط بالأيام
        [Column("points_expiry_days")]
        public int PointsExpiryDays { get; set; } = 365;

        // حدود الـ Tiers
        [Column("silver_threshold")]
        public int SilverThreshold { get; set; } = 500;

        [Column("gold_threshold")]
        public int GoldThreshold { get; set; } = 2000;

        [Column("platinum_threshold")]
        public int PlatinumThreshold { get; set; } = 5000;


        [Precision(18, 4)]
        // مضاعفات نقاط حسب الـ Tier
        [Column("silver_multiplier")]
        public decimal SilverMultiplier { get; set; } = 1.25m;

        [Precision(18, 4)]
        [Column("gold_multiplier")]
        public decimal GoldMultiplier { get; set; } = 1.5m;

        [Precision(18, 4)]
        [Column("platinum_multiplier")]
        public decimal PlatinumMultiplier { get; set; } = 2.0m;

        // نقاط كتابة تقييم لمنتج (0 = لا نقاط)
        [Column("review_points")]
        public int ReviewPoints { get; set; } = 10;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

}