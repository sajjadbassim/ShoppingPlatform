using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IOrderRepository
    {
        Task<Order> GetByIdAsync(Guid id);
        Task<Order> GetByOrderNumberAsync(string orderNumber);
        Task<IEnumerable<Order>> GetByCustomerAsync(Guid customerId);
        Task<Order> CreateAsync(Order order);
        Task<Order> UpdateAsync(Order order);
        Task<string> GenerateOrderNumberAsync();


        Task<PagedResult<Order>> GetPagedAsync(
        Guid? customerId,
        string orderNumber,
        string status,
        int pageNumber,
        int pageSize);
        }
}
