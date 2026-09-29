using ecommerce.Core.DTO.Inventory;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class InventoryRepository : IInventoryRepository
    {
        private readonly AppDbContext _context;

        public InventoryRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<int?> TryDecreaseProductStockAsync(Guid productId, int quantity, CancellationToken ct = default)
        {
            var affected = await _context.Products
                .Where(p => p.Id == productId && p.StockQuantity >= quantity)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity - quantity)
                    .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);

            return affected == 0 ? null : await GetProductStockAsync(productId, ct);
        }

        public async Task<int?> TryDecreaseVariantStockAsync(Guid variantId, int quantity, CancellationToken ct = default)
        {
            var affected = await _context.ProductVariants
                .Where(v => v.Id == variantId && v.StockQuantity >= quantity)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(v => v.StockQuantity, v => v.StockQuantity - quantity)
                    .SetProperty(v => v.UpdatedAt, DateTime.UtcNow), ct);

            return affected == 0 ? null : await GetVariantStockAsync(variantId, ct);
        }

        public async Task<int?> IncreaseProductStockAsync(Guid productId, int quantity, CancellationToken ct = default)
        {
            var affected = await _context.Products
                .Where(p => p.Id == productId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity + quantity)
                    .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);

            return affected == 0 ? null : await GetProductStockAsync(productId, ct);
        }

        public async Task<int?> IncreaseVariantStockAsync(Guid variantId, int quantity, CancellationToken ct = default)
        {
            var affected = await _context.ProductVariants
                .Where(v => v.Id == variantId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(v => v.StockQuantity, v => v.StockQuantity + quantity)
                    .SetProperty(v => v.UpdatedAt, DateTime.UtcNow), ct);

            return affected == 0 ? null : await GetVariantStockAsync(variantId, ct);
        }

        public async Task<List<StockLineQuantity>> GetSubOrderLinesAsync(IEnumerable<Guid> subOrderIds, CancellationToken ct = default)
        {
            var ids = subOrderIds.Distinct().ToList();
            if (ids.Count == 0) return new List<StockLineQuantity>();

            return await _context.SubOrderItems
                .AsNoTracking()
                .Where(i => ids.Contains(i.SubOrderId))
                .GroupBy(i => new { i.ProductId, i.VariantId })
                .Select(g => new StockLineQuantity(g.Key.ProductId, g.Key.VariantId, g.Sum(i => i.Quantity)))
                .ToListAsync(ct);
        }

        public async Task<StockItemInfo?> GetStockItemInfoAsync(Guid productId, Guid? variantId, CancellationToken ct = default)
        {
            var product = await _context.Products
                .AsNoTracking()
                .Where(p => p.Id == productId)
                .Select(p => new { p.VendorId, Name = p.NameAr ?? p.Name })
                .FirstOrDefaultAsync(ct);

            if (product == null) return null;

            string? sku = null;
            if (variantId.HasValue)
            {
                sku = await _context.ProductVariants
                    .AsNoTracking()
                    .Where(v => v.Id == variantId.Value)
                    .Select(v => v.Sku)
                    .FirstOrDefaultAsync(ct);
            }

            return new StockItemInfo(product.VendorId, product.Name, sku);
        }

        // قراءة مباشرة من قاعدة البيانات، فالكيانات المتتبَّعة في الـ Context قد تحمل قيمة قديمة
        private Task<int> GetProductStockAsync(Guid productId, CancellationToken ct) =>
            _context.Products.Where(p => p.Id == productId).Select(p => p.StockQuantity).FirstAsync(ct);

        private Task<int> GetVariantStockAsync(Guid variantId, CancellationToken ct) =>
            _context.ProductVariants.Where(v => v.Id == variantId).Select(v => v.StockQuantity).FirstAsync(ct);
    }
}
