using ecommerce.Core.DTO.Inventory;

namespace ecommerce.Services.InventoryService
{
    public interface IInventoryService
    {
        // خصم المخزون عند إنشاء الطلب — يرمي ConflictException إذا لم تعد الكمية متوفرة.
        // يُستدعى داخل معاملة حتى يُتراجع عن البنود السابقة عند الفشل.
        Task<List<StockChange>> ReserveAsync(IEnumerable<StockLine> lines, CancellationToken ct = default);

        // إعادة مخزون طلبات فرعية أُلغيت — مرة واحدة عند انتقال الطلب الفرعي إلى "ملغي"
        Task<List<StockChange>> RestoreForSubOrdersAsync(IEnumerable<Guid> subOrderIds, CancellationToken ct = default);

        // إضافة كميات للمخزون (مثل بضاعة مرتجعة صالحة للبيع)
        Task<List<StockChange>> RestockAsync(IEnumerable<StockLineQuantity> lines, CancellationToken ct = default);

        // تنبيه نقص المخزون للتغييرات التي عبرت الحد — بعد نجاح الحفظ
        Task NotifyLowStockAsync(IEnumerable<StockChange> changes, CancellationToken ct = default);
    }
}
