using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ecommerce.Core.Models;
namespace ecommerce.Repositories
{
    public interface IVendorRepository
    {
        Task<Vendor> GetByIdAsync(Guid id);
        Task<IEnumerable<Vendor>> GetAllAsync(bool onlyActive = true);
        Task<Vendor> GetByNameAsync(string name);
        Task<Vendor> GetByPhoneAsync(string phone);
        Task<Vendor> GetByOwnerIdAsync(Guid ownerId);

        Task<Vendor> CreateAsync(Vendor vendor);
        Task<Vendor> UpdateAsync(Vendor vendor);
        Task<bool> DeleteAsync(Guid id);

        Task<bool> ExistsAsync(Guid id);
        Task<bool> ExistsByNameAsync(string name);

        // Pagination 
        Task<PagedResult<Vendor>> GetPagedAsync(
            string searchTerm = null,
            bool? onlyActive = null,
            int pageNumber = 1,
            int pageSize = 20
        );
    }
}
