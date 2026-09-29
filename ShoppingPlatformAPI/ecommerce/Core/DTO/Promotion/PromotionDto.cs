namespace ecommerce.Core.DTO.Promotion
{
    public class PromotionDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string? NameAr { get; set; }
        public string? Description { get; set; }
        public string TargetType { get; set; }
        public Guid? TargetId { get; set; }
        public string? TargetName { get; set; } // اسم المنتج / التصنيف / البائع
        public string DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public bool IsActive { get; set; }
        public DateTime? StartsAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public bool IsExpired => ExpiresAt.HasValue && ExpiresAt.Value < DateTime.UtcNow;
        public bool IsScheduled => StartsAt.HasValue && StartsAt.Value > DateTime.UtcNow;
        public bool IsRunning => IsActive && !IsExpired && !IsScheduled;
    }
}
