namespace ecommerce.Core.DTO.Wishlist
{
    public class ProductWishlistDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string NameAr { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public bool IsAvailable { get; set; }
        public int StockQuantity { get; set; }
        public string PrimaryImageUrl { get; set; }

        // معلومات المتجر
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }

        // حقول محسوبة
        public bool HasDiscount => OriginalPrice.HasValue && OriginalPrice > Price;
        public decimal? DiscountPercentage => HasDiscount
            ? Math.Round(((OriginalPrice.Value - Price) / OriginalPrice.Value) * 100, 2)
            : null;
    }
}
