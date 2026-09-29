using ecommerce.Core.DTO.Ops;
using ecommerce.Core.DTO.Order;

namespace ecommerce.Services
{
        public interface IOpsService
        {
            Task<IEnumerable<PendingSubOrderDto>> GetPendingSubOrdersAsync();
            Task<SubOrderDto> GetSubOrderDetailsAsync(Guid subOrderId);
            Task<SubOrderDto> ConfirmSubOrderAsync(Guid subOrderId, ConfirmSubOrderDto dto);
            Task<SubOrderDto> CancelSubOrderAsync(Guid subOrderId, CancelSubOrderDto dto);
            Task<SubOrderDto> UpdateSubOrderStatusAsync(Guid subOrderId, UpdateSubOrderStatusDto dto);
            Task<SubOrdersPagedResultDto> GetSubOrdersPagedAsync(
    int pageNumber, int pageSize, string? status);

        Task<OpsDashboardStatsDto> GetDashboardStatsAsync();

        Task<SubOrderDto> AssignDriverAsync(Guid subOrderId, AssignDriverDto dto);
        Task<IEnumerable<SubOrderDto>> AssignDriverToOrderAsync(Guid orderId, AssignDriverToOrderDto dto);
    }

}
