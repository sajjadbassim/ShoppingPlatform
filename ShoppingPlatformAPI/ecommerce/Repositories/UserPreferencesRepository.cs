using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class UserPreferencesRepository : IUserPreferencesRepository
    {
        private readonly AppDbContext _context;

        public UserPreferencesRepository(AppDbContext context)
        {
            _context = context;
        }

        public Task<UserPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
            _context.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId, ct);

        public async Task<List<UserPreferences>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct = default)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return new List<UserPreferences>();

            return await _context.UserPreferences
                .AsNoTracking()
                .Where(p => ids.Contains(p.UserId))
                .ToListAsync(ct);
        }

        public async Task AddAsync(UserPreferences preferences, CancellationToken ct = default) =>
            await _context.UserPreferences.AddAsync(preferences, ct);
    }
}
