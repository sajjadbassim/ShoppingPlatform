namespace ecommerce.Core.DTO.Cart
{
    public class CartResponseDto
    {
        public Guid CartId { get; set; }
        public List<CartItemDto> Items { get; set; }
        public int TotalItems { get; set; }
        public decimal Subtotal { get; set; }
        public decimal TotalDeliveryFees { get; set; }
        public decimal TotalAmount { get; set; }

        // تجميع حسب المتجر (مهم جداً!)
        public List<VendorCartSummary> VendorsSummary { get; set; }

        // تحذيرات
        public List<string> Warnings { get; set; }
    }
}
