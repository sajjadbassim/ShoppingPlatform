using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public interface IRefreshTokenRepository
    {
        Task AddAsync(RefreshToken token);
        Task<RefreshToken?> GetByHashAsync(string tokenHash);
        Task RevokeAllForUserAsync(Guid userId, DateTime at);
        // حذف رموز المستخدم المنتهية أو المُبطلة منذ مدة — حتى لا يكبر الجدول مع كل تجديد
        Task PruneAsync(Guid userId, DateTime olderThan);
        Task SaveChangesAsync();
    }

    public class RefreshTokenRepository : IRefreshTokenRepository
    {
        private readonly AppDbContext _context;

        public RefreshTokenRepository(AppDbContext context) => _context = context;

        public async Task AddAsync(RefreshToken token)
        {
            _context.RefreshTokens.Add(token);
            await _context.SaveChangesAsync();
        }

        public Task<RefreshToken?> GetByHashAsync(string tokenHash) =>
            _context.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        public async Task RevokeAllForUserAsync(Guid userId, DateTime at)
        {
            var active = await _context.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync();
            foreach (var token in active) token.RevokedAt = at;
            await _context.SaveChangesAsync();
        }

        public async Task PruneAsync(Guid userId, DateTime olderThan)
        {
            var stale = await _context.RefreshTokens
                .Where(t => t.UserId == userId && (t.ExpiresAt < olderThan || t.RevokedAt < olderThan))
                .ToListAsync();
            _context.RefreshTokens.RemoveRange(stale);
        }

        public Task SaveChangesAsync() => _context.SaveChangesAsync();
    }
}
