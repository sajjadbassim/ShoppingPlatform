using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using ecommerce.Core.DTO.TikTok;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using Microsoft.Extensions.Options;

namespace ecommerce.Services.TikTokService
{
    // نتيجة العودة من تيك توك — Reason يُمرَّر للواجهة لعرض رسالة مناسبة
    public record TikTokConnectResult(bool Success, string? Reason = null)
    {
        public static TikTokConnectResult Ok() => new(true);
        public static TikTokConnectResult Fail(string reason) => new(false, reason);
    }

    // بداية الربط: الرابط الذي يُفتح في المتصفح + قيمة الكوكي التي تُثبت أن العودة من نفس المتصفح
    public record TikTokConnectStart(string AuthorizeUrl, string Nonce);

    public interface ITikTokService
    {
        Task<TikTokStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default);
        Task<TikTokConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default);
        Task<TikTokConnectResult> CompleteConnectAsync(string? code, string? state, string? nonce, string? error, CancellationToken ct = default);
        Task<TikTokStatusDto> SyncAsync(Guid userId, CancellationToken ct = default);
        Task<List<TikTokVideoDto>> GetVideosAsync(Guid userId, CancellationToken ct = default);
        Task<TikTokVideoDto> UpdateVideoAsync(Guid userId, Guid videoId, TikTokVideoUpdateDto dto, CancellationToken ct = default);
        Task<TikTokSettingsDto> UpdateSettingsAsync(Guid userId, TikTokSettingsUpdateDto dto, CancellationToken ct = default);
        Task DisconnectAsync(Guid userId, CancellationToken ct = default);
        Task<TikTokStoreFeedDto> GetStoreFeedAsync(Guid vendorId, CancellationToken ct = default);

        // صفحة "ريلز" العامة
        Task<TikTokReelsPageDto> GetReelsAsync(int page, int pageSize, CancellationToken ct = default);

        // يزامن كل الحسابات المعروضة مع تيك توك (عدا ما زُومِن قبل ثوانٍ) ثم يعيد الصفحة الأولى
        Task<TikTokReelsPageDto> RefreshReelsAsync(int pageSize, CancellationToken ct = default);

        // يزامن فيديوهات المتجر مع تيك توك (بحد أقصى مرة كل StoreRefreshSeconds) ثم يعيد القائمة
        Task<TikTokStoreFeedDto> RefreshStoreFeedAsync(Guid vendorId, CancellationToken ct = default);

        // للمزامنة الدورية في الخلفية — يعيد عدد الحسابات التي تمت مزامنتها
        Task<int> SyncDueConnectionsAsync(CancellationToken ct = default);
    }

    public class TikTokService : ITikTokService
    {
        public const string ScopeVideoList = "video.list";
        public const string ScopeProfile = "user.info.profile";
        public const string ScopeStats = "user.info.stats";

        private static readonly TimeSpan StateLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan TokenRefreshMargin = TimeSpan.FromMinutes(5);

        // مزامنة واحدة لكل متجر في نفس الوقت — تمنع تكرار إدراج نفس الفيديو عند تزامن عدة زوار
        private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> StoreSyncLocks = new();

        // تحديث واحد لصفحة ريلز في نفس الوقت — الطلب المتزامن ينتظر انتهاءه ثم يأخذ النتيجة الجديدة
        private static readonly SemaphoreSlim ReelsRefreshGate = new(1, 1);
        private const int ReelsRefreshMaxStores = 50;
        private static readonly TimeSpan RefreshWaitLimit = TimeSpan.FromSeconds(20);

        private readonly ITikTokRepository _repository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ITikTokApiClient _api;
        private readonly ITikTokTokenProtector _protector;
        private readonly TikTokOptions _options;
        private readonly TimeProvider _time;
        private readonly ILogger<TikTokService> _logger;

        public TikTokService(
            ITikTokRepository repository,
            IUnitOfWork unitOfWork,
            ITikTokApiClient api,
            ITikTokTokenProtector protector,
            IOptions<TikTokOptions> options,
            TimeProvider time,
            ILogger<TikTokService> logger)
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

        private TimeSpan StoreRefreshInterval => TimeSpan.FromSeconds(Math.Max(1, _options.StoreRefreshSeconds));

        // ===================================
        // الحالة
        // ===================================
        public async Task<TikTokStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            var connection = await _repository.GetConnectionAsync(vendorId, includeVideos: false, ct);
            return MapStatus(connection);
        }

        // ===================================
        // الخطوة 1: إنشاء رابط التفويض
        // ===================================
        public async Task<TikTokConnectStart> StartConnectAsync(Guid userId, CancellationToken ct = default)
        {
            EnsureConfigured();
            var vendorId = await GetVendorIdAsync(userId, ct);

            var state = GenerateToken();
            var nonce = GenerateToken();

            await _repository.AddStateAsync(new TikTokOAuthState
            {
                State = state,
                VendorId = vendorId,
                NonceHash = Hash(nonce),
                CreatedAt = Now,
                ExpiresAt = Now.Add(StateLifetime)
            }, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return new TikTokConnectStart(_api.BuildAuthorizeUrl(state), nonce);
        }

        // ===================================
        // الخطوة 2: العودة من تيك توك
        // لا يعتمد على JWT (المتصفح لا يرسله في التوجيه) — المتجر يُعرف من state المحفوظ في الخادم
        // ===================================
        public async Task<TikTokConnectResult> CompleteConnectAsync(
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
                _logger.LogInformation("TikTok authorization not granted: {Error}", error);
                return TikTokConnectResult.Fail("denied");
            }

            if (string.IsNullOrEmpty(code) || pending == null)
                return TikTokConnectResult.Fail("invalid_state");

            if (pending.ExpiresAt < Now)
                return TikTokConnectResult.Fail("expired");

            if (string.IsNullOrEmpty(nonce) ||
                !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(nonce)), Encoding.UTF8.GetBytes(pending.NonceHash)))
            {
                _logger.LogWarning("TikTok callback rejected: nonce mismatch for vendor {VendorId}", pending.VendorId);
                return TikTokConnectResult.Fail("invalid_state");
            }

            TikTokTokenResponse token;
            try
            {
                token = await _api.ExchangeCodeAsync(code, ct);
            }
            catch (TikTokApiException)
            {
                return TikTokConnectResult.Fail("token");
            }

            if (string.IsNullOrEmpty(token.OpenId) || string.IsNullOrEmpty(token.RefreshToken))
                return TikTokConnectResult.Fail("token");

            var connection = await _repository.GetConnectionAsync(pending.VendorId, includeVideos: true, ct);
            if (connection == null)
            {
                connection = new TikTokConnection { VendorId = pending.VendorId };
                await _repository.AddConnectionAsync(connection, ct);
            }
            else if (connection.OpenId != token.OpenId)
            {
                // ربط حساب مختلف: فيديوهات الحساب السابق لم تعد تخص المتجر
                connection.Videos.Clear();
                connection.DisplayName = connection.Username = connection.AvatarUrl = connection.ProfileUrl = null;
                connection.FollowerCount = connection.LikesCount = connection.VideoCount = null;
            }

            var isNewAccount = connection.Videos.Count == 0;
            ApplyToken(connection, token);
            connection.OpenId = token.OpenId;
            connection.ConnectedAt = Now;
            connection.NeedsReconnect = false;
            connection.LastSyncError = null;
            await _unitOfWork.SaveChangesAsync(ct);

            _logger.LogInformation("Vendor {VendorId} connected TikTok account {OpenId}", pending.VendorId, token.OpenId);

            // جلب الحساب والفيديوهات فوراً — فشلها لا يُلغي الربط، وستُعاد بالمزامنة الدورية
            await SyncConnectionAsync(connection, showAllNewVideos: isNewAccount, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return TikTokConnectResult.Ok();
        }

        // ===================================
        // المزامنة اليدوية
        // ===================================
        public async Task<TikTokStatusDto> SyncAsync(Guid userId, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeVideos: true, ct);
            await SyncConnectionAsync(connection, showAllNewVideos: false, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            if (connection.NeedsReconnect)
                throw new BusinessRuleException("انتهت صلاحية الربط مع تيك توك، يرجى إعادة ربط الحساب");
            if (connection.LastSyncError != null)
                throw new BusinessRuleException("تعذّرت المزامنة مع تيك توك حالياً، حاول لاحقاً");

            return MapStatus(connection);
        }

        public async Task<int> SyncDueConnectionsAsync(CancellationToken ct = default)
        {
            if (!_options.IsConfigured) return 0;

            await _repository.DeleteExpiredStatesAsync(Now, ct);

            var due = await _repository.GetConnectionsDueForSyncAsync(
                Now.AddMinutes(-Math.Max(5, _options.SyncIntervalMinutes)), take: 50, ct);

            foreach (var connection in due)
            {
                await SyncConnectionAsync(connection, showAllNewVideos: false, ct);
                await _unitOfWork.SaveChangesAsync(ct);
            }
            return due.Count;
        }

        // ===================================
        // الفيديوهات والإعدادات
        // ===================================
        public async Task<List<TikTokVideoDto>> GetVideosAsync(Guid userId, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeVideos: true, ct);
            return connection.Videos
                .Where(v => !v.IsRemoved)
                .OrderByDescending(v => v.PublishedAt)
                .Select(MapVideo)
                .ToList();
        }

        public async Task<TikTokVideoDto> UpdateVideoAsync(Guid userId, Guid videoId, TikTokVideoUpdateDto dto, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeVideos: true, ct);
            var video = connection.Videos.FirstOrDefault(v => v.Id == videoId && !v.IsRemoved)
                ?? throw new NotFoundException("الفيديو غير موجود");

            if (dto.IsHidden.HasValue)
                video.IsHidden = dto.IsHidden.Value;

            if (dto.RemoveProduct)
            {
                video.ProductId = null;
                video.Product = null;
            }
            else if (dto.ProductId.HasValue)
            {
                // التاجر يربط الفيديو بمنتجاته فقط
                if (!await _repository.ProductBelongsToVendorAsync(dto.ProductId.Value, connection.VendorId, ct))
                    throw new BusinessRuleException("المنتج غير موجود في متجرك");
                video.ProductId = dto.ProductId.Value;
            }

            await _unitOfWork.SaveChangesAsync(ct);

            // إعادة تحميل المنتج المربوط للاستجابة
            var reloaded = await _repository.GetConnectionAsync(connection.VendorId, includeVideos: true, ct);
            return MapVideo(reloaded!.Videos.First(v => v.Id == videoId));
        }

        public async Task<TikTokSettingsDto> UpdateSettingsAsync(Guid userId, TikTokSettingsUpdateDto dto, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeVideos: false, ct);
            if (dto.ShowOnStore.HasValue) connection.ShowOnStore = dto.ShowOnStore.Value;
            if (dto.AutoShowNewVideos.HasValue) connection.AutoShowNewVideos = dto.AutoShowNewVideos.Value;
            await _unitOfWork.SaveChangesAsync(ct);
            return MapSettings(connection);
        }

        // ===================================
        // إلغاء الربط
        // ===================================
        public async Task DisconnectAsync(Guid userId, CancellationToken ct = default)
        {
            var connection = await GetConnectionOrThrowAsync(userId, includeVideos: true, ct);

            // إلغاء الإذن من جهة تيك توك — فشله لا يمنع حذف الربط من المنصة
            if (_options.IsConfigured && TryUnprotect(connection.AccessTokenProtected, out var accessToken))
            {
                try { await _api.RevokeAsync(accessToken, ct); }
                catch (Exception ex) when (ex is TikTokApiException or HttpRequestException or TaskCanceledException)
                {
                    _logger.LogWarning(ex, "TikTok revoke failed for vendor {VendorId}", connection.VendorId);
                }
            }

            _repository.RemoveConnection(connection);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        // ===================================
        // العرض العام في صفحة المتجر
        // ===================================
        public async Task<TikTokStoreFeedDto> RefreshStoreFeedAsync(Guid vendorId, CancellationToken ct = default)
        {
            if (_options.IsConfigured)
            {
                var gate = StoreSyncLocks.GetOrAdd(vendorId, _ => new SemaphoreSlim(1, 1));

                // مزامنة جارية لنفس المتجر ⇒ ننتظر انتهاءها (فتصبح حديثة ولا تتكرر) ثم نعيد النتيجة
                if (await gate.WaitAsync(RefreshWaitLimit, ct))
                {
                    try
                    {
                        var connection = await _repository.GetConnectionAsync(vendorId, includeVideos: true, ct);
                        if (connection is { ShowOnStore: true, NeedsReconnect: false } &&
                            (connection.LastSyncedAt == null || connection.LastSyncedAt <= Now - StoreRefreshInterval))
                        {
                            await SyncConnectionAsync(connection, showAllNewVideos: false, ct);
                            await _unitOfWork.SaveChangesAsync(ct);
                        }
                    }
                    finally
                    {
                        gate.Release();
                    }
                }
            }

            return await GetStoreFeedAsync(vendorId, ct);
        }

        public async Task<TikTokReelsPageDto> RefreshReelsAsync(int pageSize, CancellationToken ct = default)
        {
            if (_options.IsConfigured && await ReelsRefreshGate.WaitAsync(RefreshWaitLimit, ct))
            {
                try
                {
                    var due = await _repository.GetConnectionsDueForSyncAsync(
                        Now - StoreRefreshInterval, ReelsRefreshMaxStores, ct, onlyVisible: true);

                    foreach (var connection in due)
                    {
                        var gate = StoreSyncLocks.GetOrAdd(connection.VendorId, _ => new SemaphoreSlim(1, 1));
                        if (!await gate.WaitAsync(0, ct)) continue;
                        try
                        {
                            await SyncConnectionAsync(connection, showAllNewVideos: false, ct);
                            await _unitOfWork.SaveChangesAsync(ct);
                        }
                        catch (Exception ex) when (ex is not OperationCanceledException)
                        {
                            // متجر واحد متعطل لا يمنع تحديث البقية
                            _logger.LogWarning(ex, "Reels refresh failed for vendor {VendorId}", connection.VendorId);
                        }
                        finally
                        {
                            gate.Release();
                        }
                    }
                }
                finally
                {
                    ReelsRefreshGate.Release();
                }
            }

            return await GetReelsAsync(1, pageSize, ct);
        }

        public async Task<TikTokReelsPageDto> GetReelsAsync(int page, int pageSize, CancellationToken ct = default)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 30);

            var videos = await _repository.GetPublicReelsAsync((page - 1) * pageSize, pageSize + 1, ct);
            var hasMore = videos.Count > pageSize;

            return new TikTokReelsPageDto
            {
                Page = page,
                HasMore = hasMore,
                Items = videos.Take(pageSize).Select(v =>
                {
                    var dto = new TikTokReelDto
                    {
                        Store = new TikTokReelStoreDto
                        {
                            Id = v.Connection.Vendor.Id,
                            Name = v.Connection.Vendor.Name,
                            NameAr = v.Connection.Vendor.NameAr,
                            LogoUrl = v.Connection.Vendor.LogoUrl
                        }
                    };
                    CopyVideo(MapVideo(v), dto);
                    return dto;
                }).ToList()
            };
        }

        private static void CopyVideo(TikTokVideoDto from, TikTokVideoDto to)
        {
            to.Id = from.Id;
            to.ExternalId = from.ExternalId;
            to.Title = from.Title;
            to.CoverImageUrl = from.CoverImageUrl;
            to.ShareUrl = from.ShareUrl;
            to.EmbedLink = from.EmbedLink;
            to.DurationSeconds = from.DurationSeconds;
            to.ViewCount = from.ViewCount;
            to.LikeCount = from.LikeCount;
            to.PublishedAt = from.PublishedAt;
            to.IsHidden = from.IsHidden;
            to.Product = from.Product;
        }

        public async Task<TikTokStoreFeedDto> GetStoreFeedAsync(Guid vendorId, CancellationToken ct = default)
        {
            var connection = await _repository.GetPublicConnectionAsync(vendorId, ct);
            if (connection == null)
                return new TikTokStoreFeedDto { Enabled = false };

            return new TikTokStoreFeedDto
            {
                Enabled = true,
                Account = MapAccount(connection),
                Videos = connection.Videos
                    .OrderByDescending(v => v.PublishedAt)
                    .Select(MapVideo)
                    .ToList()
            };
        }

        // ===================================
        // المزامنة مع تيك توك
        // لا ترمي أخطاء تيك توك — تسجّلها في LastSyncError / NeedsReconnect. الحفظ على المُستدعي
        // ===================================
        private async Task SyncConnectionAsync(TikTokConnection connection, bool showAllNewVideos, CancellationToken ct)
        {
            try
            {
                var accessToken = await GetValidAccessTokenAsync(connection, ct);

                var user = await _api.GetUserInfoAsync(accessToken, UserFields(connection), ct);
                if (user != null)
                {
                    connection.DisplayName = user.DisplayName ?? connection.DisplayName;
                    connection.AvatarUrl = user.AvatarUrl ?? connection.AvatarUrl;
                    connection.Username = user.Username ?? connection.Username;
                    connection.ProfileUrl = user.ProfileDeepLink ?? connection.ProfileUrl;
                    connection.FollowerCount = user.FollowerCount ?? connection.FollowerCount;
                    connection.LikesCount = user.LikesCount ?? connection.LikesCount;
                    connection.VideoCount = user.VideoCount ?? connection.VideoCount;
                }

                if (connection.HasScope(ScopeVideoList))
                    await SyncVideosAsync(connection, accessToken, showAllNewVideos, ct);

                connection.LastSyncedAt = Now;
                connection.LastSyncError = null;
            }
            catch (TikTokApiException ex)
            {
                connection.LastSyncedAt = Now;
                connection.LastSyncError = ex.Code ?? ex.Message;
                if (ex.RequiresReconnect) connection.NeedsReconnect = true;
                _logger.LogWarning("TikTok sync failed for vendor {VendorId}: {Code}", connection.VendorId, ex.Code);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                connection.LastSyncedAt = Now;
                connection.LastSyncError = "network";
                _logger.LogWarning(ex, "TikTok sync network error for vendor {VendorId}", connection.VendorId);
            }
        }

        private async Task SyncVideosAsync(TikTokConnection connection, string accessToken, bool showAllNewVideos, CancellationToken ct)
        {
            var fetched = new List<TikTokApiVideo>();
            long? cursor = null;
            var complete = false;

            while (fetched.Count < _options.MaxVideos)
            {
                var page = await _api.ListVideosAsync(accessToken, cursor, Math.Min(20, _options.MaxVideos - fetched.Count), ct);
                fetched.AddRange((page.Videos ?? new()).Where(v => !string.IsNullOrEmpty(v.Id)));
                if (!page.HasMore) { complete = true; break; }
                cursor = page.Cursor;
            }

            var existing = connection.Videos.ToDictionary(v => v.ExternalId);
            var seen = new HashSet<string>();

            foreach (var item in fetched)
            {
                if (!seen.Add(item.Id!)) continue;

                if (!existing.TryGetValue(item.Id!, out var video))
                {
                    video = new TikTokVideo
                    {
                        ConnectionId = connection.Id,
                        ExternalId = item.Id!,
                        IsHidden = !(showAllNewVideos || connection.AutoShowNewVideos)
                    };
                    connection.Videos.Add(video);
                    _repository.AddVideo(video);
                }

                video.Title = Truncate(!string.IsNullOrWhiteSpace(item.Title) ? item.Title : item.VideoDescription, 500);
                video.CoverImageUrl = Truncate(item.CoverImageUrl, 2000);
                video.ShareUrl = Truncate(item.ShareUrl, 2000);
                video.EmbedLink = Truncate(item.EmbedLink, 2000);
                video.DurationSeconds = item.Duration;
                video.ViewCount = item.ViewCount;
                video.LikeCount = item.LikeCount;
                video.PublishedAt = item.CreateTime.HasValue
                    ? DateTimeOffset.FromUnixTimeSeconds(item.CreateTime.Value).UtcDateTime
                    : video.PublishedAt;
                video.IsRemoved = false;
            }

            // عند جلب القائمة كاملة: ما لم يعد موجوداً في تيك توك يُعلَّم كمحذوف (يبقى ربطه بالمنتج إن عاد)
            if (complete)
                foreach (var video in connection.Videos.Where(v => !seen.Contains(v.ExternalId)))
                    video.IsRemoved = true;
        }

        // يجدد التوكن قبل انتهائه بدقائق. refresh token منتهٍ ⇒ يلزم إعادة الربط
        private async Task<string> GetValidAccessTokenAsync(TikTokConnection connection, CancellationToken ct)
        {
            if (connection.AccessTokenExpiresAt > Now.Add(TokenRefreshMargin) &&
                TryUnprotect(connection.AccessTokenProtected, out var accessToken))
                return accessToken;

            if (connection.RefreshTokenExpiresAt <= Now || !TryUnprotect(connection.RefreshTokenProtected, out var refreshToken))
                throw new TikTokApiException("انتهت صلاحية الربط", "refresh_expired", requiresReconnect: true);

            var token = await _api.RefreshTokenAsync(refreshToken, ct);
            ApplyToken(connection, token);
            return token.AccessToken!;
        }

        private void ApplyToken(TikTokConnection connection, TikTokTokenResponse token)
        {
            connection.AccessTokenProtected = _protector.Protect(token.AccessToken!);
            connection.AccessTokenExpiresAt = Now.AddSeconds(token.ExpiresIn);

            // تيك توك قد يعيد refresh token جديداً مع التجديد
            if (!string.IsNullOrEmpty(token.RefreshToken))
            {
                connection.RefreshTokenProtected = _protector.Protect(token.RefreshToken);
                connection.RefreshTokenExpiresAt = Now.AddSeconds(token.RefreshExpiresIn);
            }
            if (!string.IsNullOrEmpty(token.Scope))
                connection.Scopes = token.Scope;
        }

        // مفاتيح التشفير تغيّرت أو فُقدت ⇒ لا يمكن فك التوكن
        private bool TryUnprotect(string protectedValue, out string value)
        {
            try
            {
                value = _protector.Unprotect(protectedValue);
                return true;
            }
            catch (CryptographicException)
            {
                value = "";
                return false;
            }
        }

        private static IEnumerable<string> UserFields(TikTokConnection connection)
        {
            var fields = new List<string> { "open_id", "avatar_url", "display_name" };
            if (connection.HasScope(ScopeProfile)) fields.AddRange(new[] { "username", "profile_deep_link" });
            if (connection.HasScope(ScopeStats)) fields.AddRange(new[] { "follower_count", "likes_count", "video_count" });
            return fields;
        }

        // ===================================
        // Helpers
        // ===================================
        private void EnsureConfigured()
        {
            if (!_options.IsConfigured)
                throw new BusinessRuleException("ربط تيك توك غير مفعّل بعد على المنصة");
        }

        private async Task<Guid> GetVendorIdAsync(Guid userId, CancellationToken ct) =>
            await _repository.GetVendorIdByOwnerAsync(userId, ct)
            ?? throw new ForbiddenException("هذا الحساب غير مرتبط بمتجر");

        private async Task<TikTokConnection> GetConnectionOrThrowAsync(Guid userId, bool includeVideos, CancellationToken ct)
        {
            var vendorId = await GetVendorIdAsync(userId, ct);
            return await _repository.GetConnectionAsync(vendorId, includeVideos, ct)
                ?? throw new NotFoundException("لا يوجد حساب تيك توك مربوط بمتجرك");
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
        private TikTokStatusDto MapStatus(TikTokConnection? c) => new()
        {
            Configured = _options.IsConfigured,
            Connected = c != null,
            NeedsReconnect = c?.NeedsReconnect ?? false,
            Account = c == null ? null : MapAccount(c),
            Settings = c == null ? null : MapSettings(c),
            ConnectedAt = c?.ConnectedAt,
            LastSyncedAt = c?.LastSyncedAt,
            LastSyncError = c?.LastSyncError,
            Scopes = c?.Scopes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? new()
        };

        private static TikTokAccountDto MapAccount(TikTokConnection c) => new()
        {
            DisplayName = c.DisplayName,
            Username = c.Username,
            AvatarUrl = c.AvatarUrl,
            ProfileUrl = c.ProfileUrl,
            FollowerCount = c.FollowerCount,
            LikesCount = c.LikesCount,
            VideoCount = c.VideoCount
        };

        private static TikTokSettingsDto MapSettings(TikTokConnection c) => new()
        {
            ShowOnStore = c.ShowOnStore,
            AutoShowNewVideos = c.AutoShowNewVideos
        };

        private static TikTokVideoDto MapVideo(TikTokVideo v) => new()
        {
            Id = v.Id,
            ExternalId = v.ExternalId,
            Title = v.Title,
            CoverImageUrl = v.CoverImageUrl,
            ShareUrl = v.ShareUrl,
            EmbedLink = v.EmbedLink,
            DurationSeconds = v.DurationSeconds,
            ViewCount = v.ViewCount,
            LikeCount = v.LikeCount,
            PublishedAt = v.PublishedAt,
            IsHidden = v.IsHidden,
            // المنتج المحذوف (غير نشط) لا يُعرض كرابط شراء
            Product = v.Product is { IsActive: true } p ? new TikTokLinkedProductDto
            {
                Id = p.Id,
                Name = p.Name,
                NameAr = p.NameAr,
                Price = p.Price,
                OriginalPrice = p.OriginalPrice,
                IsAvailable = p.IsAvailable && p.StockQuantity > 0,
                PrimaryImageUrl = (p.Images?.FirstOrDefault(i => i.IsPrimary) ?? p.Images?.OrderBy(i => i.DisplayOrder).FirstOrDefault())?.ImageUrl
            } : null
        };
    }
}
