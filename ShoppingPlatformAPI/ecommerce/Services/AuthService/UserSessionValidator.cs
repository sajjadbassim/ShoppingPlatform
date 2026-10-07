using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ecommerce.Services.AuthService
{
    // يتحقق مع كل طلب أن توكن الدخول ما زال صالحاً: الحساب مفعّل ونسخة التوكن هي الحالية.
    // الحالة تُخزَّن مؤقتاً 30 ثانية، وتُمسح فوراً عند تغييرها (UserSessionInterceptor)
    public interface IUserSessionValidator
    {
        Task<bool> IsCurrentAsync(Guid userId, int tokenVersion, CancellationToken ct = default);
        void Invalidate(Guid userId);
    }

    public class UserSessionValidator : IUserSessionValidator
    {
        public const string VersionClaim = "tv";
        private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

        private readonly IMemoryCache _cache;
        private readonly IServiceScopeFactory _scopes;

        public UserSessionValidator(IMemoryCache cache, IServiceScopeFactory scopes)
        {
            _cache = cache;
            _scopes = scopes;
        }

        private sealed record SessionState(bool IsActive, int TokenVersion);

        private static string Key(Guid userId) => $"user-session:{userId}";

        public async Task<bool> IsCurrentAsync(Guid userId, int tokenVersion, CancellationToken ct = default)
        {
            var state = await _cache.GetOrCreateAsync(Key(userId), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                using var scope = _scopes.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                return await context.Users.AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => new SessionState(u.IsActive, u.TokenVersion))
                    .FirstOrDefaultAsync(ct);
            });

            return state is { IsActive: true } && state.TokenVersion == tokenVersion;
        }

        public void Invalidate(Guid userId) => _cache.Remove(Key(userId));
    }
}
