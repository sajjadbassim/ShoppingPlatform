namespace ecommerce.Core.DTO.Product
{
    // بيانات خفيفة لحساب سعر العرض في الذاكرة (فلترة/ترتيب بالسعر بعد العروض)
    public record ProductPriceInfo(Guid Id, decimal Price, decimal? OriginalPrice, Guid? CategoryId, Guid VendorId);
}
