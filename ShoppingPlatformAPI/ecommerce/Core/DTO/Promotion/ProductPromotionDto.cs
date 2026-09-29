namespace ecommerce.Core.DTO.Promotion
{
    public class ProductPromotionDto
    {
        public Guid ProductId { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal FinalPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal DiscountPercentage { get; set; }
        public bool HasPromotion { get; set; }
        public string? PromotionName { get; set; }
        public string? PromotionNameAr { get; set; }
        public DateTime? PromotionExpiresAt { get; set; }
    }
}
