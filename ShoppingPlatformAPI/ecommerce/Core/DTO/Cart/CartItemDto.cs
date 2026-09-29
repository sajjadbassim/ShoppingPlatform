namespace ecommerce.Core.DTO.Cart
{
    public class CartItemDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; }
        public string ProductNameAr { get; set; }
        public string ProductImage { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal { get; set; }
        public bool IsAvailable { get; set; }
        public int StockQuantity { get; set; }

        public Guid? VariantId { get; set; }
        public string? VariantSku { get; set; }
        public decimal? VariantPriceAdjustment { get; set; }
        public List<VariantAttributeInfo> VariantAttributes { get; set; } = new();

        // معلومات المتجر
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public string VendorNameAr { get; set; }
        public decimal VendorDeliveryFee { get; set; }
        public decimal VendorMinOrderAmount { get; set; }

        // معلومات التصنيف
        public Guid? CategoryId { get; set; }
        public string CategoryName { get; set; }
    }

}
