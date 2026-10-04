using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using ecommerce.Core.DTO.Facebook;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.SocialFeedService;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.FacebookService
{
    // نتيجة العودة من فيسبوك: ربط مباشر، أو اختيار صفحة (SelectionId) إن كان التاجر يدير أكثر من صفحة
    public record FacebookConnectResult(bool Success, string? Reason = null, string? SelectionId = null)
    {
        public static FacebookConnectResult Ok() => new(true);
        public static FacebookConnectResult Choose(string selectionId) => new(true, null, selectionId);
        public static FacebookConnectResult Fail(string reason) => new(false, reason);
    }

    public record FacebookConnectStart(string AuthorizeUrl, string Nonce);

    public interface IFacebookService
    {
        Task<FacebookStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
        Task<FacebookConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default);
        Task<FacebookConnectResult> CompleteConnectAsync(string? code, string? state, string? nonce, string? error, CancellationToken ct = default);
        Task<List<FacebookPageOptionDto>> GetPendingPagesAsync(Guid userId, string selectionId, CancellationToken ct = default);
        Task<FacebookStatusDto> SelectPageAsync(Guid userId, FacebookSelectPageDto dto, CancellationToken ct = default);
        Task<FacebookStatusDto> SyncAsync(Guid userId, CancellationToken ct = default);
        Task<List<SocialFeedItemDto>> GetMediaAsync(Guid userId, CancellationToken ct = default);
        Task<SocialFeedItemDto> UpdateMediaAsync(Guid userId, Guid mediaId, SocialMediaUpdateDto dto, CancellationToken ct = default);
        Task<FacebookSettingsDto> UpdateSettingsAsync(Guid userId, FacebookSettingsUpdateDto dto, CancellationToken ct = default);
        Task DisconnectAsync(Guid userId, CancellationToken ct = default);

        // العرض العام
        Task RefreshStoreAsync(Guid vendorId, CancellationToken ct = default);
        Task RefreshVisibleAsync(CancellationToken ct = default);
        Task<int> SyncDueConnectionsAsync(CancellationToken ct = default);

        // طلبات Meta الموقّعة (signed_request)
        Task<bool> HandleDeauthorizeAsync(string? signedRequest, CancellationToken ct = default);
        Task<string?> HandleDataDeletionAsync(string? signedRequest, CancellationToken ct = default);
    }

    public class FacebookService : IFacebookService
    {
        private static readonly TimeSpan StateLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan SelectionLifetime = TimeSpan.FromMinutes(10);
        private const string SelectionCachePrefix = "facebook-page-selection:";

        // قفل لكل متجر تمر به كل عمليات المزامنة والربط والإلغاء — يمنع إدراج نفس المنشور مرتين.
        // يُنشأ فقط لمتجر ثبت أن له صفحة مربوطة
        private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> StoreLocks = new();
        private static readonly SemaphoreSlim VisibleRefreshGate = new(1, 1);
        private static readonly TimeSpan LockWaitLimit = TimeSpan.FromSeconds(20);
        private const int MaxStoresPerRefresh = 50;

        private readonly IFacebookRepository _repository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IFacebookApiClient _api;
        private readonly IFacebookTokenProtector _protector;
        private readonly IMemoryCache _cache;
        private readonly FacebookOptions _options;
        private readonly TimeProvider _time;
        private readonly ILogger<FacebookService> _logger;

        public FacebookService(
            IFacebookRepository repository,
            IUnitOfWork unitOfWork,
            IFacebookApiClient api,
            IFacebookTokenProtector protector,
            IMemoryCache cache,
            IOptions<FacebookOptions> options,
            TimeProvider time,
            ILogger<FacebookService> logger)
        {
            _repository = repository;
            _unitOfWork = unitOfWork;
            _api = api;
            _protector = protector;
            _cache = cache;
            _options = options.Value;
            _time = time;
            _logger = logger;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;
        private DateTime StaleBefore => Now - TimeSpan.FromSeconds(Math.Max(30, _options.StoreRefreshSeconds));
        private static SemaphoreSlim LockFor(Guid vendorId) => StoreLocks.GetOrAdd(vendorId, _ => new SemaphoreSlim(1, 1));

        // صفحات تنتظر اختيار التاجر بعد العودة من فيسبوك (توكن كل صفحة مشفّر)
        private sealed record PendingPage(string Id, string? Name, string? PictureUrl, string TokenProtected);
        private sealed record PendingSelection(Guid VendorId, string FacebookUserId, string Scopes, List<PendingPage> Pages);

        // ===================================
        // الحالة
        // ===================================
        public async Task<FacebookStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: false, ct);
            return MapStatus(connection);
        }

        // ===================================
        // الخطوة 1: إنشاء رابط التفويض
        // ===================================
        public async Task<FacebookConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default)
        {
            EnsureConfigured();
            var vendorId = await GetVendorIdAsync(userId, ct);

            var state = GenerateToken();
            var nonce = GenerateToken();

            await _repository.AddStateAsync(new FacebookOAuthState
            {
                State = state,
                VendorId = vendorId,
                NonceHash = Hash(nonce),
                CreatedAt = Now,
                ExpiresAt = Now.Add(StateLifetime)
            }, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return new FacebookConnectStart(_api.BuildAuthorizeUrl(state), nonce);
        }

        // ===================================
        // الخطوة 2: العودة من فيسبوك
        // ===================================
        public async Task<FacebookConnectResult> CompleteConnectAsync(
            string? code, string? state, string? nonce, string? error, CancellationToken ct = default)
        {
            var pending = string.IsNullOrEmpty(state) ? null : await _repository.GetStateAsync(state, ct);

            // state صالح لمرة واحدة: يُحذف فوراً مهما كانت النتيجة
            if (pending != null)
            {
                _repository.RemoveState(pending);
                await _unitOfWork.SaveChangesAsync(ct);
            }

            if (!string.IsNullOrEmpty(error))
            {
                _logger.LogInformation("Facebook authorization not granted: {Error}", error);
                return FacebookConnectResult.Fail("denied");
            }

            if (string.IsNullOrEmpty(code) || pending == null)
                return FacebookConnectResult.Fail("invalid_state");

            if (pending.ExpiresAt < Now)
                return FacebookConnectResult.Fail("expired");

            if (string.IsNullOrEmpty(nonce) ||
                !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(nonce)), Encoding.UTF8.GetBytes(pending.NonceHash)))
            {
                _logger.LogWarning("Facebook callback rejected: nonce mismatch for vendor {VendorId}", pending.VendorId);
                return FacebookConnectResult.Fail("invalid_state");
            }

            string userId, scopes;
            List<FacebookPageAccount> pages;
            try
            {
                var shortToken = await _api.ExchangeCodeAsync(code, ct);
                // توكنات الصفحات المأخوذة من توكن مستخدم طويل الأمد لا تنتهي
                var longToken = await _api.ExchangeForLongLivedTokenAsync(shortToken.AccessToken!, ct);
                var me = await _api.GetMeAsync(longToken.AccessToken!, ct);
                if (string.IsNullOrEmpty(me?.Id)) return FacebookConnectResult.Fail("token");
                userId = me.Id;
                scopes = string.Join(',', await _api.GetGrantedPermissionsAsync(longToken.AccessToken!, ct));
                pages = (await _api.GetPagesAsync(longToken.AccessToken!, ct))
                    .Where(p => !string.IsNullOrEmpty(p.Id) && !string.IsNullOrEmpty(p.AccessToken))
                    .ToList();

                // صفحات محفظة الأعمال (Business Manager) قد لا تعيدها /me/accounts رغم منحها في النافذة:
                // نقرأ معرّفاتها من التوكن نفسه ونطلب توكن كل صفحة مباشرة
                if (pages.Count == 0)
                {
                    var grantedIds = await _api.GetGrantedPageIdsAsync(longToken.AccessToken!, ct);
                    foreach (var pageId in grantedIds)
                    {
                        try
                        {
                            var page = await _api.GetPageWithTokenAsync(pageId, longToken.AccessToken!, ct);
                            if (!string.IsNullOrEmpty(page?.Id) && !string.IsNullOrEmpty(page.AccessToken)) pages.Add(page);
                        }
                        catch (FacebookApiException ex)
                        {
                            _logger.LogWarning("Facebook page {PageId} granted but its token is unavailable: {Code}", pageId, ex.Code);
                        }
                    }
                    _logger.LogWarning("Facebook /me/accounts returned no pages for vendor {VendorId}; granted scopes [{Scopes}], granted page ids [{Ids}], usable {Count}",
                        pending.VendorId, scopes, string.Join(',', grantedIds), pages.Count);
                }
            }
            catch (Exception ex) when (ex is FacebookApiException or HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Facebook token exchange failed for vendor {VendorId}", pending.VendorId);
                return FacebookConnectResult.Fail("token");
            }

            // لم يمنح المستخدم أي صفحة (أو لا يدير صفحات)
            if (pages.Count == 0) return FacebookConnectResult.Fail("no_pages");

            if (pages.Count == 1)
            {
                var page = pages[0];
                return await ConnectPageAsync(pending.VendorId, userId, scopes, page.Id!, page.Name, page.Picture?.Data?.Url, page.AccessToken!, ct)
                    ? FacebookConnectResult.Ok()
                    : FacebookConnectResult.Fail("busy");
            }

            // أكثر من صفحة: يختار التاجر في المنصة
            var selectionId = GenerateToken();
            _cache.Set(SelectionCachePrefix + selectionId,
                new PendingSelection(pending.VendorId, userId, scopes,
                    pages.Select(p => new PendingPage(p.Id!, p.Name, p.Picture?.Data?.Url, _protector.Protect(p.AccessToken!))).ToList()),
                SelectionLifetime);
            return FacebookConnectResult.Choose(selectionId);
        }

        public async Task<List<FacebookPageOptionDto>> GetPendingPagesAsync(Guid userId, string selectionId, CancellationToken ct = default)
        {
            var selection = await GetSelectionAsync(userId, selectionId, ct);
            return selection.Pages.Select(p => new FacebookPageOptionDto { Id = p.Id, Name = p.Name, PictureUrl = p.PictureUrl }).ToList();
        }

        public async Task<FacebookStatusDto> SelectPageAsync(Guid userId, FacebookSelectPageDto dto, CancellationToken ct = default)
        {
            var selection = await GetSelectionAsync(userId, dto.SelectionId, ct);
            var page = selection.Pages.FirstOrDefault(p => p.Id == dto.PageId)
                ?? throw new BusinessRuleException("الصفحة غير موجودة في القائمة");

            string pageToken;
            try { pageToken = _protector.Unprotect(page.TokenProtected); }
            catch (CryptographicException) { throw new BusinessRuleException("انتهت مهلة اختيار الصفحة، أعد الربط"); }

            if (!await ConnectPageAsync(selection.VendorId, selection.FacebookUserId, selection.Scopes, page.Id, page.Name, page.PictureUrl, pageToken, ct))
                throw new BusinessRuleException("مزامنة جارية حالياً، حاول بعد لحظات");

            _cache.Remove(SelectionCachePrefix + dto.SelectionId);
            var connection = await _repository.GetConnectionAsync(selection.VendorId, includeMedia: false, ct);
            return MapStatus(connection);
        }

        private async Task<PendingSelection> GetSelectionAsync(Guid userId, string selectionId, CancellationToken ct)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            if (string.IsNullOrEmpty(selectionId) ||
                !_cache.TryGetValue(SelectionCachePrefix + selectionId, out PendingSelection? selection) ||
                selection == null || selection.VendorId != vendorId)
                throw new BusinessRuleException("انتهت مهلة اختيار الصفحة، أعد الربط");
            return selection;
        }

        // ربط الصفحة بالمتجر ثم جلب منشوراتها فوراً. false = مزامنة أخرى تمسك القفل
        private async Task<bool> ConnectPageAsync(Guid vendorId, string userId, string scopes, string pageId,
            string? pageName, string? pictureUrl, string pageToken, CancellationToken ct)
        {
            var gate = LockFor(vendorId);
            if (!await gate.WaitAsync(LockWaitLimit, ct)) return false;
            try
            {
                var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: true, ct);
                if (connection == null)
                {
                    connection = new FacebookConnection { VendorId = vendorId };
                    await _repository.AddConnectionAsync(connection, ct);
                }
                else if (connection.PageId != pageId)
                {
                    // صفحة مختلفة: منشورات الصفحة السابقة لم تعد تخص المتجر
                    connection.Media.Clear();
                    connection.PageUsername = connection.PageLink = null;
                    connection.FollowersCount = null;
                }

                var isNewPage = connection.Media.Count == 0;
                connection.FacebookUserId = userId;
                connection.PageId = pageId;
                connection.PageName = Truncate(pageName, 200);
                connection.PagePictureUrl = pictureUrl;
                connection.PageAccessTokenProtected = _protector.Protect(pageToken);
                connection.Scopes = Truncate(scopes, 500) ?? "";
                connection.ConnectedAt = Now;
                connection.NeedsReconnect = false;
                connection.LastSyncError = null;
                await _unitOfWork.SaveChangesAsync(ct);

                _logger.LogInformation("Vendor {VendorId} connected Facebook page {PageId}", vendorId, pageId);

                // فشل الجلب لا يُلغي الربط — يُعاد بالمزامنة الدورية
                await SyncConnectionAsync(connection, showAllNewMedia: isNewPage, ct);
                await _unitOfWork.SaveChangesAsync(ct);
                return true;
            }
            finally
            {
                gate.Release();
            }
        }

        // ===================================
        // المزامنة
        // ===================================
        public async Task<FacebookStatusDto> SyncAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            if (!await _repository.ConnectionExistsAsync(vendorId, ct))
                throw new NotFoundException("لا توجد صفحة فيسبوك مربوطة بمتجرك");

            var gate = LockFor(vendorId);
            if (!await gate.WaitAsync(LockWaitLimit, ct))
                throw new BusinessRuleException("مزامنة جارية حالياً، حاول بعد لحظات");
            try
            {
                var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: true, ct)
                    ?? throw new NotFoundException("لا توجد صفحة فيسبوك مربوطة بمتجرك");

                if (!connection.NeedsReconnect)
                {
                    await SyncConnectionAsync(connection, showAllNewMedia: false, ct);
                    await _unitOfWork.SaveChangesAsync(ct);
                }

                if (connection.NeedsReconnect)
                    throw new BusinessRuleException("انتهت صلاحية الربط مع فيسبوك، يرجى إعادة ربط الصفحة");
                if (connection.LastSyncError != null)
                    throw new BusinessRuleException("تعذّرت المزامنة مع فيسبوك حالياً، حاول لاحقاً");

                return MapStatus(connection);
            }
            finally
            {
                gate.Release();
            }
        }

        public async Task RefreshStoreAsync(Guid vendorId, CancellationToken ct = default)
        {
            if (!_options.IsConfigured) return;

            var staleBefore = StaleBefore;
            var due = await _repository.GetVendorsDueForSyncAsync(staleBefore, 1, onlyVisible: true, vendorId, ct: ct);
            if (due.Count == 0) return;

            // عرض المتجر لا يفشل بسبب فيسبوك — أسوأ حالة تُعرض آخر نسخة محفوظة
            try { await SyncIfDueAsync(vendorId, LockWaitLimit, staleBefore, onlyVisible: true, fullList: false, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Facebook store refresh failed for vendor {VendorId}", vendorId);
            }
        }

        public async Task RefreshVisibleAsync(CancellationToken ct = default)
        {
            if (!_options.IsConfigured || !await VisibleRefreshGate.WaitAsync(0, ct)) return;
            try
            {
                var staleBefore = StaleBefore;
                var due = await _repository.GetVendorsDueForSyncAsync(staleBefore, MaxStoresPerRefresh, onlyVisible: true, ct: ct);
                foreach (var vendorId in due)
                {
                    try { await SyncIfDueAsync(vendorId, TimeSpan.Zero, staleBefore, onlyVisible: true, fullList: false, ct); }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        _logger.LogWarning(ex, "Facebook reels refresh failed for vendor {VendorId}", vendorId);
                    }
                }
            }
            finally
            {
                VisibleRefreshGate.Release();
            }
        }

        public async Task<int> SyncDueConnectionsAsync(CancellationToken ct = default)
        {
            if (!_options.IsConfigured) return 0;

            await _repository.DeleteExpiredStatesAsync(Now, ct);

            var staleBefore = Now.AddMinutes(-Math.Max(5, _options.SyncIntervalMinutes));
            var due = await _repository.GetVendorsDueForSyncAsync(staleBefore, MaxStoresPerRefresh, onlyVisible: false, fullList: true, ct: ct);

            var synced = 0;
            foreach (var vendorId in due)
            {
                try
                {
                    if (await SyncIfDueAsync(vendorId, TimeSpan.Zero, staleBefore, onlyVisible: false, fullList: true, ct)) synced++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "Facebook background sync failed for vendor {VendorId}", vendorId);
                }
            }
            return synced;
        }

        // يأخذ قفل المتجر ثم يحمّل الحساب بحالته الحالية
        private async Task<bool> SyncIfDueAsync(Guid vendorId, TimeSpan wait, DateTime staleBefore, bool onlyVisible, bool fullList, CancellationToken ct)
        {
            var gate = LockFor(vendorId);
            if (!await gate.WaitAsync(wait, ct)) return false;
            try
            {
                var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: true, ct);
                if (connection == null || connection.NeedsReconnect || (onlyVisible && !connection.ShowOnStore)) return false;
                if ((fullList ? connection.LastFullSyncedAt : connection.LastSyncedAt) >= staleBefore) return false;

                await SyncConnectionAsync(connection, showAllNewMedia: false, ct, fullList);
                await _unitOfWork.SaveChangesAsync(ct);
                return true;
            }
            finally
            {
                gate.Release();
            }
        }

        // ===================================
        // المنشورات والإعدادات
        // ===================================
        public async Task<List<SocialFeedItemDto>> GetMediaAsync(Guid userId, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeMedia: true, ct);
            return connection.Media
                .Where(m => !m.IsRemoved)
                .OrderByDescending(m => m.PublishedAt)
                .Select(SocialMapping.FromFacebook)
                .ToList();
        }

        public async Task<SocialFeedItemDto> UpdateMediaAsync(Guid userId, Guid mediaId, SocialMediaUpdateDto dto, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeMedia: true, ct);
            var media = connection.Media.FirstOrDefault(m => m.Id == mediaId && !m.IsRemoved)
                ?? throw new NotFoundException("المنشور غير موجود");

            if (dto.IsHidden.HasValue)
                media.IsHidden = dto.IsHidden.Value;

            if (dto.RemoveProduct)
            {
                media.ProductId = null;
                media.Product = null;
            }
            else if (dto.ProductId.HasValue)
            {
                if (!await _repository.ProductBelongsToVendorAsync(dto.ProductId.Value, connection.VendorId, ct))
                    throw new BusinessRuleException("المنتج غير موجود في متجرك");
                media.ProductId = dto.ProductId.Value;
            }

            await _unitOfWork.SaveChangesAsync(ct);

            var reloaded = await _repository.GetConnectionAsync(connection.VendorId, includeMedia: true, ct);
            return SocialMapping.FromFacebook(reloaded!.Media.First(m => m.Id == mediaId));
        }

        public async Task<FacebookSettingsDto> UpdateSettingsAsync(Guid userId, FacebookSettingsUpdateDto dto, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeMedia: false, ct);
            if (dto.ShowOnStore.HasValue) connection.ShowOnStore = dto.ShowOnStore.Value;
            if (dto.AutoShowNewMedia.HasValue) connection.AutoShowNewMedia = dto.AutoShowNewMedia.Value;
            await _unitOfWork.SaveChangesAsync(ct);
            return MapSettings(connection);
        }

        // إلغاء الربط من المنصة يحذف الصفحة ومنشوراتها. يبقى التطبيق في إعدادات فيسبوك للتاجر حتى يزيله
        public async Task DisconnectAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            if (!await _repository.ConnectionExistsAsync(vendorId, ct))
                throw new NotFoundException("لا توجد صفحة فيسبوك مربوطة بمتجرك");

            var gate = LockFor(vendorId);
            if (!await gate.WaitAsync(LockWaitLimit, ct))
                throw new BusinessRuleException("مزامنة جارية حالياً، حاول بعد لحظات");
            try
            {
                var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: true, ct);
                if (connection == null) return;
                _repository.RemoveConnection(connection);
                await _unitOfWork.SaveChangesAsync(ct);
            }
            finally
            {
                gate.Release();
            }
        }

        // ===================================
        // طلبات Meta — نفس صيغة signed_request لإنستغرام وفيسبوك
        // ===================================
        public async Task<bool> HandleDeauthorizeAsync(string? signedRequest, CancellationToken ct = default)
        {
            var userId = InstagramService.InstagramService.ParseSignedRequestUserId(signedRequest, _options.AppSecret);
            if (userId == null) return false;

            var connections = await _repository.GetConnectionsByFacebookUserAsync(userId, ct);
            foreach (var connection in connections)
            {
                connection.NeedsReconnect = true;
                connection.PageAccessTokenProtected = "";
                connection.LastSyncError = "deauthorized";
            }
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation("Facebook user {UserId} deauthorized the app ({Count} store(s))", userId, connections.Count);
            return true;
        }

        public async Task<string?> HandleDataDeletionAsync(string? signedRequest, CancellationToken ct = default)
        {
            var userId = InstagramService.InstagramService.ParseSignedRequestUserId(signedRequest, _options.AppSecret);
            if (userId == null) return null;

            var connections = await _repository.GetConnectionsByFacebookUserAsync(userId, ct);
            foreach (var connection in connections)
                _repository.RemoveConnection(connection);
            await _unitOfWork.SaveChangesAsync(ct);

            var confirmation = GenerateToken()[..16];
            _logger.LogInformation("Facebook data deletion for user {UserId}: removed {Count} connection(s), code {Code}",
                userId, connections.Count, confirmation);
            return confirmation;
        }

        // ===================================
        // المزامنة مع فيسبوك
        // لا ترمي أخطاء فيسبوك — تسجّلها في LastSyncError / NeedsReconnect. الحفظ على المُستدعي
        // fullList=false (زائر فتح المتجر أو ريلز): أحدث صفحة من كل قائمة فقط
        // ===================================
        private async Task SyncConnectionAsync(FacebookConnection connection, bool showAllNewMedia, CancellationToken ct, bool fullList = true)
        {
            try
            {
                if (!TryUnprotect(connection.PageAccessTokenProtected, out var token))
                    throw new FacebookApiException("انتهت صلاحية الربط", "token_unreadable", requiresReconnect: true);

                var page = await _api.GetPageAsync(connection.PageId, token, ct);
                if (page != null)
                {
                    connection.PageName = Truncate(page.Name, 200) ?? connection.PageName;
                    connection.PageUsername = Truncate(page.Username, 100) ?? connection.PageUsername;
                    connection.PageLink = Truncate(page.Link, 500) ?? connection.PageLink;
                    connection.PagePictureUrl = page.Picture?.Data?.Url ?? connection.PagePictureUrl;
                    connection.FollowersCount = page.FollowersCount ?? page.FanCount ?? connection.FollowersCount;
                }

                await SyncMediaAsync(connection, token, showAllNewMedia, fullList, ct);

                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = null;
            }
            catch (FacebookApiException ex)
            {
                // الفشل يُسجَّل كمزامنة أيضاً حتى لا يُعاد الطلب فوراً
                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = ex.Code ?? ex.Message;
                if (ex.RequiresReconnect) connection.NeedsReconnect = true;
                _logger.LogWarning("Facebook sync failed for vendor {VendorId}: {Code}", connection.VendorId, ex.Code);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = "network";
                _logger.LogWarning(ex, "Facebook sync network error for vendor {VendorId}", connection.VendorId);
            }
        }

        // عنصر بعد توحيده من قوائم فيسبوك الثلاث (الفيديو، الريلز، المنشورات)
        private sealed class FetchedItem
        {
            public string ExternalId = "";
            public string MediaType = FacebookMedia.TypeImage;
            public bool IsReel;
            public string? Caption, MediaUrl, ThumbnailUrl, Permalink;
            public int? DurationSeconds;
            public List<InstagramMediaChild>? Children;
            public DateTime? PublishedAt;
        }

        private async Task SyncMediaAsync(FacebookConnection connection, string token, bool showAllNewMedia, bool fullList, CancellationToken ct)
        {
            var max = fullList ? Math.Max(1, _options.MaxMedia) : FacebookLimits.PageSize;
            var items = new Dictionary<string, FetchedItem>();
            var complete = true;

            // 1) الفيديو ثم الريلز (الريلز فيديو أيضاً — يُعلَّم فقط)
            foreach (var reels in new[] { false, true })
            {
                string? after = null;
                var count = 0;
                try
                {
                    while (count < max)
                    {
                        var list = await _api.ListVideosAsync(connection.PageId, token, reels, after, Math.Min(FacebookLimits.PageSize, max - count), ct);
                        foreach (var v in (list.Data ?? new()).Where(v => !string.IsNullOrEmpty(v.Id)))
                        {
                            count++;
                            if (items.TryGetValue(v.Id!, out var existing)) { if (reels) existing.IsReel = true; continue; }
                            items[v.Id!] = new FetchedItem
                            {
                                ExternalId = v.Id!,
                                MediaType = FacebookMedia.TypeVideo,
                                IsReel = reels,
                                Caption = v.Description,
                                MediaUrl = v.Source,
                                ThumbnailUrl = v.BestThumbnail,
                                Permalink = FacebookGraph.AbsoluteUrl(v.PermalinkUrl),
                                DurationSeconds = v.Length.HasValue ? (int)Math.Round(v.Length.Value) : null,
                                PublishedAt = FacebookGraph.ParseTime(v.CreatedTime)
                            };
                        }
                        after = list.NextCursor;
                        if (after == null) break;
                        if (!fullList) { complete = false; break; }
                    }
                    if (after != null) complete = false;
                }
                catch (FacebookApiException ex) when (reels && !ex.RequiresReconnect)
                {
                    // قائمة الريلز قد لا تكون متاحة لكل الصفحات — الفيديو العادي يكفي
                    _logger.LogInformation("Facebook reels list unavailable for page {PageId}: {Code}", connection.PageId, ex.Code);
                    complete = false;
                }
            }

            // 2) المنشورات: الصور والألبومات (منشورات الفيديو جُلبت من قائمة الفيديو)
            {
                string? after = null;
                var count = 0;
                while (count < max)
                {
                    var list = await _api.ListPostsAsync(connection.PageId, token, after, Math.Min(FacebookLimits.PageSize, max - count), ct);
                    foreach (var post in (list.Data ?? new()).Where(p => !string.IsNullOrEmpty(p.Id)))
                    {
                        count++;
                        var item = FromPost(post);
                        if (item != null && !items.ContainsKey(item.ExternalId)) items[item.ExternalId] = item;
                    }
                    after = list.NextCursor;
                    if (after == null) break;
                    if (!fullList) { complete = false; break; }
                }
                if (after != null) complete = false;
            }

            var existingMedia = connection.Media.ToDictionary(m => m.ExternalId);
            foreach (var item in items.Values)
            {
                if (!existingMedia.TryGetValue(item.ExternalId, out var media))
                {
                    media = new FacebookMedia
                    {
                        ConnectionId = connection.Id,
                        ExternalId = item.ExternalId,
                        IsHidden = !(showAllNewMedia || connection.AutoShowNewMedia)
                    };
                    connection.Media.Add(media);
                    _repository.AddMedia(media);
                }

                media.MediaType = item.MediaType;
                media.IsReel = item.IsReel;
                media.Caption = Truncate(item.Caption, 2200);
                media.MediaUrl = item.MediaUrl;
                media.ThumbnailUrl = item.ThumbnailUrl;
                media.Permalink = Truncate(item.Permalink, 500);
                media.DurationSeconds = item.DurationSeconds;
                media.ChildrenJson = SocialMapping.WriteChildren(item.Children);
                media.PublishedAt = item.PublishedAt ?? media.PublishedAt;
                media.IsRemoved = false;
            }

            // القوائم كلها جُلبت كاملة: ما لم يعد موجوداً يُعلَّم كمحذوف (يبقى ربطه بالمنتج إن عاد)
            if (complete)
                foreach (var media in connection.Media.Where(m => !items.ContainsKey(m.ExternalId)))
                    media.IsRemoved = true;
        }

        // منشور صورة أو ألبوم ← عنصر. الفيديو والروابط والنصوص ← null
        private static FetchedItem? FromPost(FacebookApiPost post)
        {
            var attachment = post.Attachments?.Data?.FirstOrDefault();
            var type = attachment?.MediaType?.ToLowerInvariant();
            if (attachment == null || (type != "photo" && type != "album")) return null;

            var item = new FetchedItem
            {
                ExternalId = post.Id!,
                Caption = post.Message,
                Permalink = FacebookGraph.AbsoluteUrl(post.PermalinkUrl),
                PublishedAt = FacebookGraph.ParseTime(post.CreatedTime)
            };

            if (type == "photo")
            {
                item.MediaType = FacebookMedia.TypeImage;
                item.MediaUrl = attachment.Media?.Image?.Src;
                return item.MediaUrl == null ? null : item;
            }

            // ألبوم: الفيديو داخله يُعرض بصورته (لا يعطي فيسبوك رابط تشغيله هنا)
            item.MediaType = FacebookMedia.TypeCarousel;
            item.Children = (attachment.Subattachments?.Data ?? new())
                .Select(s => s.Media?.Image?.Src)
                .Where(src => !string.IsNullOrEmpty(src))
                .Select(src => new InstagramMediaChild { Type = InstagramMedia.TypeImage, Url = src })
                .ToList();
            item.MediaUrl = item.Children.FirstOrDefault()?.Url ?? attachment.Media?.Image?.Src;
            if (item.MediaUrl == null) return null;
            // ألبوم بعنصر واحد = صورة
            if (item.Children.Count <= 1) { item.MediaType = FacebookMedia.TypeImage; item.Children = null; }
            return item;
        }

        // ===================================
        // Helpers
        // ===================================
        private bool TryUnprotect(string protectedValue, out string value)
        {
            value = "";
            if (string.IsNullOrEmpty(protectedValue)) return false;
            try
            {
                value = _protector.Unprotect(protectedValue);
                return true;
            }
            catch (CryptographicException)
            {
                return false;
            }
        }

        private void EnsureConfigured()
        {
            if (!_options.IsConfigured)
                throw new BusinessRuleException("ربط فيسبوك غير مفعّل بعد على المنصة");
        }

        private async Task<Guid> GetVendorIdAsync(Guid userId, CancellationToken ct) =>
            await _repository.GetVendorIdByOwnerAsync(userId, ct)
            ?? throw new ForbiddenException("هذا الحساب غير مرتبط بمتجر");

        private async Task<FacebookConnection> GetConnectionOrThrowAsync(Guid userId, bool includeMedia, CancellationToken ct)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            return await _repository.GetConnectionAsync(vendorId, includeMedia, ct)
                ?? throw new NotFoundException("لا توجد صفحة فيسبوك مربوطة بمتجرك");
        }

        private static string GenerateToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static string Hash(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

        private static string? Truncate(string? value, int max) =>
            value is { Length: > 0 } && value.Length > max ? value[..max] : value;

        private FacebookStatusDto MapStatus(FacebookConnection? c) => new()
        {
            Configured = _options.IsConfigured,
            Connected = c != null,
            NeedsReconnect = c?.NeedsReconnect ?? false,
            Account = c == null ? null : new FacebookPageDto
            {
                PageId = c.PageId,
                Name = c.PageName,
                Username = c.PageUsername,
                PictureUrl = c.PagePictureUrl,
                Link = c.PageLink,
                FollowersCount = c.FollowersCount
            },
            Settings = c == null ? null : MapSettings(c),
            ConnectedAt = c?.ConnectedAt,
            LastSyncedAt = c?.LastSyncedAt,
            LastSyncError = c?.LastSyncError,
            Scopes = c?.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? new()
        };

        private static FacebookSettingsDto MapSettings(FacebookConnection c) => new()
        {
            ShowOnStore = c.ShowOnStore,
            AutoShowNewMedia = c.AutoShowNewMedia
        };
    }
}
