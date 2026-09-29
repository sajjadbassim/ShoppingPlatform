namespace ecommerce.Core.DTO.CouponDto
{
    public class CouponDto
    {
        public Guid Id { get; set; }
        public string Code { get; set; }
        public string? Description { get; set; }
        public string DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal MinOrderAmount { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public int? UsageLimit { get; set; }
        public int UsageCount { get; set; }
        public int UserUsageLimit { get; set; }
        public Guid? VendorId { get; set; }
        public string? VendorName { get; set; }
        public Guid? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public bool IsActive { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }

        // حقول محسوبة
        public bool IsExpired => ExpiresAt.HasValue && ExpiresAt.Value < DateTime.UtcNow;
        public bool IsUsageLimitReached => UsageLimit.HasValue && UsageCount >= UsageLimit.Value;
    }
}
