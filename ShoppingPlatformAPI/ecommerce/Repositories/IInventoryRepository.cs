using ecommerce.Core.DTO.Inventory;

namespace ecommerce.Repositories
{
    // عمليات المخزون الذرية: كل تعديل جملة UPDATE مشروطة تُنفَّذ فوراً على قاعدة البيانات
    // (ExecuteUpdate) حتى لا يُباع نفس المخزون مرتين عند تزامن طلبين.
    // المعاملة (Transaction) مسؤولية الـ Service المستدعي.
    public interface IInventoryRepository
    {
        // تُرجع المخزون الجديد، أو null إذا كانت الكمية المتوفرة أقل من المطلوبة
        Task<int?> TryDecreaseProductStockAsync(Guid productId, int quantity, CancellationToken ct = default);
        Task<int?> TryDecreaseVariantStockAsync(Guid variantId, int quantity, CancellationToken ct = default);

        // تُرجع المخزون الجديد، أو null إذا لم يعد المنتج/المتغير موجوداً
        Task<int?> IncreaseProductStockAsync(Guid productId, int quantity, CancellationToken ct = default);
        Task<int?> IncreaseVariantStockAsync(Guid variantId, int quantity, CancellationToken ct = default);

        // بنود الطلبات الفرعية مجمّعة حسب المنتج/المتغير
        Task<List<StockLineQuantity>> GetSubOrderLinesAsync(IEnumerable<Guid> subOrderIds, CancellationToken ct = default);

        Task<StockItemInfo?> GetStockItemInfoAsync(Guid productId, Guid? variantId, CancellationToken ct = default);
    }
}
