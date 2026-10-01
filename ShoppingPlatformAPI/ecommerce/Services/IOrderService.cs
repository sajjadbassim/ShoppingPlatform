using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Order;

namespace ecommerce.Services
{
    public interface IOrderService
    {
        Task<OrderResponseDto> CreateOrderFromCartAsync(Guid userId, CreateOrderDto dto);
        Task<OrderResponseDto> GetOrderByIdAsync(Guid orderId);
        Task<Dictionary<string, int>> GetStatusCountsAsync();
        Task<OrderResponseDto> GetOrderByNumberAsync(string orderNumber);
        Task<IEnumerable<OrderResponseDto>> GetCustomerOrdersAsync(Guid customerId);

        Task<PagedResponse<OrderResponseDto>> GetPagedAsync(
        PaginationParams pagination,
        Guid? customerId = null,
        string orderNumber = null,
        string status = null);

        Task<OrderTrackingDto> GetOrderTrackingAsync(Guid orderId, Guid customerId, bool isAdmin = false);
        Task<OrderResponseDto> CancelOrderAsync(Guid orderId, Guid customerId, CancelOrderDto dto);

    }
}
