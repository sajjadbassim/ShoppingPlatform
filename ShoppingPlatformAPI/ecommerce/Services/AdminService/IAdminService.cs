using ecommerce.Core.DTO.Admin;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Core.DTO.Users;
using ecommerce.Core.DTO.Vendor;

namespace ecommerce.Services.AdminService
{
    public interface IAdminService
    {
        // Dashboard
        Task<DashboardStatsDto> GetDashboardStatsAsync();

        // User Management
        Task<IEnumerable<UserManagementDto>> GetAllUsersAsync(string role = null);
        Task<Common.PagedResponse<UserSearchResponseDto>> SearchUsersAsync(string? term, string? role, PaginationParams pagination, CancellationToken ct = default);
        Task<UserResponseDto> CreateOpsUserAsync(CreateOpsUserDto dto);
        Task<bool> ToggleUserStatusAsync(Guid userId);
        Task<bool> DeleteUserAsync(Guid userId);

        // Vendor Management
        Task<IEnumerable<VendorResponseDto>> GetAllVendorsAsync(bool? isActive = null);
        Task<bool> ToggleVendorStatusAsync(Guid vendorId);

        // Product Management
        Task<IEnumerable<ProductDto>> GetAllProductsAsync(bool? isActive = null);
        Task<bool> ToggleProductStatusAsync(Guid productId);
        Task<bool> BulkUpdateProductsStatusAsync(List<Guid> productIds, bool isActive);

        // Reports
        Task<object> GetSalesReportAsync(DateTime startDate, DateTime endDate);
        Task<object> GetTopVendorsAsync(int count = 10);
        Task<object> GetTopProductsAsync(int count = 10);

        Task<string> ChangeUserRoleAsync(Guid userId, string newRole);
    }
}
