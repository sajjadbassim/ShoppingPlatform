namespace ecommerce.Core.DTO.Inventory
{
    // نتيجة تعديل مخزون — تُستخدم لتقرير تنبيه نقص المخزون
    public record StockChange(Guid ProductId, Guid? VariantId, int PreviousStock, int CurrentStock);
}
