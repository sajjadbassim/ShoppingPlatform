using ecommerce.Core.DTO.Common;
using ecommerce.Core.Models;
using System.Linq.Expressions;

namespace ecommerce.Repositories
{
    public interface IUserRepository
    {
        Task<User> GetByIdAsync(Guid id);
        Task<User> GetByPhoneAsync(string phone);
        Task<IEnumerable<User>> GetAllAsync();
        Task<IEnumerable<User>> GetByRoleAsync(string role);
        Task<User> CreateAsync(User user);
        Task<User> UpdateAsync(User user);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> ExistsAsync(string phone);

        //  Pagination
        Task<PagedResult<User>> GetPagedAsync(
            string role = null,
            string searchTerm = null,
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20);

        // صفحة مرتبة من المستخدمين المطابقين للشرط (للقراءة فقط)
        Task<List<User>> GetPagedAsync(
            Expression<Func<User, bool>>? predicate,
            PaginationParams pagination,
            CancellationToken ct = default);

        Task<int> CountAsync(Expression<Func<User, bool>>? predicate = null, CancellationToken ct = default);
    }
}
