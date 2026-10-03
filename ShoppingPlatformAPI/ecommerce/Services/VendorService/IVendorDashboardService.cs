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
        Task<VendorSalesStatsDto> GetSalesStatsAsync(Guid vendorId, string period = "month");

        // ===================================
        // طلبات البائع
        // ===================================
        Task<PagedResponse<VendorOrderDto>> GetOrdersAsync(
            Guid vendorId,
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20);

        Task<VendorOrderDto> GetOrderByIdAsync(Guid vendorId, Guid subOrderId);

        // ===================================
        // تأكيد / رفض الطلب
        // ===================================
        Task<VendorOrderDto> ConfirmOrderAsync(Guid vendorId, Guid subOrderId, Guid opsUserId);
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