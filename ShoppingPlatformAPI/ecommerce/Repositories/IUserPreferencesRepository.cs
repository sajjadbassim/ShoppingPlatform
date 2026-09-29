using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IUserPreferencesRepository
    {
        // متتبَّع — للتعديل ثم الحفظ عبر IUnitOfWork
        Task<UserPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct = default);

        // للقراءة فقط
        Task<List<UserPreferences>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct = default);

        Task AddAsync(UserPreferences preferences, CancellationToken ct = default);
    }
}
