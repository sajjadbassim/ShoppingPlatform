using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface ISubOrderRepository
    {
        Task<SubOrder> GetByIdAsync(Guid id);
        Task<IEnumerable<SubOrder>> GetByOrderIdAsync(Guid orderId);
        Task<IEnumerable<SubOrder>> GetPendingSubOrdersAsync();
        Task<SubOrder> CreateAsync(SubOrder subOrder);
        Task<SubOrder> UpdateAsync(SubOrder subOrder);
        Task<SubOrderItem> CreateItemAsync(SubOrderItem item);
        Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetPagedAsync(
          int pageNumber, int pageSize, string? status);
        Task<OpsDashboardStatsDto> GetDashboardStatsAsync();
        Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetByDriverAsync(
        Guid driverId, int pageNumber, int pageSize, string? filter);

        Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId);



    }
}
