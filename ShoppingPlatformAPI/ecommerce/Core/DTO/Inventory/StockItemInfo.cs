namespace ecommerce.Core.DTO.Inventory
{
    // بيانات عرض المنتج/المتغير في تنبيه نقص المخزون
    public record StockItemInfo(Guid VendorId, string ProductName, string? VariantSku);
}
