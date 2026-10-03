using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ecommerce.Core.DTO.Instagram;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.SocialFeedService;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.InstagramService
{
    // نتيجة العودة من إنستغرام — Reason يُمرَّر للواجهة لعرض رسالة مناسبة
    public record InstagramConnectResult(bool Success, string? Reason = null)
    {
        public static InstagramConnectResult Ok() => new(true);
        public static InstagramConnectResult Fail(string reason) => new(false, reason);
    }

    // بداية الربط: الرابط الذي يُفتح في المتصفح + قيمة الكوكي التي تُثبت أن العودة من نفس المتصفح
    public record InstagramConnectStart(string AuthorizeUrl, string Nonce);

    public interface IInstagramService
    {
        Task<InstagramStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
        Task<InstagramConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default);
        Task<InstagramConnectResult> CompleteConnectAsync(string? code, string? state, string? nonce, string? error, CancellationToken ct = default);
        Task<InstagramStatusDto> SyncAsync(Guid userId, CancellationToken ct = default);
        Task<List<SocialFeedItemDto>> GetMediaAsync(Guid userId, CancellationToken ct = default);
        Task<SocialFeedItemDto> UpdateMediaAsync(Guid userId, Guid mediaId, SocialMediaUpdateDto dto, CancellationToken ct = default);
        Task<InstagramSettingsDto> UpdateSettingsAsync(Guid userId, InstagramSettingsUpdateDto dto, CancellationToken ct = default);
        Task DisconnectAsync(Guid userId, CancellationToken ct = default);

        // العرض العام: يزامن حساب المتجر إن مضت StoreRefreshSeconds على آخر مزامنة
        Task RefreshStoreAsync(Guid vendorId, CancellationToken ct = default);
        // صفحة ريلز: يزامن الحسابات الظاهرة التي حان وقتها
        Task RefreshVisibleAsync(CancellationToken ct = default);
        // للمزامنة الدورية في الخلفية — يعيد عدد الحسابات التي تمت مزامنتها
        Task<int> SyncDueConnectionsAsync(CancellationToken ct = default);

        // طلبات Meta الموقّعة (signed_request): إلغاء التفويض من إنستغرام، وطلب حذف البيانات
        Task<bool> HandleDeauthorizeAsync(string? signedRequest, CancellationToken ct = default);
        Task<string?> HandleDataDeletionAsync(string? signedRequest, CancellationToken ct = default);
    }

    public class InstagramService : IInstagramService
    {
        private static readonly TimeSpan StateLifetime = TimeSpan.FromMinutes(10);

        // التوكن طويل الأمد صالح 60 يوماً، ويقبل التجديد بعد 24 ساعة من إصداره.
        // يُجدَّد حين يبقى له أقل من 30 يوماً — أي مرة كل شهر تقريباً عبر المزامنة الدورية
        private static readonly TimeSpan TokenMinAgeForRefresh = TimeSpan.FromHours(24);
        private static readonly TimeSpan TokenRefreshWindow = TimeSpan.FromDays(30);
        private static readonly TimeSpan DefaultTokenLifetime = TimeSpan.FromDays(60);

        // قفل لكل متجر تمر به كل عمليات المزامنة والربط والإلغاء — يمنع إدراج نفس المنشور مرتين.
        // يُنشأ فقط لمتجر ثبت أن له حساباً مربوطاً (لا يكبر بطلبات عشوائية)
        private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> StoreLocks = new();
        private static readonly SemaphoreSlim VisibleRefreshGate = new(1, 1);
        private static readonly TimeSpan LockWaitLimit = TimeSpan.FromSeconds(20);
        private const int MaxStoresPerRefresh = 50;

        private readonly IInstagramRepository _repository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IInstagramApiClient _api;
        private readonly IInstagramTokenProtector _protector;
        private readonly InstagramOptions _options;
        private readonly TimeProvider _time;
        private readonly ILogger<InstagramService> _logger;

        public InstagramService(
            IInstagramRepository repository,
            IUnitOfWork unitOfWork,
            IInstagramApiClient api,
            IInstagramTokenProtector protector,
            IOptions<InstagramOptions> options,
            TimeProvider time,
            ILogger<InstagramService> logger)
        {
            _repository = repository;
            _unitOfWork = unitOfWork;
            _api = api;
            _protector = protector;
            _options = options.Value;
            _time = time;
            _logger = logger;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        private DateTime StaleBefore => Now - TimeSpan.FromSeconds(Math.Max(30, _options.StoreRefreshSeconds));

        private static SemaphoreSlim LockFor(Guid vendorId) => StoreLocks.GetOrAdd(vendorId, _ => new SemaphoreSlim(1, 1));

        // ===================================
        // الحالة
        // ===================================
        public async Task<InstagramStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: false, ct);
            return MapStatus(connection);
        }

        // ===================================
        // الخطوة 1: إنشاء رابط التفويض
        // ===================================
        public async Task<InstagramConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default)
        {
            EnsureConfigured();
            var vendorId = await GetVendorIdAsync(userId, ct);

            var state = GenerateToken();
            var nonce = GenerateToken();

            await _repository.AddStateAsync(new InstagramOAuthState
            {
                State = state,
                VendorId = vendorId,
                NonceHash = Hash(nonce),
                CreatedAt = Now,
                ExpiresAt = Now.Add(StateLifetime)
            }, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return new InstagramConnectStart(_api.BuildAuthorizeUrl(state), nonce);
        }

        // ===================================
        // الخطوة 2: العودة من إنستغرام
        // لا يعتمد على JWT (المتصفح لا يرسله في التوجيه) — المتجر يُعرف من state المحفوظ في الخادم
        // ===================================
        public async Task<InstagramConnectResult> CompleteConnectAsync(
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
                _logger.LogInformation("Instagram authorization not granted: {Error}", error);
                return InstagramConnectResult.Fail("denied");
            }

            if (string.IsNullOrEmpty(code) || pending == null)
                return InstagramConnectResult.Fail("invalid_state");

            if (pending.ExpiresAt < Now)
                return InstagramConnectResult.Fail("expired");

            if (string.IsNullOrEmpty(nonce) ||
                !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(nonce)), Encoding.UTF8.GetBytes(pending.NonceHash)))
            {
                _logger.LogWarning("Instagram callback rejected: nonce mismatch for vendor {VendorId}", pending.VendorId);
                return InstagramConnectResult.Fail("invalid_state");
            }

            // إنستغرام يضيف "#_" لنهاية الكود في التوجيه — المتصفح يحذفه عادةً، احتياطاً
            if (code.EndsWith("#_")) code = code[..^2];

            InstagramShortToken shortToken;
            InstagramTokenResponse longToken;
            try
            {
                shortToken = await _api.ExchangeCodeAsync(code, ct);
                longToken = await _api.ExchangeForLongLivedTokenAsync(shortToken.AccessToken, ct);
            }
            catch (Exception ex) when (ex is InstagramApiException or HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Instagram token exchange failed for vendor {VendorId}", pending.VendorId);
                return InstagramConnectResult.Fail("token");
            }

            var gate = LockFor(pending.VendorId);
            if (!await gate.WaitAsync(LockWaitLimit, ct))
                return InstagramConnectResult.Fail("busy");
            try
            {
                var connection = await _repository.GetConnectionAsync(pending.VendorId, includeMedia: true, ct);
                if (connection == null)
                {
                    connection = new InstagramConnection { VendorId = pending.VendorId };
                    await _repository.AddConnectionAsync(connection, ct);
                }
                else if (connection.InstagramUserId != shortToken.UserId)
                {
                    // ربط حساب مختلف: منشورات الحساب السابق لم تعد تخص المتجر
                    connection.Media.Clear();
                    connection.AccountId = connection.Username = connection.Name = connection.AccountType = connection.ProfilePictureUrl = null;
                    connection.FollowersCount = connection.MediaCount = null;
                }

                var isNewAccount = connection.Media.Count == 0;
                connection.InstagramUserId = shortToken.UserId;
                connection.Scopes = !string.IsNullOrEmpty(shortToken.Permissions) ? shortToken.Permissions : _options.Scopes;
                ApplyToken(connection, longToken);
                connection.ConnectedAt = Now;
                connection.NeedsReconnect = false;
                connection.LastSyncError = null;
                await _unitOfWork.SaveChangesAsync(ct);

                _logger.LogInformation("Vendor {VendorId} connected Instagram account {UserId}", pending.VendorId, shortToken.UserId);

                // جلب الحساب والمنشورات فوراً — فشلها لا يُلغي الربط، وستُعاد بالمزامنة الدورية
                await SyncConnectionAsync(connection, showAllNewMedia: isNewAccount, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }
            finally
            {
                gate.Release();
            }

            return InstagramConnectResult.Ok();
        }

        // ===================================
        // المزامنة
        // ===================================
        public async Task<InstagramStatusDto> SyncAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            if (!await _repository.ConnectionExistsAsync(vendorId, ct))
                throw new NotFoundException("لا يوجد حساب إنستغرام مربوط بمتجرك");

            var gate = LockFor(vendorId);
            if (!await gate.WaitAsync(LockWaitLimit, ct))
                throw new BusinessRuleException("مزامنة جارية حالياً، حاول بعد لحظات");
            try
            {
                var connection = await _repository.GetConnectionAsync(vendorId, includeMedia: true, ct)
                    ?? throw new NotFoundException("لا يوجد حساب إنستغرام مربوط بمتجرك");

                if (!connection.NeedsReconnect)
                {
                    await SyncConnectionAsync(connection, showAllNewMedia: false, ct);
                    await _unitOfWork.SaveChangesAsync(ct);
                }

                if (connection.NeedsReconnect)
                    throw new BusinessRuleException("انتهت صلاحية الربط مع إنستغرام، يرجى إعادة ربط الحساب");
                if (connection.LastSyncError != null)
                    throw new BusinessRuleException("تعذّرت المزامنة مع إنستغرام حالياً، حاول لاحقاً");

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

            // عرض المتجر لا يفشل بسبب إنستغرام — أسوأ حالة تُعرض آخر نسخة محفوظة
            try { await SyncIfDueAsync(vendorId, LockWaitLimit, staleBefore, onlyVisible: true, fullList: false, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Instagram store refresh failed for vendor {VendorId}", vendorId);
            }
        }

        public async Task RefreshVisibleAsync(CancellationToken ct = default)
        {
            // تحديث واحد في نفس الوقت؛ الطلب المتزامن يعرض المحفوظ دون انتظار
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
                        // متجر واحد متعطل لا يمنع تحديث البقية
                        _logger.LogWarning(ex, "Instagram reels refresh failed for vendor {VendorId}", vendorId);
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
                    _logger.LogWarning(ex, "Instagram background sync failed for vendor {VendorId}", vendorId);
                }
            }
            return synced;
        }

        // يأخذ قفل المتجر ثم يحمّل الحساب بحالته الحالية (قد يكون طلب آخر زامنه أثناء الانتظار)
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
                .Select(SocialMapping.FromInstagram)
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
                // التاجر يربط المنشور بمنتجاته فقط
                if (!await _repository.ProductBelongsToVendorAsync(dto.ProductId.Value, connection.VendorId, ct))
                    throw new BusinessRuleException("المنتج غير موجود في متجرك");
                media.ProductId = dto.ProductId.Value;
            }

            await _unitOfWork.SaveChangesAsync(ct);

            // إعادة تحميل المنتج المربوط للاستجابة
            var reloaded = await _repository.GetConnectionAsync(connection.VendorId, includeMedia: true, ct);
            return SocialMapping.FromInstagram(reloaded!.Media.First(m => m.Id == mediaId));
        }

        public async Task<InstagramSettingsDto> UpdateSettingsAsync(Guid userId, InstagramSettingsUpdateDto dto, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeMedia: false, ct);
            if (dto.ShowOnStore.HasValue) connection.ShowOnStore = dto.ShowOnStore.Value;
            if (dto.AutoShowNewMedia.HasValue) connection.AutoShowNewMedia = dto.AutoShowNewMedia.Value;
            await _unitOfWork.SaveChangesAsync(ct);
            return MapSettings(connection);
        }

        // ===================================
        // إلغاء الربط — إنستغرام لا يوفّر إلغاء التوكن عبر الـ API؛ التاجر يزيل التطبيق من إعدادات حسابه إن أراد
        // ===================================
        public async Task DisconnectAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            if (!await _repository.ConnectionExistsAsync(vendorId, ct))
                throw new NotFoundException("لا يوجد حساب إنستغرام مربوط بمتجرك");

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
        // طلبات Meta
        // ===================================
        public async Task<bool> HandleDeauthorizeAsync(string? signedRequest, CancellationToken ct = default)
        {
            var userId = ParseSignedRequestUserId(signedRequest, _options.AppSecret);
            if (userId == null) return false;

            var connections = await _repository.GetConnectionsByInstagramUserAsync(userId, ct);
            foreach (var connection in connections)
            {
                // التوكن لم يعد صالحاً: يختفي المحتوى من العرض العام وتبقى إعدادات التاجر وربط المنتجات لحين إعادة الربط
                connection.NeedsReconnect = true;
                connection.AccessTokenProtected = "";
                connection.LastSyncError = "deauthorized";
            }
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation("Instagram user {UserId} deauthorized the app ({Count} store(s))", userId, connections.Count);
            return true;
        }

        public async Task<string?> HandleDataDeletionAsync(string? signedRequest, CancellationToken ct = default)
        {
            var userId = ParseSignedRequestUserId(signedRequest, _options.AppSecret);
            if (userId == null) return null;

            var connections = await _repository.GetConnectionsByInstagramUserAsync(userId, ct);
            foreach (var connection in connections)
                _repository.RemoveConnection(connection);   // المنشورات تُحذف معه (Cascade)
            await _unitOfWork.SaveChangesAsync(ct);

            var confirmation = GenerateToken()[..16];
            _logger.LogInformation("Instagram data deletion for user {UserId}: removed {Count} connection(s), code {Code}",
                userId, connections.Count, confirmation);
            return confirmation;
        }

        // signed_request = base64url(HMAC-SHA256(payload, AppSecret)) + "." + base64url(JSON) — يعيد user_id إن صح التوقيع
        public static string? ParseSignedRequestUserId(string? signedRequest, string appSecret)
        {
            if (string.IsNullOrEmpty(signedRequest) || string.IsNullOrEmpty(appSecret)) return null;
            var parts = signedRequest.Split('.', 2);
            if (parts.Length != 2) return null;

            try
            {
                var signature = WebEncoders.Base64UrlDecode(parts[0]);
                var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(appSecret), Encoding.UTF8.GetBytes(parts[1]));
                if (!CryptographicOperations.FixedTimeEquals(signature, expected)) return null;

                using var payload = JsonDocument.Parse(WebEncoders.Base64UrlDecode(parts[1]));
                var root = payload.RootElement;
                if (root.TryGetProperty("algorithm", out var alg) &&
                    !string.Equals(alg.GetString(), "HMAC-SHA256", StringComparison.OrdinalIgnoreCase))
                    return null;
                if (!root.TryGetProperty("user_id", out var uid)) return null;
                return uid.ValueKind switch
                {
                    JsonValueKind.String => uid.GetString(),
                    JsonValueKind.Number => uid.GetRawText(),
                    _ => null
                };
            }
            catch (Exception ex) when (ex is FormatException or JsonException or InvalidOperationException)
            {
                return null;
            }
        }

        // ===================================
        // المزامنة مع إنستغرام
        // لا ترمي أخطاء إنستغرام — تسجّلها في LastSyncError / NeedsReconnect. الحفظ على المُستدعي
        // ===================================
        // fullList=false (زائر فتح المتجر أو ريلز): أحدث صفحة فقط — يكفي لظهور الجديد فوراً بطلب واحد.
        // fullList=true: القائمة كاملة حتى MaxMedia — تجدّد روابط المنشورات الأقدم وتكشف المحذوف
        private async Task SyncConnectionAsync(InstagramConnection connection, bool showAllNewMedia, CancellationToken ct, bool fullList = true)
        {
            try
            {
                var accessToken = await GetValidAccessTokenAsync(connection, ct);

                var profile = await _api.GetProfileAsync(accessToken, ct);
                if (profile != null)
                {
                    connection.AccountId = profile.UserId ?? connection.AccountId;
                    connection.Username = Truncate(profile.Username, 100) ?? connection.Username;
                    connection.Name = Truncate(profile.Name, 200) ?? connection.Name;
                    connection.AccountType = Truncate(profile.AccountType, 30) ?? connection.AccountType;
                    connection.ProfilePictureUrl = profile.ProfilePictureUrl ?? connection.ProfilePictureUrl;
                    connection.FollowersCount = profile.FollowersCount ?? connection.FollowersCount;
                    connection.MediaCount = profile.MediaCount ?? connection.MediaCount;
                }

                await SyncMediaAsync(connection, accessToken, showAllNewMedia, fullList, ct);

                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = null;
            }
            catch (InstagramApiException ex)
            {
                // الفشل يُسجَّل كمزامنة أيضاً حتى لا يُعاد الطلب فوراً — المحاولة القادمة بعد المهلة
                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = ex.Code ?? ex.Message;
                if (ex.RequiresReconnect) connection.NeedsReconnect = true;
                _logger.LogWarning("Instagram sync failed for vendor {VendorId}: {Code}", connection.VendorId, ex.Code);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                connection.LastSyncedAt = Now;
                if (fullList) connection.LastFullSyncedAt = Now;
                connection.LastSyncError = "network";
                _logger.LogWarning(ex, "Instagram sync network error for vendor {VendorId}", connection.VendorId);
            }
        }

        private async Task SyncMediaAsync(InstagramConnection connection, string accessToken, bool showAllNewMedia, bool fullList, CancellationToken ct)
        {
            var max = fullList ? Math.Max(1, _options.MaxMedia) : InstagramLimits.MediaPageSize;
            var fetched = new List<InstagramApiMedia>();
            string? after = null;
            var complete = false;

            while (fetched.Count < max)
            {
                var page = await _api.ListMediaAsync(accessToken, after, Math.Min(InstagramLimits.MediaPageSize, max - fetched.Count), ct);
                fetched.AddRange((page.Data ?? new()).Where(m => !string.IsNullOrEmpty(m.Id)));
                after = page.NextCursor;
                if (after == null) { complete = true; break; }
                // المزامنة السريعة طلب واحد فقط، حتى لو أعاد إنستغرام أقل من الصفحة الكاملة
                if (!fullList) break;
            }

            var existing = connection.Media.ToDictionary(m => m.ExternalId);
            var seen = new HashSet<string>();

            foreach (var item in fetched)
            {
                if (!seen.Add(item.Id!)) continue;

                if (!existing.TryGetValue(item.Id!, out var media))
                {
                    media = new InstagramMedia
                    {
                        ConnectionId = connection.Id,
                        ExternalId = item.Id!,
                        IsHidden = !(showAllNewMedia || connection.AutoShowNewMedia)
                    };
                    connection.Media.Add(media);
                    _repository.AddMedia(media);
                }

                var children = item.Children?.Data?
                    .Where(c => !string.IsNullOrEmpty(c.MediaUrl))
                    .Select(c => new InstagramMediaChild
                    {
                        Type = c.MediaType == InstagramMedia.TypeVideo ? InstagramMedia.TypeVideo : InstagramMedia.TypeImage,
                        Url = c.MediaUrl,
                        ThumbnailUrl = c.ThumbnailUrl
                    })
                    .ToList();

                media.MediaType = item.MediaType is InstagramMedia.TypeVideo or InstagramMedia.TypeCarousel
                    ? item.MediaType
                    : InstagramMedia.TypeImage;
                media.MediaProductType = Truncate(item.MediaProductType, 20);
                media.Caption = Truncate(item.Caption, 2200);
                // فيديو بموسيقى محمية قد يصل بلا media_url — يُعرض غلافه مع رابط إنستغرام
                media.MediaUrl = item.MediaUrl
                                 ?? (media.MediaType == InstagramMedia.TypeCarousel ? children?.FirstOrDefault()?.Url : null);
                media.ThumbnailUrl = item.ThumbnailUrl;
                media.Permalink = Truncate(item.Permalink, 500);
                media.ChildrenJson = SocialMapping.WriteChildren(children);
                media.LikeCount = item.LikeCount;
                media.CommentsCount = item.CommentsCount;
                media.PublishedAt = item.PublishedAtUtc ?? media.PublishedAt;
                media.IsRemoved = false;
            }

            // عند جلب القائمة كاملة: ما لم يعد موجوداً يُعلَّم كمحذوف (يبقى ربطه بالمنتج إن عاد)
            if (complete)
                foreach (var media in connection.Media.Where(m => !seen.Contains(m.ExternalId)))
                    media.IsRemoved = true;
        }

        // توكن منتهٍ أو لا يمكن فكه ⇒ إعادة ربط. يُجدَّد قبل انتهائه بشهر (بشرط مرور 24 ساعة على إصداره)
        private async Task<string> GetValidAccessTokenAsync(InstagramConnection connection, CancellationToken ct)
        {
            if (connection.AccessTokenExpiresAt <= Now || !TryUnprotect(connection.AccessTokenProtected, out var accessToken))
                throw new InstagramApiException("انتهت صلاحية الربط", "token_expired", requiresReconnect: true);

            if (connection.AccessTokenIssuedAt <= Now - TokenMinAgeForRefresh &&
                connection.AccessTokenExpiresAt - Now < TokenRefreshWindow)
            {
                try
                {
                    var token = await _api.RefreshTokenAsync(accessToken, ct);
                    ApplyToken(connection, token);
                    accessToken = token.AccessToken!;
                }
                catch (InstagramApiException ex) when (!ex.RequiresReconnect)
                {
                    // التوكن الحالي ما زال صالحاً — يُعاد التجديد في المزامنة القادمة
                    _logger.LogWarning("Instagram token refresh failed for vendor {VendorId}: {Code}", connection.VendorId, ex.Code);
                }
            }

            return accessToken;
        }

        private void ApplyToken(InstagramConnection connection, InstagramTokenResponse token)
        {
            connection.AccessTokenProtected = _protector.Protect(token.AccessToken!);
            connection.AccessTokenIssuedAt = Now;
            connection.AccessTokenExpiresAt = token.ExpiresIn > 0 ? Now.AddSeconds(token.ExpiresIn) : Now.Add(DefaultTokenLifetime);
        }

        // مفاتيح التشفير تغيّرت أو فُقدت (أو أُلغي التفويض) ⇒ لا يمكن فك التوكن
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

        // ===================================
        // Helpers
        // ===================================
        private void EnsureConfigured()
        {
            if (!_options.IsConfigured)
                throw new BusinessRuleException("ربط إنستغرام غير مفعّل بعد على المنصة");
        }

        private async Task<Guid> GetVendorIdAsync(Guid userId, CancellationToken ct) =>
            await _repository.GetVendorIdByOwnerAsync(userId, ct)
            ?? throw new ForbiddenException("هذا الحساب غير مرتبط بمتجر");

        private async Task<InstagramConnection> GetConnectionOrThrowAsync(Guid userId, bool includeMedia, CancellationToken ct)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            return await _repository.GetConnectionAsync(vendorId, includeMedia, ct)
                ?? throw new NotFoundException("لا يوجد حساب إنستغرام مربوط بمتجرك");
        }

        private static string GenerateToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static string Hash(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

        private static string? Truncate(string? value, int max) =>
            value is { Length: > 0 } && value.Length > max ? value[..max] : value;

        // ===================================
        // Mapping
        // ===================================
        private InstagramStatusDto MapStatus(InstagramConnection? c) => new()
        {
            Configured = _options.IsConfigured,
            Connected = c != null,
            NeedsReconnect = c?.NeedsReconnect ?? false,
            Account = c == null ? null : new InstagramAccountDto
            {
                Username = c.Username,
                Name = c.Name,
                AccountType = c.AccountType,
                ProfilePictureUrl = c.ProfilePictureUrl,
                ProfileUrl = SocialMapping.InstagramProfileUrl(c.Username),
                FollowersCount = c.FollowersCount,
                MediaCount = c.MediaCount
            },
            Settings = c == null ? null : MapSettings(c),
            ConnectedAt = c?.ConnectedAt,
            LastSyncedAt = c?.LastSyncedAt,
            LastSyncError = c?.LastSyncError,
            Scopes = c?.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? new()
        };

        private static InstagramSettingsDto MapSettings(InstagramConnection c) => new()
        {
            ShowOnStore = c.ShowOnStore,
            AutoShowNewMedia = c.AutoShowNewMedia
        };
    }
}
