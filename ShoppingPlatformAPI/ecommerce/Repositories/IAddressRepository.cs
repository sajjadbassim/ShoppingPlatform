using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IAddressRepository
    {
        Task<Address> GetByIdAsync(Guid id);
        Task<IEnumerable<Address>> GetByUserIdAsync(Guid userId);
        Task<Address> GetDefaultByUserIdAsync(Guid userId);
        Task<IEnumerable<Address>> GetAllAsync();

        Task<Address> CreateAsync(Address address);
        Task<Address> UpdateAsync(Address address);
        Task<bool> DeleteAsync(Guid id);

        Task<bool> ExistsAsync(Guid id);
    }
}
