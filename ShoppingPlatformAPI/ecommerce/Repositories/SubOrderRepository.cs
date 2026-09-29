using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class SubOrderRepository : ISubOrderRepository
    {
        private readonly AppDbContext _context;

        public SubOrderRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<SubOrder> GetByIdAsync(Guid id)
        {
            return await _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Driver)
                .Include(so => so.ConfirmedByUser)
                .Include(so => so.CancelledByUser)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(so => so.Id == id);
        }

        public async Task<IEnumerable<SubOrder>> GetByOrderIdAsync(Guid orderId)
        {
            return await _context.SubOrders
                .Include(so => so.Vendor)
                .Include(so => so.Driver)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.OrderId == orderId)
                .OrderBy(so => so.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<SubOrder>> GetPendingSubOrdersAsync()
        {
            return await _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.Status == SubOrderStatus.PendingConfirmation)
                .OrderBy(so => so.ConfirmationDeadline)
                .ToListAsync();
        }

        public async Task<SubOrder> CreateAsync(SubOrder subOrder)
        {
            subOrder.CreatedAt = DateTime.UtcNow;
            subOrder.UpdatedAt = DateTime.UtcNow;
            await _context.SubOrders.AddAsync(subOrder);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(subOrder.Id);
        }

        public async Task<SubOrder> UpdateAsync(SubOrder subOrder)
        {
            subOrder.UpdatedAt = DateTime.UtcNow;
            _context.SubOrders.Update(subOrder);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(subOrder.Id);
        }

        public async Task<SubOrderItem> CreateItemAsync(SubOrderItem item)
        {
            item.CreatedAt = DateTime.UtcNow;
            await _context.SubOrderItems.AddAsync(item);
            await _context.SaveChangesAsync();
            return item;
        }

        public async Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? status)
        {
            var query = _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(so => so.Status == status);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<OpsDashboardStatsDto> GetDashboardStatsAsync()
        {
            var today = DateTime.UtcNow.Date;
            var subOrders = await _context.SubOrders
                .Where(so => so.CreatedAt.Date == today)
                .ToListAsync();

            return new OpsDashboardStatsDto
            {
                PendingConfirmation = subOrders.Count(so => so.Status == OrderStatus.PENDING_CONFIRMATION),
                Confirmed = subOrders.Count(so => so.Status == OrderStatus.CONFIRMED),
                PartiallyConfirmed = subOrders.Count(so => so.Status == OrderStatus.PARTIALLY_CONFIRMED),
                Preparing = subOrders.Count(so => so.Status == OrderStatus.PREPARING),
                OutForDelivery = subOrders.Count(so => so.Status == OrderStatus.OUT_FOR_DELIVERY),
                Delivered = subOrders.Count(so => so.Status == OrderStatus.DELIVERED),
                Cancelled = subOrders.Count(so => so.Status == OrderStatus.CANCELLED),
                TotalToday = subOrders.Count
            };
        }

        public async Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetByDriverAsync(
            Guid driverId, int pageNumber, int pageSize, string? filter)
        {
            var query = _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.DriverId == driverId)
                .AsQueryable();

            if (filter == "active")
                query = query.Where(so =>
                    so.Status != OrderStatus.DELIVERED &&
                    so.Status != OrderStatus.CANCELLED);
            else if (filter == "completed")
                query = query.Where(so =>
                    so.Status == OrderStatus.DELIVERED ||
                    so.Status == OrderStatus.CANCELLED);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId);
            if (driver == null) throw new Exception("السائق غير موجود");

            var today = DateTime.UtcNow.Date;
            var weekStart = today.AddDays(-(int)today.DayOfWeek);
            var monthStart = new DateTime(today.Year, today.Month, 1);

            var allOrders = await _context.SubOrders
                .Where(so => so.DriverId == driverId)
                .ToListAsync();

            var totalDeliveries = allOrders.Count(so => so.Status == OrderStatus.DELIVERED);
            var totalCancelled = allOrders.Count(so => so.Status == OrderStatus.CANCELLED);
            var total = totalDeliveries + totalCancelled;

            return new DriverStatsDto
            {
                DriverId = driver.Id,
                DriverName = driver.FullName,
                WorkStatus = driver.WorkStatus,
                Rating = driver.Rating,
                TotalDeliveries = totalDeliveries,
                TotalCancelled = totalCancelled,
                SuccessRate = total > 0 ? Math.Round((decimal)totalDeliveries / total * 100, 1) : 0,
                DeliveriesToday = allOrders.Count(so => so.Status == OrderStatus.DELIVERED && so.UpdatedAt.Date == today),
                CancelledToday = allOrders.Count(so => so.Status == OrderStatus.CANCELLED && so.UpdatedAt.Date == today),
                DeliveriesThisWeek = allOrders.Count(so => so.Status == OrderStatus.DELIVERED && so.UpdatedAt.Date >= weekStart),
                DeliveriesThisMonth = allOrders.Count(so => so.Status == OrderStatus.DELIVERED && so.UpdatedAt.Date >= monthStart),
                ActiveOrders = allOrders.Count(so => so.Status == OrderStatus.OUT_FOR_DELIVERY),
            };
        }
    }
}