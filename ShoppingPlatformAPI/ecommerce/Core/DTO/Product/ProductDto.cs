namespace ecommerce.Core.DTO.Product
{
    public class ProductDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string NameAr { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public string Sku { get; set; }
        public int StockQuantity { get; set; }
        public bool IsAvailable { get; set; }

        // للمنتج ذي المتغيرات: المخزون والتوفر محسوبان من المتغيرات المتوفرة
        public bool HasVariants { get; set; }

        // القيم المخزّنة كما أدخلها البائع (قبل العروض ومخزون المتغيرات) — لنماذج التعديل.
        // Price/OriginalPrice/StockQuantity/IsAvailable أعلاه هي ما يراه الزبون، وحفظها في النموذج
        // كان يُنقص السعر الحقيقي بقيمة العرض عند كل حفظ
        public decimal RegularPrice { get; set; }
        public decimal? RegularOriginalPrice { get; set; }
        public int RegularStockQuantity { get; set; }
        public bool RegularIsAvailable { get; set; }
        public bool IsActive { get; set; }

        // معلومات المتجر
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }

        // معلومات التصنيف
        public Guid? CategoryId { get; set; }
        public string CategoryName { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // ✅ حقول العروض
        public bool HasPromotion { get; set; }
        public string? PromotionName { get; set; }
        public string? PromotionNameAr { get; set; }
        public DateTime? PromotionExpiresAt { get; set; }

        // ===================================
        // حقول محسوبة تلقائياً
        // Price = السعر بعد الخصم (إن وجد)
        // OriginalPrice = السعر الأصلي قبل الخصم
        // ===================================
        public bool HasDiscount => OriginalPrice.HasValue && OriginalPrice > Price;

        public decimal? DiscountPercentage => HasDiscount
            ? Math.Round(((OriginalPrice.Value - Price) / OriginalPrice.Value) * 100, 2)
            : null;

        public List<ProductImageDto> Images { get; set; } = new List<ProductImageDto>();

        public string? PrimaryImageUrl =>
            Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl;
    }
}