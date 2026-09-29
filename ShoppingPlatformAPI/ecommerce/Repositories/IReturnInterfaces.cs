using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IReturnRepository
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<Return?> GetByIdAsync(Guid id);
        Task<Return?> GetByIdWithDetailsAsync(Guid id);
        Task<Return?> GetByReturnNumberAsync(string returnNumber);
        Task<Return> CreateAsync(Return returnRequest);
        Task<Return> UpdateAsync(Return returnRequest);

        // ===================================
        // جلب وفلترة
        // ===================================
        Task<IEnumerable<Return>> GetByCustomerAsync(Guid customerId);
        Task<(IEnumerable<Return> Returns, int TotalCount)> GetPagedAsync(
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20);

        // ===================================
        // Validation
        // ===================================
        Task<bool> HasActiveReturnForOrderAsync(Guid orderId);
        Task<bool> IsWithinReturnWindowAsync(Guid orderId, int returnWindowDays = 14);

        // ===================================
        // Images
        // ===================================
        Task AddImagesAsync(List<ReturnImage> images);

        // ===================================
        // Helper
        // ===================================
        Task<string> GenerateReturnNumberAsync();

        // ===================================
        // إعادة المخزون
        // ===================================
        Task<Return?> GetByIdWithItemsAsync(Guid id, CancellationToken ct = default);

        // تعليم ذري: يُرجع false إذا كان الطلب مُعلَّماً مسبقاً (مثلاً ضغطتان متزامنتان)
        Task<bool> TryMarkRestockedAsync(Guid id, Guid restockedBy, CancellationToken ct = default);
    }
}
