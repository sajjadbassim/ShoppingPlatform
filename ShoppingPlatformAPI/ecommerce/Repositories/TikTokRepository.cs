using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public interface ITikTokRepository
    {
        // المتجر الذي يملكه المستخدم (null إن لم يكن صاحب متجر)
        Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default);

        // متتبَّع — للتعديل ثم الحفظ عبر IUnitOfWork
        Task<TikTokConnection?> GetConnectionAsync(Guid vendorId, bool includeVideos, CancellationToken ct = default);
        // onlyVisible: الحسابات المعروضة للعامة فقط (لتحديث صفحة ريلز)
        Task<List<TikTokConnection>> GetConnectionsDueForSyncAsync(DateTime syncedBefore, int take, CancellationToken ct = default, bool onlyVisible = false);
        Task AddConnectionAsync(TikTokConnection connection, CancellationToken ct = default);
        void RemoveConnection(TikTokConnection connection);
        void AddVideo(TikTokVideo video);

        // للقراءة فقط — العرض العام في صفحة المتجر
        Task<TikTokConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default);

        // فيديوهات كل المتاجر الظاهرة للعامة، الأحدث أولاً — يُطلب عنصر زائد لمعرفة وجود صفحة تالية
        Task<List<TikTokVideo>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default);

        Task AddStateAsync(TikTokOAuthState state, CancellationToken ct = default);
        Task<TikTokOAuthState?> GetStateAsync(string state, CancellationToken ct = default);
        void RemoveState(TikTokOAuthState state);
        Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default);

        Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default);
    }

    public class TikTokRepository : ITikTokRepository
    {
        private readonly AppDbContext _context;

        public TikTokRepository(AppDbContext context) => _context = context;

        public async Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default) =>
            await _context.Vendors
                .Where(v => v.OwnerId == userId)
                .Select(v => (Guid?)v.Id)
                .FirstOrDefaultAsync(ct);

        public Task<TikTokConnection?> GetConnectionAsync(Guid vendorId, bool includeVideos, CancellationToken ct = default)
        {
            IQueryable<TikTokConnection> query = _context.Set<TikTokConnection>();
            if (includeVideos)
                query = query.Include(c => c.Videos).ThenInclude(v => v.Product!).ThenInclude(p => p.Images);
            return query.FirstOrDefaultAsync(c => c.VendorId == vendorId, ct);
        }

        public Task<List<TikTokConnection>> GetConnectionsDueForSyncAsync(DateTime syncedBefore, int take, CancellationToken ct = default, bool onlyVisible = false) =>
            _context.Set<TikTokConnection>()
                .Where(c => !c.NeedsReconnect && (c.LastSyncedAt == null || c.LastSyncedAt < syncedBefore))
                .Where(c => !onlyVisible || (c.ShowOnStore && c.Vendor.IsActive))
                .OrderBy(c => c.LastSyncedAt)
                .Take(take)
                .Include(c => c.Videos)
                .ToListAsync(ct);

        public async Task AddConnectionAsync(TikTokConnection connection, CancellationToken ct = default) =>
            await _context.Set<TikTokConnection>().AddAsync(connection, ct);

        public void RemoveConnection(TikTokConnection connection) =>
            _context.Set<TikTokConnection>().Remove(connection);

        public void AddVideo(TikTokVideo video) =>
            _context.Set<TikTokVideo>().Add(video);

        public Task<TikTokConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default) =>
            _context.Set<TikTokConnection>()
                .AsNoTracking()
                .Include(c => c.Videos.Where(v => !v.IsHidden && !v.IsRemoved))
                    .ThenInclude(v => v.Product!)
                    .ThenInclude(p => p.Images)
                .FirstOrDefaultAsync(c => c.VendorId == vendorId && c.ShowOnStore && !c.NeedsReconnect, ct);

        public async Task AddStateAsync(TikTokOAuthState state, CancellationToken ct = default) =>
            await _context.Set<TikTokOAuthState>().AddAsync(state, ct);

        public Task<TikTokOAuthState?> GetStateAsync(string state, CancellationToken ct = default) =>
            _context.Set<TikTokOAuthState>().FirstOrDefaultAsync(s => s.State == state, ct);

        public void RemoveState(TikTokOAuthState state) =>
            _context.Set<TikTokOAuthState>().Remove(state);

        public Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default) =>
            _context.Set<TikTokOAuthState>().Where(s => s.ExpiresAt < now).ExecuteDeleteAsync(ct);

        public Task<List<TikTokVideo>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default) =>
            _context.Set<TikTokVideo>()
                .AsNoTracking()
                .Where(v => !v.IsHidden && !v.IsRemoved
                            && v.Connection.ShowOnStore && !v.Connection.NeedsReconnect
                            && v.Connection.Vendor.IsActive)
                .OrderByDescending(v => v.PublishedAt)
                .ThenBy(v => v.Id)
                .Skip(skip)
                .Take(take)
                .Include(v => v.Connection).ThenInclude(c => c.Vendor)
                .Include(v => v.Product!).ThenInclude(p => p.Images)
                .AsSplitQuery()
                .ToListAsync(ct);

        public Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default) =>
            _context.Products.AnyAsync(p => p.Id == productId && p.VendorId == vendorId && p.IsActive, ct);
    }
}
