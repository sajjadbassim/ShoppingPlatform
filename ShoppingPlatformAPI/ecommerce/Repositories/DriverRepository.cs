// Repositories/DriverRepository.cs
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class DriverRepository : IDriverRepository
    {
        private readonly AppDbContext _context;

        public DriverRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Driver?> GetByIdAsync(Guid id)
        {
            return await _context.Drivers
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        public async Task<Driver?> GetByPhoneAsync(string phone)
        {
            return await _context.Drivers
                .FirstOrDefaultAsync(d => d.Phone == phone);
        }

        public async Task<(IEnumerable<Driver> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? status, string? workStatus)
        {
            var query = _context.Drivers.AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(d => d.Status == status);

            if (!string.IsNullOrEmpty(workStatus))
                query = query.Where(d => d.WorkStatus == workStatus);

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(d => d.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<IEnumerable<Driver>> GetAvailableDriversAsync()
        {
            // من يمكن تعيينه: المتاح ومن يوصل الآن (يحمل أكثر من طلب في جولته)
            return await _context.Drivers
                .Where(d => d.Status == DriverStatus.Active &&
                            (d.WorkStatus == DriverWorkStatus.Available || d.WorkStatus == DriverWorkStatus.Delivering))
                .OrderBy(d => d.FullName)
                .ToListAsync();
        }

        // عدد الطلبات المفتوحة مع كل سائق (معيَّنة لم تُستلم أو في الطريق)
        public async Task<Dictionary<Guid, int>> GetActiveOrderCountsAsync(IEnumerable<Guid> driverIds)
        {
            var ids = driverIds.ToList();
            return await _context.SubOrders
                .Where(so => so.DriverId != null && ids.Contains(so.DriverId.Value) && DriverTrip.Statuses.Contains(so.Status))
                .GroupBy(so => so.DriverId!.Value)
                .Select(g => new { DriverId = g.Key, Orders = g.Select(so => so.OrderId).Distinct().Count() })
                .ToDictionaryAsync(x => x.DriverId, x => x.Orders);
        }

        public async Task<Driver> CreateAsync(Driver driver)
        {
            driver.CreatedAt = DateTime.UtcNow;
            driver.UpdatedAt = DateTime.UtcNow;
            await _context.Drivers.AddAsync(driver);
            await _context.SaveChangesAsync();
            return driver;
        }

        public async Task<IAsyncDisposable> LockAsync(Guid driverId) => await OrderLock.ForDriverAsync(_context, driverId);

        public async Task<Driver> UpdateAsync(Driver driver)
        {
            driver.UpdatedAt = DateTime.UtcNow;
            _context.Drivers.Update(driver);
            await _context.SaveChangesAsync();
            return driver;
        }

        public async Task<bool> ExistsAsync(Guid id)
        {
            return await _context.Drivers.AnyAsync(d => d.Id == id);
        }
    }
}