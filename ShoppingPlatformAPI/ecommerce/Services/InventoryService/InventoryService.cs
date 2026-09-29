using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.Exceptions;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;

namespace ecommerce.Services.InventoryService
{
    // المصدر الوحيد لقواعد المخزون: الخصم عند إنشاء الطلب، الإعادة عند الإلغاء أو الإرجاع، وتنبيه النقص.
    // البند الذي له متغير يُخصم من مخزون المتغير، وإلا فمن مخزون المنتج — نفس منطق السلة.
    public class InventoryService : IInventoryService
    {
        private readonly IInventoryRepository _inventoryRepository;
        private readonly INotificationService _notificationService;
        private readonly ILogger<InventoryService> _logger;

        public InventoryService(
            IInventoryRepository inventoryRepository,
            INotificationService notificationService,
            ILogger<InventoryService> logger)
        {
            _inventoryRepository = inventoryRepository;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task<List<StockChange>> ReserveAsync(IEnumerable<StockLine> lines, CancellationToken ct = default)
        {
            var changes = new List<StockChange>();

            // دمج البنود المكررة لنفس المنتج/المتغير حتى يُتحقق من الكمية الإجمالية مرة واحدة
            var merged = lines
                .GroupBy(l => new { l.ProductId, l.VariantId })
                .Select(g => new StockLine(g.Key.ProductId, g.Key.VariantId, g.Sum(l => l.Quantity), g.First().DisplayName));

            foreach (var line in merged)
            {
                if (line.Quantity <= 0) continue;

                var newStock = line.VariantId.HasValue
                    ? await _inventoryRepository.TryDecreaseVariantStockAsync(line.VariantId.Value, line.Quantity, ct)
                    : await _inventoryRepository.TryDecreaseProductStockAsync(line.ProductId, line.Quantity, ct);

                if (newStock == null)
                    throw new ConflictException($"الكمية المطلوبة من '{line.DisplayName}' لم تعد متوفرة، يرجى تحديث السلة");

                changes.Add(new StockChange(line.ProductId, line.VariantId, newStock.Value + line.Quantity, newStock.Value));
            }

            return changes;
        }

        public async Task<List<StockChange>> RestoreForSubOrdersAsync(IEnumerable<Guid> subOrderIds, CancellationToken ct = default)
        {
            var lines = await _inventoryRepository.GetSubOrderLinesAsync(subOrderIds, ct);
            return await RestockAsync(lines, ct);
        }

        public async Task<List<StockChange>> RestockAsync(IEnumerable<StockLineQuantity> lines, CancellationToken ct = default)
        {
            var changes = new List<StockChange>();

            foreach (var line in lines)
            {
                if (line.Quantity <= 0) continue;

                // إذا حُذف المتغير أو المنتج منذ الطلب فلا يوجد ما يُعاد إليه
                var newStock = line.VariantId.HasValue
                    ? await _inventoryRepository.IncreaseVariantStockAsync(line.VariantId.Value, line.Quantity, ct)
                    : await _inventoryRepository.IncreaseProductStockAsync(line.ProductId, line.Quantity, ct);

                if (newStock != null)
                    changes.Add(new StockChange(line.ProductId, line.VariantId, newStock.Value - line.Quantity, newStock.Value));
            }

            return changes;
        }

        public async Task NotifyLowStockAsync(IEnumerable<StockChange> changes, CancellationToken ct = default)
        {
            foreach (var change in changes.Where(BecameLow))
            {
                // فشل التنبيه لا يُفشل العملية التي غيّرت المخزون
                try
                {
                    var info = await _inventoryRepository.GetStockItemInfoAsync(change.ProductId, change.VariantId, ct);
                    if (info == null) continue;

                    var name = string.IsNullOrWhiteSpace(info.VariantSku)
                        ? info.ProductName
                        : $"{info.ProductName} ({info.VariantSku})";

                    await _notificationService.NotifyLowStockAsync(
                        change.ProductId, name, info.VendorId, change.CurrentStock);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "Low-stock notification failed. ProductId: {ProductId}, VariantId: {VariantId}",
                        change.ProductId, change.VariantId);
                }
            }
        }

        // التنبيه عند عبور الحد أو النفاد فقط — لا يتكرر مع كل تغيير على مخزون منخفض أصلاً
        private static bool BecameLow(StockChange c)
        {
            var threshold = StockThresholds.LowStock;
            var crossedIntoLow = c.PreviousStock >= threshold && c.CurrentStock < threshold;
            var ranOut = c.PreviousStock > 0 && c.CurrentStock == 0;
            return crossedIntoLow || ranOut;
        }
    }
}
