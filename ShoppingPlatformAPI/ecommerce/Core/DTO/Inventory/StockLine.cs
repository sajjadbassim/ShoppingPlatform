namespace ecommerce.Core.DTO.Inventory
{
    // بند مطلوب خصمه من المخزون (من المتغير إن وُجد، وإلا من المنتج)
    public record StockLine(Guid ProductId, Guid? VariantId, int Quantity, string DisplayName);
}
