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
        Task<Driver> CreateAsync(Driver driver);
        Task<Driver> UpdateAsync(Driver driver);
        Task<bool> ExistsAsync(Guid id);
    }
}