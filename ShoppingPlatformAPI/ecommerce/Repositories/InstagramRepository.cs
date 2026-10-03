using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public interface IInstagramRepository
    {
        // المتجر الذي يملكه المستخدم (null إن لم يكن صاحب متجر)
        Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default);

        // متتبَّع — للتعديل ثم الحفظ عبر IUnitOfWork
        Task<InstagramConnection?> GetConnectionAsync(Guid vendorId, bool includeMedia, CancellationToken ct = default);
        Task<List<InstagramConnection>> GetConnectionsByInstagramUserAsync(string instagramUserId, CancellationToken ct = default);

        // بدون تتبّع — تُستدعى قبل أخذ قفل المزامنة، ثم يُحمَّل الحساب بعده بحالته الحالية
        Task<bool> ConnectionExistsAsync(Guid vendorId, CancellationToken ct = default);
        // onlyVisible: الحسابات المعروضة للعامة فقط. vendorId: متجر محدد.
        // fullList: يُقاس بآخر مزامنة كاملة (الدورية) بدل آخر مزامنة من أي نوع
        Task<List<Guid>> GetVendorsDueForSyncAsync(DateTime syncedBefore, int take, bool onlyVisible, Guid? vendorId = null, bool fullList = false, CancellationToken ct = default);

        Task AddConnectionAsync(InstagramConnection connection, CancellationToken ct = default);
        void RemoveConnection(InstagramConnection connection);
        void AddMedia(InstagramMedia media);

        // للقراءة فقط — العرض العام
        Task<InstagramConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default);
        // منشورات كل المتاجر الظاهرة (صفحة ريلز): صور وألبومات وفيديوهات قابلة للتشغيل، الأحدث أولاً
        Task<List<InstagramMedia>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default);

        Task AddStateAsync(InstagramOAuthState state, CancellationToken ct = default);
        Task<InstagramOAuthState?> GetStateAsync(string state, CancellationToken ct = default);
        void RemoveState(InstagramOAuthState state);
        Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default);

        Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default);
    }

    public class InstagramRepository : IInstagramRepository
    {
        private readonly AppDbContext _context;

        public InstagramRepository(AppDbContext context) => _context = context;

        public async Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default) =>
            await _context.Vendors
                .Where(v => v.OwnerId == userId)
                .Select(v => (Guid?)v.Id)
                .FirstOrDefaultAsync(ct);

        public Task<InstagramConnection?> GetConnectionAsync(Guid vendorId, bool includeMedia, CancellationToken ct = default)
        {
            IQueryable<InstagramConnection> query = _context.Set<InstagramConnection>();
            if (includeMedia)
                query = query.Include(c => c.Media).ThenInclude(m => m.Product!).ThenInclude(p => p.Images).AsSplitQuery();
            return query.FirstOrDefaultAsync(c => c.VendorId == vendorId, ct);
        }

        public Task<List<InstagramConnection>> GetConnectionsByInstagramUserAsync(string instagramUserId, CancellationToken ct = default) =>
            _context.Set<InstagramConnection>()
                .Where(c => c.InstagramUserId == instagramUserId || c.AccountId == instagramUserId)
                .ToListAsync(ct);

        public Task<bool> ConnectionExistsAsync(Guid vendorId, CancellationToken ct = default) =>
            _context.Set<InstagramConnection>().AnyAsync(c => c.VendorId == vendorId, ct);

        public Task<List<Guid>> GetVendorsDueForSyncAsync(DateTime syncedBefore, int take, bool onlyVisible, Guid? vendorId = null, bool fullList = false, CancellationToken ct = default) =>
            _context.Set<InstagramConnection>()
                .Where(c => !c.NeedsReconnect)
                .Where(c => fullList
                    ? c.LastFullSyncedAt == null || c.LastFullSyncedAt < syncedBefore
                    : c.LastSyncedAt == null || c.LastSyncedAt < syncedBefore)
                .Where(c => !onlyVisible || (c.ShowOnStore && c.Vendor.IsActive))
                .Where(c => vendorId == null || c.VendorId == vendorId)
                .OrderBy(c => fullList ? c.LastFullSyncedAt : c.LastSyncedAt)
                .Take(take)
                .Select(c => c.VendorId)
                .ToListAsync(ct);

        public async Task AddConnectionAsync(InstagramConnection connection, CancellationToken ct = default) =>
            await _context.Set<InstagramConnection>().AddAsync(connection, ct);

        public void RemoveConnection(InstagramConnection connection) =>
            _context.Set<InstagramConnection>().Remove(connection);

        public void AddMedia(InstagramMedia media) =>
            _context.Set<InstagramMedia>().Add(media);

        public Task<InstagramConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default) =>
            _context.Set<InstagramConnection>()
                .AsNoTracking()
                .Include(c => c.Media.Where(m => !m.IsHidden && !m.IsRemoved))
                    .ThenInclude(m => m.Product!)
                    .ThenInclude(p => p.Images)
                .AsSplitQuery()
                .FirstOrDefaultAsync(c => c.VendorId == vendorId && c.ShowOnStore && !c.NeedsReconnect && c.Vendor.IsActive, ct);

        public Task<List<InstagramMedia>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default) =>
            _context.Set<InstagramMedia>()
                .AsNoTracking()
                .Where(m => !m.IsHidden && !m.IsRemoved
                            // فيديو بلا رابط تشغيل (موسيقى محمية) لا يُعرض في ريلز — يبقى في صفحة المتجر برابط إنستغرام
                            && (m.MediaType != InstagramMedia.TypeVideo || m.MediaUrl != null)
                            && m.Connection.ShowOnStore && !m.Connection.NeedsReconnect
                            && m.Connection.Vendor.IsActive)
                .OrderByDescending(m => m.PublishedAt)
                .ThenBy(m => m.Id)
                .Skip(skip)
                .Take(take)
                .Include(m => m.Connection).ThenInclude(c => c.Vendor)
                .Include(m => m.Product!).ThenInclude(p => p.Images)
                .AsSplitQuery()
                .ToListAsync(ct);

        public async Task AddStateAsync(InstagramOAuthState state, CancellationToken ct = default) =>
            await _context.Set<InstagramOAuthState>().AddAsync(state, ct);

        public Task<InstagramOAuthState?> GetStateAsync(string state, CancellationToken ct = default) =>
            _context.Set<InstagramOAuthState>().FirstOrDefaultAsync(s => s.State == state, ct);

        public void RemoveState(InstagramOAuthState state) =>
            _context.Set<InstagramOAuthState>().Remove(state);

        public Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default) =>
            _context.Set<InstagramOAuthState>().Where(s => s.ExpiresAt < now).ExecuteDeleteAsync(ct);

        public Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default) =>
            _context.Products.AnyAsync(p => p.Id == productId && p.VendorId == vendorId && p.IsActive, ct);
    }
}
