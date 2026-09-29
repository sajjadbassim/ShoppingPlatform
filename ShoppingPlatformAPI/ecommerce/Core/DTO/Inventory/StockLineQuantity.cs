namespace ecommerce.Core.DTO.Inventory
{
    // كمية تُضاف إلى المخزون (من المتغير إن وُجد، وإلا من المنتج)
    public record StockLineQuantity(Guid ProductId, Guid? VariantId, int Quantity);
}
