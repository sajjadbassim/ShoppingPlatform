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
        // قفل الطلب حتى نهاية العملية (انظر OrderLock) — يُؤخذ قبل قراءة الطلب أو أجزائه
        Task<IAsyncDisposable> LockOrderAsync(Guid orderId);
        Task<IAsyncDisposable?> LockOrderOfSubOrderAsync(Guid subOrderId);
        Task<SubOrderItem> CreateItemAsync(SubOrderItem item);
        Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetPagedAsync(
          int pageNumber, int pageSize, string? status);
        Task<OpsDashboardStatsDto> GetDashboardStatsAsync();
        Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetByDriverAsync(
        Guid driverId, int pageNumber, int pageSize, string? filter);

        Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId);
        // نصيب كل طلب فرعي من خصم طلبه (كوبون/نقاط) — لكل الطلبات الفرعية للطلبات المعطاة
        Task<Dictionary<Guid, decimal>> GetDiscountSharesAsync(IEnumerable<Guid> orderIds);
        // هل مع السائق طلب «في الطريق» غير المستثنى؟ (لتحديد هل يعود متاحاً)
        // بضاعة الجزء الفاشل مع السائق في طريقها للمتجر
        Task<bool> HasOpenReturnTripAsync(Guid subOrderId);
        // معه أجزاء «في الطريق» من طلب آخر غير هذا
        Task<bool> HasActiveDeliveryAsync(Guid driverId, Guid? exceptSubOrderId = null);



    }
}
