namespace ecommerce.Core.DTO.CouponDto
{
    public class CouponValidationResultDto
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public string Code { get; set; }
        public string DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal DiscountAmount { get; set; }   // المبلغ المخصوم الفعلي
        public decimal FinalAmount { get; set; }      // المبلغ بعد الخصم
    }
}
