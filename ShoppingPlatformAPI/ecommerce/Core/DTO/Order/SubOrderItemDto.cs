namespace ecommerce.Core.DTO.Order
{
    public class SubOrderItemDto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string ProductName { get; set; }
        public string ProductNameAr { get; set; }
        public string ProductImageUrl { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Subtotal { get; set; }

        public Guid? VariantId { get; set; }
        public string? VariantSku { get; set; }
        public List<VariantAttributeInfo> VariantAttributes { get; set; } = new();


    }


}
