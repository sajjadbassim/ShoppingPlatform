
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Models;
using ecommerce.Data;
using global::ecommerce.Core.Constants;
using global::ecommerce.Core.Models;
using global::ecommerce.Data;
using Microsoft.EntityFrameworkCore;
namespace ecommerce.Repositories
{
    public class ReturnRepository : IReturnRepository
    {
        private readonly AppDbContext _context;

        public ReturnRepository(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<Return?> GetByIdAsync(Guid id)
        {
            return await _context.Returns.FindAsync(id);
        }

        // ===================================
        // GetByIdWithDetailsAsync
        // ===================================
        public async Task<Return?> GetByIdWithDetailsAsync(Guid id)
        {
            return await _context.Returns
                .Include(r => r.Order)
                .Include(r => r.Customer)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Product)
                .Include(r => r.Images)
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        // ===================================
        // GetByReturnNumberAsync
        // ===================================
        public async Task<Return?> GetByReturnNumberAsync(string returnNumber)
        {
            return await _context.Returns
                .Include(r => r.Order)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Product)
                .Include(r => r.Images)
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.ReturnNumber == returnNumber);
        }

        // ===================================
        // GetByCustomerAsync
        // ===================================
        public async Task<IEnumerable<Return>> GetByCustomerAsync(Guid customerId)
        {
            return await _context.Returns
                .Include(r => r.Order)
                .Include(r => r.Items)
                    .ThenInclude(i => i.Product)
                .Include(r => r.Images)
                .Where(r => r.CustomerId == customerId)
                .OrderByDescending(r => r.CreatedAt)
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // GetPagedAsync (Admin/Ops)
        // ===================================
        public async Task<(IEnumerable<Return> Returns, int TotalCount)> GetPagedAsync(
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Returns
                .Include(r => r.Order)
                    .ThenInclude(o => o.Customer)  

                .Include(r => r.Customer)
                .Include(r => r.Items)
                .AsQueryable();

            // ===================================
            // فلتر الحالة
            // ===================================
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(r => r.Status == status.ToUpper());

            query = query.OrderByDescending(r => r.CreatedAt);

            var totalCount = await query.CountAsync();

            var returns = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return (returns, totalCount);
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<Return> CreateAsync(Return returnRequest)
        {
            returnRequest.CreatedAt = DateTime.UtcNow;
            returnRequest.UpdatedAt = DateTime.UtcNow;

            await _context.Returns.AddAsync(returnRequest);
            await _context.SaveChangesAsync();
            return returnRequest;
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<Return> UpdateAsync(Return returnRequest)
        {
            returnRequest.UpdatedAt = DateTime.UtcNow;
            _context.Returns.Update(returnRequest);
            await _context.SaveChangesAsync();
            return returnRequest;
        }

        // ===================================
        // Validation
        // ===================================
        public async Task<bool> HasActiveReturnForOrderAsync(Guid orderId)
        {
            return await _context.Returns
                .AnyAsync(r =>
                    r.OrderId == orderId &&
                    r.Status != ReturnStatus.REJECTED);
        }

        public async Task<bool> IsWithinReturnWindowAsync(Guid orderId, int returnWindowDays = 14)
        {
            var order = await _context.Orders
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                return false;

            // نتحقق من تاريخ التسليم عبر الـ StatusLogs
            var deliveredLog = await _context.OrderStatusLogs
                .Where(l => l.OrderId == orderId && l.NewStatus == OrderStatus.DELIVERED)
                .OrderByDescending(l => l.CreatedAt)
                .FirstOrDefaultAsync();

            if (deliveredLog == null)
                return false;

            return (DateTime.UtcNow - deliveredLog.CreatedAt).TotalDays <= returnWindowDays;
        }

        // ===================================
        // AddImagesAsync
        // ===================================
        public async Task AddImagesAsync(List<ReturnImage> images)
        {
            await _context.ReturnImages.AddRangeAsync(images);
            await _context.SaveChangesAsync();
        }

        // ===================================
        // GenerateReturnNumberAsync
        // ===================================
        public async Task<string> GenerateReturnNumberAsync()
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var count = await _context.Returns
                .CountAsync(r => r.CreatedAt.Date == DateTime.UtcNow.Date);

            return $"RET-{today}-{(count + 1):D4}";
        }

        public Task<Return?> GetByIdWithItemsAsync(Guid id, CancellationToken ct = default) =>
            _context.Returns
                .AsNoTracking()
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == id, ct);

        public async Task<bool> TryMarkRestockedAsync(Guid id, Guid restockedBy, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var affected = await _context.Returns
                .Where(r => r.Id == id && !r.IsRestocked)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.IsRestocked, true)
                    .SetProperty(r => r.RestockedAt, now)
                    .SetProperty(r => r.RestockedBy, restockedBy)
                    .SetProperty(r => r.UpdatedAt, now), ct);

            return affected > 0;
        }
    }
}

