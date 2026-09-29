using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class OrderStatusLogRepository : IOrderStatusLogRepository
    {
        private readonly AppDbContext _context;

        public OrderStatusLogRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<OrderStatusLog> CreateAsync(OrderStatusLog log)
        {
            log.CreatedAt = DateTime.UtcNow;

            await _context.OrderStatusLogs.AddAsync(log);
            await _context.SaveChangesAsync();

            return log;
        }

        public async Task<IEnumerable<OrderStatusLog>> GetByOrderIdAsync(Guid orderId)
        {
            return await _context.OrderStatusLogs
                .Include(l => l.ChangedByUser)
                .Where(l => l.OrderId == orderId)
                .OrderBy(l => l.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<OrderStatusLog>> GetBySubOrderIdAsync(Guid subOrderId)
        {
            return await _context.OrderStatusLogs
                .Include(l => l.ChangedByUser)
                .Where(l => l.SubOrderId == subOrderId)
                .OrderBy(l => l.CreatedAt)
                .ToListAsync();
        }
    }
}
