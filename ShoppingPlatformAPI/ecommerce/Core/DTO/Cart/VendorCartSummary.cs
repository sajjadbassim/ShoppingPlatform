namespace ecommerce.Core.DTO.Cart
{
    public class VendorCartSummary
    {
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public string VendorNameAr { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal MinOrderAmount { get; set; }
        public int ItemsCount { get; set; }
        public decimal Subtotal { get; set; }
        public bool MeetsMinimum { get; set; }
        public List<CartItemDto> Items { get; set; }
    }
}
