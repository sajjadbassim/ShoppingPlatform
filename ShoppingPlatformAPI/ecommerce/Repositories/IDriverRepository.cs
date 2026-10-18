using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IDriverRepository
    {
        Task<Driver?> GetByIdAsync(Guid id);
        Task<Driver?> GetByPhoneAsync(string phone);
        Task<(IEnumerable<Driver> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? status, string? workStatus);
        Task<IEnumerable<Driver>> GetAvailableDriversAsync();
        Task<Dictionary<Guid, int>> GetActiveOrderCountsAsync(IEnumerable<Guid> driverIds);
        Task<Driver> CreateAsync(Driver driver);
        Task<Driver> UpdateAsync(Driver driver);
        // قفل السائق حتى نهاية العملية: تعيينان متزامنان لنفس السائق لا ينجحان معاً
        Task<IAsyncDisposable> LockAsync(Guid driverId);
        Task<bool> ExistsAsync(Guid id);
    }
}