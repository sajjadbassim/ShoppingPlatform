using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public interface IFacebookRepository
    {
        // المتجر الذي يملكه المستخدم (null إن لم يكن صاحب متجر)
        Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default);

        // متتبَّع — للتعديل ثم الحفظ عبر IUnitOfWork
        Task<FacebookConnection?> GetConnectionAsync(Guid vendorId, bool includeMedia, CancellationToken ct = default);
        Task<List<FacebookConnection>> GetConnectionsByFacebookUserAsync(string facebookUserId, CancellationToken ct = default);

        // بدون تتبّع — تُستدعى قبل أخذ قفل المزامنة، ثم يُحمَّل الحساب بعده بحالته الحالية
        Task<bool> ConnectionExistsAsync(Guid vendorId, CancellationToken ct = default);
        // onlyVisible: المعروضة للعامة فقط. vendorId: متجر محدد. fullList: يُقاس بآخر مزامنة كاملة
        Task<List<Guid>> GetVendorsDueForSyncAsync(DateTime syncedBefore, int take, bool onlyVisible, Guid? vendorId = null, bool fullList = false, CancellationToken ct = default);

        Task AddConnectionAsync(FacebookConnection connection, CancellationToken ct = default);
        void RemoveConnection(FacebookConnection connection);
        void AddMedia(FacebookMedia media);

        // للقراءة فقط — العرض العام
        Task<FacebookConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default);
        // منشورات كل المتاجر الظاهرة (صفحة ريلز)، الأحدث أولاً
        Task<List<FacebookMedia>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default);

        Task AddStateAsync(FacebookOAuthState state, CancellationToken ct = default);
        Task<FacebookOAuthState?> GetStateAsync(string state, CancellationToken ct = default);
        void RemoveState(FacebookOAuthState state);
        Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default);

        Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default);
    }

    public class FacebookRepository : IFacebookRepository
    {
        private readonly AppDbContext _context;

        public FacebookRepository(AppDbContext context) => _context = context;

        public async Task<Guid?> GetVendorIdByOwnerAsync(Guid userId, CancellationToken ct = default) =>
            // صاحب المتجر أو موظف فيه (صلاحية «ربط الحسابات» يفرضها StaffPermissionFilter)
            await ecommerce.Core.Constants.VendorMembership.VendorIdOfAsync(_context, userId, ct);

        public Task<FacebookConnection?> GetConnectionAsync(Guid vendorId, bool includeMedia, CancellationToken ct = default)
        {
            IQueryable<FacebookConnection> query = _context.Set<FacebookConnection>();
            if (includeMedia)
                query = query.Include(c => c.Media).ThenInclude(m => m.Product!).ThenInclude(p => p.Images).AsSplitQuery();
            return query.FirstOrDefaultAsync(c => c.VendorId == vendorId, ct);
        }

        public Task<List<FacebookConnection>> GetConnectionsByFacebookUserAsync(string facebookUserId, CancellationToken ct = default) =>
            _context.Set<FacebookConnection>().Where(c => c.FacebookUserId == facebookUserId).ToListAsync(ct);

        public Task<bool> ConnectionExistsAsync(Guid vendorId, CancellationToken ct = default) =>
            _context.Set<FacebookConnection>().AnyAsync(c => c.VendorId == vendorId, ct);

        public Task<List<Guid>> GetVendorsDueForSyncAsync(DateTime syncedBefore, int take, bool onlyVisible, Guid? vendorId = null, bool fullList = false, CancellationToken ct = default) =>
            _context.Set<FacebookConnection>()
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

        public async Task AddConnectionAsync(FacebookConnection connection, CancellationToken ct = default) =>
            await _context.Set<FacebookConnection>().AddAsync(connection, ct);

        public void RemoveConnection(FacebookConnection connection) =>
            _context.Set<FacebookConnection>().Remove(connection);

        public void AddMedia(FacebookMedia media) =>
            _context.Set<FacebookMedia>().Add(media);

        public Task<FacebookConnection?> GetPublicConnectionAsync(Guid vendorId, CancellationToken ct = default) =>
            _context.Set<FacebookConnection>()
                .AsNoTracking()
                .Include(c => c.Media.Where(m => !m.IsHidden && !m.IsRemoved))
                    .ThenInclude(m => m.Product!)
                    .ThenInclude(p => p.Images)
                .AsSplitQuery()
                .FirstOrDefaultAsync(c => c.VendorId == vendorId && c.ShowOnStore && !c.NeedsReconnect && c.Vendor.IsActive, ct);

        public Task<List<FacebookMedia>> GetPublicReelsAsync(int skip, int take, CancellationToken ct = default) =>
            _context.Set<FacebookMedia>()
                .AsNoTracking()
                .Where(m => !m.IsHidden && !m.IsRemoved
                            // فيديو بلا رابط تشغيل لا يُعرض في ريلز — يبقى في صفحة المتجر برابط فيسبوك
                            && (m.MediaType != FacebookMedia.TypeVideo || m.MediaUrl != null)
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

        public async Task AddStateAsync(FacebookOAuthState state, CancellationToken ct = default) =>
            await _context.Set<FacebookOAuthState>().AddAsync(state, ct);

        public Task<FacebookOAuthState?> GetStateAsync(string state, CancellationToken ct = default) =>
            _context.Set<FacebookOAuthState>().FirstOrDefaultAsync(s => s.State == state, ct);

        public void RemoveState(FacebookOAuthState state) =>
            _context.Set<FacebookOAuthState>().Remove(state);

        public Task<int> DeleteExpiredStatesAsync(DateTime now, CancellationToken ct = default) =>
            _context.Set<FacebookOAuthState>().Where(s => s.ExpiresAt < now).ExecuteDeleteAsync(ct);

        public Task<bool> ProductBelongsToVendorAsync(Guid productId, Guid vendorId, CancellationToken ct = default) =>
            _context.Products.AnyAsync(p => p.Id == productId && p.VendorId == vendorId && p.IsActive, ct);
    }
}
