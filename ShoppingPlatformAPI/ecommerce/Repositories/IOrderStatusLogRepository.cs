using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IOrderStatusLogRepository
    {
        Task<OrderStatusLog> CreateAsync(OrderStatusLog log);
        Task<IEnumerable<OrderStatusLog>> GetByOrderIdAsync(Guid orderId);
        Task<IEnumerable<OrderStatusLog>> GetBySubOrderIdAsync(Guid subOrderId);
    }
}
