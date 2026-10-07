using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;

namespace ecommerce.Services
{
    public interface IVendorDashboardService
    {
        // ===================================
        // الداشبورد الرئيسي
        // ===================================
        Task<VendorDashboardDto> GetDashboardAsync(Guid vendorId);

        // ===================================
        // إحصائيات المبيعات
        // ===================================
        Task<VendorSalesStatsDto> GetSalesStatsAsync(Guid vendorId, string period = "month", DateTime? from = null, DateTime? to = null);

        // ===================================
        // طلبات البائع
        // ===================================
        Task<PagedResponse<VendorOrderDto>> GetOrdersAsync(
            Guid vendorId,
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null);

        Task<VendorOrderDto> GetOrderByIdAsync(Guid vendorId, Guid subOrderId);
        Task<VendorOrderCountsDto> GetOrderCountsAsync(Guid vendorId);
        Task<List<VendorProductSalesDto>> GetProductSalesAsync(Guid vendorId);
        Task<PagedResponse<VendorReviewFeedDto>> GetReviewsFeedAsync(Guid vendorId, bool unanswered = false, int? rating = null, int pageNumber = 1, int pageSize = 20);
        Task<int> CountUnansweredReviewsAsync(Guid vendorId);

        // ===================================
        // تأكيد / رفض الطلب
        // ===================================
        Task<VendorOrderDto> ConfirmOrderAsync(Guid vendorId, Guid subOrderId, Guid opsUserId,
            IReadOnlyList<UnavailableItemDto>? unavailable = null);
        Task<VendorOrderDto> StartPreparingAsync(Guid vendorId, Guid subOrderId, Guid userId);
        Task<VendorOrderDto> MarkReadyAsync(Guid vendorId, Guid subOrderId, Guid userId);
        Task<VendorOrderDto> RejectOrderAsync(Guid vendorId, Guid subOrderId, Guid opsUserId, string reason);

        // ===================================
        // منتجات البائع مع إحصائيات
        // ===================================
        Task<PagedResponse<VendorProductStatsDto>> GetProductsWithStatsAsync(
            Guid vendorId,
            int pageNumber = 1,
            int pageSize = 20);
    }
}