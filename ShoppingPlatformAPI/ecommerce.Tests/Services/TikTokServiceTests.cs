using System.Security.Cryptography;
using System.Text;
using ecommerce.Core.DTO.TikTok;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.TikTokService;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    public class TikTokServiceTests
    {
        private readonly Mock<ITikTokRepository> _repository = new();
        private readonly Mock<IUnitOfWork> _unitOfWork = new();
        private readonly Mock<ITikTokApiClient> _api = new();
        private readonly FakeTime _time = new(new DateTimeOffset(2026, 9, 29, 12, 0, 0, TimeSpan.Zero));
        private readonly TikTokOptions _options = new()
        {
            ClientKey = "key",
            ClientSecret = "secret",
            RedirectUri = "https://example.com/api/tiktok/callback",
            Scopes = "user.info.basic,video.list"
        };

        private readonly Guid _userId = Guid.NewGuid();
        private readonly Guid _vendorId = Guid.NewGuid();
        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public TikTokServiceTests()
        {
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(_vendorId);
            _api.Setup(a => a.BuildAuthorizeUrl(It.IsAny<string>())).Returns<string>(s => "https://tiktok/auth?state=" + s);
            _api.Setup(a => a.GetUserInfoAsync(It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TikTokUser { DisplayName = "متجر", AvatarUrl = "https://avatar" });
            _api.Setup(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TikTokVideoListData
                {
                    Videos = new() { new TikTokApiVideo { Id = "v1", Title = "فيديو", CreateTime = 1_700_000_000 } },
                    HasMore = false
                });
        }

        private TikTokService CreateService() => new(
            _repository.Object, _unitOfWork.Object, _api.Object, new FakeProtector(),
            Options.Create(_options), _time, NullLogger<TikTokService>.Instance);

        private static string Hash(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

        private TikTokOAuthState PendingState(string nonce, DateTime? expiresAt = null) => new()
        {
            State = "state-1",
            VendorId = _vendorId,
            NonceHash = Hash(nonce),
            ExpiresAt = expiresAt ?? Now.AddMinutes(5)
        };

        private TikTokConnection Connection(Action<TikTokConnection>? configure = null)
        {
            var c = new TikTokConnection
            {
                VendorId = _vendorId,
                OpenId = "open-1",
                AccessTokenProtected = "p:access",
                RefreshTokenProtected = "p:refresh",
                AccessTokenExpiresAt = Now.AddHours(10),
                RefreshTokenExpiresAt = Now.AddDays(300),
                Scopes = "user.info.basic,video.list"
            };
            configure?.Invoke(c);
            _repository.Setup(r => r.GetConnectionAsync(_vendorId, It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(c);
            return c;
        }

        // ===================================
        // بدء الربط
        // ===================================
        [Fact]
        public async Task StartConnect_SavesStateBoundToVendor_WithHashedNonce()
        {
            TikTokOAuthState? saved = null;
            _repository.Setup(r => r.AddStateAsync(It.IsAny<TikTokOAuthState>(), It.IsAny<CancellationToken>()))
                .Callback<TikTokOAuthState, CancellationToken>((s, _) => saved = s);

            var start = await CreateService().StartConnectAsync(_userId);

            Assert.NotNull(saved);
            Assert.Equal(_vendorId, saved!.VendorId);
            Assert.Equal(Hash(start.Nonce), saved.NonceHash);
            Assert.NotEqual(start.Nonce, saved.NonceHash);
            Assert.Equal(Now.AddMinutes(10), saved.ExpiresAt);
            Assert.EndsWith(saved.State, start.AuthorizeUrl);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartConnect_WhenNotConfigured_Throws()
        {
            _options.ClientSecret = "";
            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().StartConnectAsync(_userId));
        }

        [Fact]
        public async Task StartConnect_UserWithoutStore_IsForbidden()
        {
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync((Guid?)null);
            await Assert.ThrowsAsync<ForbiddenException>(() => CreateService().StartConnectAsync(_userId));
        }

        // ===================================
        // العودة من تيك توك
        // ===================================
        [Fact]
        public async Task CompleteConnect_NonceFromAnotherBrowser_IsRejected_AndStateConsumed()
        {
            var pending = PendingState("real-nonce");
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(pending);

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "other-nonce", null);

            Assert.False(result.Success);
            Assert.Equal("invalid_state", result.Reason);
            _repository.Verify(r => r.RemoveState(pending), Times.Once);
            _api.Verify(a => a.ExchangeCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CompleteConnect_ExpiredState_IsRejected()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(PendingState("n", Now.AddMinutes(-1)));

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.Equal("expired", result.Reason);
            _api.Verify(a => a.ExchangeCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CompleteConnect_UserDenied_ReturnsDenied()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));

            var result = await CreateService().CompleteConnectAsync(null, "state-1", "n", "access_denied");

            Assert.Equal("denied", result.Reason);
            _api.Verify(a => a.ExchangeCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CompleteConnect_Success_StoresEncryptedTokens_AndShowsAllVideos()
        {
            _options.Scopes = "user.info.basic,video.list";
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));
            _repository.Setup(r => r.GetConnectionAsync(_vendorId, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((TikTokConnection?)null);
            TikTokConnection? added = null;
            _repository.Setup(r => r.AddConnectionAsync(It.IsAny<TikTokConnection>(), It.IsAny<CancellationToken>()))
                .Callback<TikTokConnection, CancellationToken>((c, _) => { added = c; c.AutoShowNewVideos = false; });
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>())).ReturnsAsync(new TikTokTokenResponse
            {
                AccessToken = "access", RefreshToken = "refresh", OpenId = "open-1",
                ExpiresIn = 86400, RefreshExpiresIn = 31536000, Scope = "user.info.basic,video.list"
            });

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.True(result.Success);
            Assert.NotNull(added);
            Assert.Equal(_vendorId, added!.VendorId);
            Assert.Equal("p:access", added.AccessTokenProtected);
            Assert.Equal("p:refresh", added.RefreshTokenProtected);
            Assert.Equal(Now.AddDays(1), added.AccessTokenExpiresAt);
            Assert.Equal("متجر", added.DisplayName);
            // أول ربط: كل الفيديوهات ظاهرة حتى لو كان الإظهار التلقائي متوقفاً
            var video = Assert.Single(added.Videos);
            Assert.Equal("v1", video.ExternalId);
            Assert.False(video.IsHidden);
        }

        [Fact]
        public async Task CompleteConnect_TokenExchangeFails_ReturnsError()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>()))
                .ThrowsAsync(new TikTokApiException("fail", "invalid_grant"));

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.Equal("token", result.Reason);
            _repository.Verify(r => r.AddConnectionAsync(It.IsAny<TikTokConnection>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ===================================
        // المزامنة والتوكنات
        // ===================================
        [Fact]
        public async Task Sync_ExpiredAccessToken_IsRefreshedFirst()
        {
            var c = Connection(x => x.AccessTokenExpiresAt = Now.AddMinutes(1));
            _api.Setup(a => a.RefreshTokenAsync("refresh", It.IsAny<CancellationToken>())).ReturnsAsync(new TikTokTokenResponse
            {
                AccessToken = "new-access", RefreshToken = "new-refresh", ExpiresIn = 86400, RefreshExpiresIn = 1000
            });

            await CreateService().SyncAsync(_userId);

            Assert.Equal("p:new-access", c.AccessTokenProtected);
            Assert.Equal("p:new-refresh", c.RefreshTokenProtected);
            _api.Verify(a => a.ListVideosAsync("new-access", It.IsAny<long?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Sync_RefreshTokenExpired_MarksNeedsReconnect()
        {
            var c = Connection(x =>
            {
                x.AccessTokenExpiresAt = Now.AddMinutes(-1);
                x.RefreshTokenExpiresAt = Now.AddMinutes(-1);
            });

            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().SyncAsync(_userId));

            Assert.True(c.NeedsReconnect);
            _api.Verify(a => a.RefreshTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Sync_NewVideo_IsHidden_WhenAutoShowIsOff()
        {
            var c = Connection(x => x.AutoShowNewVideos = false);

            await CreateService().SyncAsync(_userId);

            Assert.True(Assert.Single(c.Videos).IsHidden);
        }

        [Fact]
        public async Task Sync_VideoDeletedOnTikTok_IsMarkedRemoved()
        {
            var c = Connection();
            c.Videos.Add(new TikTokVideo { ExternalId = "old", ConnectionId = c.Id });

            await CreateService().SyncAsync(_userId);

            Assert.True(c.Videos.Single(v => v.ExternalId == "old").IsRemoved);
            Assert.False(c.Videos.Single(v => v.ExternalId == "v1").IsRemoved);
        }

        // ===================================
        // ربط الفيديو بمنتج
        // ===================================
        [Fact]
        public async Task UpdateVideo_ProductFromAnotherStore_IsRejected()
        {
            var c = Connection();
            var video = new TikTokVideo { ExternalId = "v1", ConnectionId = c.Id };
            c.Videos.Add(video);
            var foreignProduct = Guid.NewGuid();
            _repository.Setup(r => r.ProductBelongsToVendorAsync(foreignProduct, _vendorId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                CreateService().UpdateVideoAsync(_userId, video.Id, new TikTokVideoUpdateDto { ProductId = foreignProduct }));

            Assert.Null(video.ProductId);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task StoreFeed_WhenNotShownOnStore_IsDisabled()
        {
            _repository.Setup(r => r.GetPublicConnectionAsync(_vendorId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((TikTokConnection?)null);

            var feed = await CreateService().GetStoreFeedAsync(_vendorId);

            Assert.False(feed.Enabled);
            Assert.Empty(feed.Videos);
        }

        // ===================================
        // تحديث فيديوهات المتجر عند فتحها
        // ===================================
        [Fact]
        public async Task RefreshStoreFeed_RecentlySynced_DoesNotCallTikTok()
        {
            Connection(x => x.LastSyncedAt = Now.AddSeconds(-2));

            await CreateService().RefreshStoreFeedAsync(_vendorId);

            _api.Verify(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RefreshStoreFeed_Stale_SyncsNewVideos()
        {
            var c = Connection(x => x.LastSyncedAt = Now.AddMinutes(-10));

            await CreateService().RefreshStoreFeedAsync(_vendorId);

            Assert.Contains(c.Videos, v => v.ExternalId == "v1");
            Assert.Equal(Now, c.LastSyncedAt);
            _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task RefreshStoreFeed_HiddenFromStore_DoesNotSync()
        {
            Connection(x => { x.LastSyncedAt = Now.AddHours(-1); x.ShowOnStore = false; });

            await CreateService().RefreshStoreFeedAsync(_vendorId);

            _api.Verify(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<long?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ===================================
        // صفحة ريلز
        // ===================================
        [Fact]
        public async Task GetReels_ReturnsPageWithStore_AndDetectsNextPage()
        {
            var vendor = new Vendor { Id = _vendorId, Name = "City", NameAr = "أزياء المدينة", LogoUrl = "/logo.png" };
            var connection = new TikTokConnection { VendorId = _vendorId, Vendor = vendor };
            var videos = Enumerable.Range(1, 3)
                .Select(i => new TikTokVideo { ExternalId = "v" + i, Title = "فيديو " + i, Connection = connection })
                .ToList();
            // حجم الصفحة 2 ⇒ يُطلب 3 لمعرفة وجود صفحة تالية
            _repository.Setup(r => r.GetPublicReelsAsync(2, 3, It.IsAny<CancellationToken>())).ReturnsAsync(videos);

            var page = await CreateService().GetReelsAsync(page: 2, pageSize: 2);

            Assert.True(page.HasMore);
            Assert.Equal(2, page.Items.Count);
            Assert.Equal("v1", page.Items[0].ExternalId);
            Assert.Equal("أزياء المدينة", page.Items[0].Store.NameAr);
            Assert.Equal(_vendorId, page.Items[0].Store.Id);
        }

        [Fact]
        public async Task RefreshReels_SyncsDueVisibleStores_AndSkipsFailingOne()
        {
            TikTokConnection Due(string token) => new()
            {
                VendorId = Guid.NewGuid(), OpenId = token,
                AccessTokenProtected = "p:" + token, RefreshTokenProtected = "p:r",
                AccessTokenExpiresAt = Now.AddHours(10), RefreshTokenExpiresAt = Now.AddDays(300),
                Scopes = "user.info.basic,video.list", LastSyncedAt = Now.AddMinutes(-5)
            };
            var failing = Due("bad");
            var healthy = Due("good");
            _repository.Setup(r => r.GetConnectionsDueForSyncAsync(Now.AddSeconds(-5), It.IsAny<int>(), It.IsAny<CancellationToken>(), true))
                .ReturnsAsync(new List<TikTokConnection> { failing, healthy });
            _api.Setup(a => a.ListVideosAsync("bad", It.IsAny<long?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new HttpRequestException("timeout"));
            _repository.Setup(r => r.GetPublicReelsAsync(0, 11, It.IsAny<CancellationToken>())).ReturnsAsync(new List<TikTokVideo>());

            var page = await CreateService().RefreshReelsAsync(pageSize: 10);

            Assert.Contains(healthy.Videos, v => v.ExternalId == "v1");
            Assert.Equal(Now, healthy.LastSyncedAt);
            Assert.Equal(1, page.Page);
            _repository.Verify(r => r.GetPublicReelsAsync(0, 11, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task RefreshReels_WhenNotConfigured_OnlyReadsSavedReels()
        {
            _options.ClientSecret = "";
            _repository.Setup(r => r.GetPublicReelsAsync(0, 11, It.IsAny<CancellationToken>())).ReturnsAsync(new List<TikTokVideo>());

            await CreateService().RefreshReelsAsync(pageSize: 10);

            _repository.Verify(r => r.GetConnectionsDueForSyncAsync(It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>(), It.IsAny<bool>()), Times.Never);
        }

        // ===================================
        // Fakes
        // ===================================
        private sealed class FakeProtector : ITikTokTokenProtector
        {
            public string Protect(string token) => "p:" + token;
            public string Unprotect(string protectedToken) =>
                protectedToken.StartsWith("p:") ? protectedToken[2..] : throw new CryptographicException();
        }

        private sealed class FakeTime : TimeProvider
        {
            private readonly DateTimeOffset _now;
            public FakeTime(DateTimeOffset now) => _now = now;
            public override DateTimeOffset GetUtcNow() => _now;
        }
    }
}
