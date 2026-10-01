using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Loyalty
{
    // ===================================
    // LoyaltyAccount
    // ===================================
    public class LoyaltyAccountDto
    {
        public Guid Id { get; set; }
        public int Balance { get; set; }
        public int TotalEarned { get; set; }
        public int TotalRedeemed { get; set; }
        public string Tier { get; set; }
        public string TierAr { get; set; }
        public decimal BalanceValue { get; set; }       // قيمة النقاط بالعملة
        public int NextTierPoints { get; set; }         // النقاط المطلوبة للمستوى التالي
        public string? NextTier { get; set; }
        public decimal TierMultiplier { get; set; }     // مضاعف النقاط الحالي
    }

    // ===================================
    // LoyaltyTransaction
    // ===================================
    public class LoyaltyTransactionDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; }
        public string TypeAr { get; set; }
        public int Points { get; set; }
        public int BalanceAfter { get; set; }
        public string Description { get; set; }
        public string? DescriptionAr { get; set; }
        public Guid? OrderId { get; set; }
        public string? OrderNumber { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class LoyaltyTransactionPagedDto
    {
        public List<LoyaltyTransactionDto> Data { get; set; } = new();
        public object Pagination { get; set; }
    }

    // ===================================
    // Redeem Request
    // ===================================
    public class RedeemPointsDto
    {
        [Required]
        public Guid OrderId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "عدد النقاط يجب أن يكون أكبر من 0")]
        public int Points { get; set; }
    }

    public class RedeemPointsResultDto
    {
        public int PointsUsed { get; set; }
        public decimal DiscountAmount { get; set; }
        public int RemainingBalance { get; set; }
        public string Message { get; set; }
    }

    // ===================================
    // Estimate (قبل تأكيد الطلب)
    // ===================================
    public class LoyaltyEstimateDto
    {
        public int PointsToEarn { get; set; }           // النقاط التي ستكتسب
        public int MaxRedeemablePoints { get; set; }    // أقصى نقاط يمكن صرفها
        public decimal MaxDiscountAmount { get; set; }  // أقصى خصم ممكن
        public int CurrentBalance { get; set; }
        public decimal PointValue { get; set; }
    }

    // ===================================
    // Admin DTOs
    // ===================================
    public class AdminAdjustPointsDto
    {
        [Required]
        public Guid UserId { get; set; }

        [Required]
        public int Points { get; set; } // موجب أو سالب

        [Required]
        [MaxLength(500)]
        public string Reason { get; set; }

        [MaxLength(500)]
        public string? ReasonAr { get; set; }
    }

    public class UpdateLoyaltySettingsDto
    {
        [Range(0.01, 100)]
        public decimal? PointsPerCurrencyUnit { get; set; }

        [Range(0.001, 1)]
        public decimal? PointValue { get; set; }

        [Range(1, 10000)]
        public int? MinRedemptionPoints { get; set; }

        [Range(1, 100)]
        public decimal? MaxRedemptionPercentage { get; set; }

        [Range(1, 3650)]
        public int? PointsExpiryDays { get; set; }

        public int? SilverThreshold { get; set; }
        public int? GoldThreshold { get; set; }
        public int? PlatinumThreshold { get; set; }

        public decimal? SilverMultiplier { get; set; }
        public decimal? GoldMultiplier { get; set; }
        public decimal? PlatinumMultiplier { get; set; }

        [Range(0, 10000)]
        public int? ReviewPoints { get; set; }

        public bool? IsActive { get; set; }
    }

    public class LoyaltySettingsDto
    {
        public decimal PointsPerCurrencyUnit { get; set; }
        public decimal PointValue { get; set; }
        public int MinRedemptionPoints { get; set; }
        public decimal MaxRedemptionPercentage { get; set; }
        public int PointsExpiryDays { get; set; }
        public int SilverThreshold { get; set; }
        public int GoldThreshold { get; set; }
        public int PlatinumThreshold { get; set; }
        public decimal SilverMultiplier { get; set; }
        public decimal GoldMultiplier { get; set; }
        public decimal PlatinumMultiplier { get; set; }
        public int ReviewPoints { get; set; }
        public bool IsActive { get; set; }
    }
}