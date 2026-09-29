namespace ecommerce.Core.DTO.Product
{
    // ===================================
    // نتيجة البحث الموحد
    // ===================================
    public class UnifiedSearchResult
    {
        public string SearchTerm { get; set; }
        public int TotalResults { get; set; }
        public List<ProductSearchResult> Products { get; set; } = new();
        public List<VendorSearchResult> Vendors { get; set; } = new();
        public List<CategorySearchResult> Categories { get; set; } = new();
    }

    public class ProductSearchResult
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string NameAr { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public bool HasDiscount { get; set; }
        public decimal? DiscountPercentage { get; set; }
        public string? PrimaryImageUrl { get; set; }
        public string VendorName { get; set; }
        public string CategoryName { get; set; }
        public decimal? AverageRating { get; set; }
        public int ReviewCount { get; set; }
        public bool IsAvailable { get; set; }
    }

    public class VendorSearchResult
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string? NameAr { get; set; }
        public string? LogoUrl { get; set; }
        public int ProductCount { get; set; }
        public decimal? AverageRating { get; set; }
    }

    public class CategorySearchResult
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string? NameAr { get; set; }
        public string? IconUrl { get; set; }
        public int ProductCount { get; set; }
    }
}