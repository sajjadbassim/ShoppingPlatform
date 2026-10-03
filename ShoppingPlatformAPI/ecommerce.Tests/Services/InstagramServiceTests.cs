using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.InstagramService;
using ecommerce.Services.SocialFeedService;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    public class InstagramServiceTests
    {
        private readonly Mock<IInstagramRepository> _repository = new();
        private readonly Mock<IUnitOfWork> _unitOfWork = new();
        private readonly Mock<IInstagramApiClient> _api = new();
        private readonly FakeTime _time = new(new DateTimeOffset(2026, 10, 3, 12, 0, 0, TimeSpan.Zero));
        private readonly InstagramOptions _options = new()
        {
            AppId = "app",
            AppSecret = "secret",
            RedirectUri = "https://example.com/api/integrations/instagram/callback"
        };

        private readonly Guid _userId = Guid.NewGuid();
        private readonly Guid _vendorId = Guid.NewGuid();
        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public InstagramServiceTests()
        {
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(_vendorId);
            _repository.Setup(r => r.ConnectionExistsAsync(_vendorId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _api.Setup(a => a.BuildAuthorizeUrl(It.IsAny<string>())).Returns<string>(s => "https://instagram/auth?state=" + s);
            _api.Setup(a => a.GetProfileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramProfile { UserId = "acc-1", Username = "store", AccountType = "BUSINESS" });
            _api.Setup(a => a.ListMediaAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramMediaPage
                {
                    Data = new() { new InstagramApiMedia { Id = "m1", MediaType = "VIDEO", MediaUrl = "https://v.mp4", ThumbnailUrl = "https://t.jpg", Timestamp = "2024-06-19T23:46:15+0000" } }
                });
        }

        private InstagramService CreateService() => new(
            _repository.Object, _unitOfWork.Object, _api.Object, new FakeProtector(),
            Options.Create(_options), _time, NullLogger<InstagramService>.Instance);

        private static string Hash(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

        private InstagramOAuthState PendingState(string nonce, DateTime? expiresAt = null) => new()
        {
            State = "state-1",
            VendorId = _vendorId,
            NonceHash = Hash(nonce),
            ExpiresAt = expiresAt ?? Now.AddMinutes(5)
        };

        private InstagramConnection Connection(Action<InstagramConnection>? configure = null)
        {
            var c = new InstagramConnection
            {
                VendorId = _vendorId,
                InstagramUserId = "ig-1",
                AccessTokenProtected = "p:access",
                AccessTokenIssuedAt = Now.AddDays(-1),
                AccessTokenExpiresAt = Now.AddDays(55),
                Scopes = "instagram_business_basic"
            };
            configure?.Invoke(c);
            _repository.Setup(r => r.GetConnectionAsync(_vendorId, It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(c);
            return c;
        }

        private void SetupTokenExchange(string userId = "ig-1")
        {
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramShortToken("short", userId, "instagram_business_basic"));
            _api.Setup(a => a.ExchangeForLongLivedTokenAsync("short", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramTokenResponse { AccessToken = "long", ExpiresIn = 5_184_000 });
        }

        // ===================================
        // بدء الربط
        // ===================================
        [Fact]
        public async Task StartConnect_SavesStateBoundToVendor_WithHashedNonce()
        {
            InstagramOAuthState? saved = null;
            _repository.Setup(r => r.AddStateAsync(It.IsAny<InstagramOAuthState>(), It.IsAny<CancellationToken>()))
                .Callback<InstagramOAuthState, CancellationToken>((s, _) => saved = s);

            var start = await CreateService().StartConnectAsync(_userId);

            Assert.NotNull(saved);
            Assert.Equal(_vendorId, saved!.VendorId);
            Assert.Equal(Hash(start.Nonce), saved.NonceHash);
            Assert.Equal(Now.AddMinutes(10), saved.ExpiresAt);
            Assert.EndsWith(saved.State, start.AuthorizeUrl);
        }

        [Fact]
        public async Task StartConnect_WhenNotConfigured_Throws()
        {
            _options.AppSecret = "";
            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().StartConnectAsync(_userId));
        }

        [Fact]
        public async Task StartConnect_UserWithoutStore_IsForbidden()
        {
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync((Guid?)null);
            await Assert.ThrowsAsync<ForbiddenException>(() => CreateService().StartConnectAsync(_userId));
        }

        // ===================================
        // العودة من إنستغرام
        // ===================================
        [Fact]
        public async Task CompleteConnect_NonceFromAnotherBrowser_IsRejected_AndStateConsumed()
        {
            var pending = PendingState("real-nonce");
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(pending);

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "other-nonce", null);

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
        }

        [Fact]
        public async Task CompleteConnect_UserDenied_ReturnsDenied()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));

            var result = await CreateService().CompleteConnectAsync(null, "state-1", "n", "access_denied");

            Assert.Equal("denied", result.Reason);
        }

        [Fact]
        public async Task CompleteConnect_TokenExchangeFails_ReturnsToken()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InstagramApiException("bad", "OAuthException"));

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.Equal("token", result.Reason);
            _repository.Verify(r => r.AddConnectionAsync(It.IsAny<InstagramConnection>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CompleteConnect_NewConnection_StoresLongLivedToken_AndShowsAllMedia()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));
            SetupTokenExchange();
            InstagramConnection? added = null;
            _repository.Setup(r => r.AddConnectionAsync(It.IsAny<InstagramConnection>(), It.IsAny<CancellationToken>()))
                .Callback<InstagramConnection, CancellationToken>((c, _) => added = c);

            var result = await CreateService().CompleteConnectAsync("code#_", "state-1", "n", null);

            Assert.True(result.Success);
            _api.Verify(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>()), Times.Once);
            Assert.NotNull(added);
            Assert.Equal("ig-1", added!.InstagramUserId);
            Assert.Equal("acc-1", added.AccountId);
            Assert.Equal("p:long", added.AccessTokenProtected);
            Assert.Equal(Now.AddDays(60), added.AccessTokenExpiresAt);
            Assert.Equal("store", added.Username);
            var media = Assert.Single(added.Media);
            Assert.False(media.IsHidden);
            Assert.Equal(new DateTime(2024, 6, 19, 23, 46, 15, DateTimeKind.Utc), media.PublishedAt);
        }

        [Fact]
        public async Task CompleteConnect_DifferentAccount_ClearsPreviousMedia()
        {
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(PendingState("n"));
            SetupTokenExchange(userId: "ig-2");
            var connection = Connection(c =>
            {
                c.Username = "old";
                c.Media.Add(new InstagramMedia { ExternalId = "old-media" });
            });

            await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.Equal("ig-2", connection.InstagramUserId);
            Assert.DoesNotContain(connection.Media, m => m.ExternalId == "old-media");
            Assert.Equal("store", connection.Username);
        }

        // ===================================
        // التوكن والمزامنة
        // ===================================
        [Fact]
        public async Task Sync_TokenNearExpiry_IsRefreshed()
        {
            var connection = Connection(c =>
            {
                c.AccessTokenIssuedAt = Now.AddDays(-40);
                c.AccessTokenExpiresAt = Now.AddDays(20);
            });
            _api.Setup(a => a.RefreshTokenAsync("access", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramTokenResponse { AccessToken = "renewed", ExpiresIn = 5_184_000 });

            await CreateService().SyncAsync(_userId);

            Assert.Equal("p:renewed", connection.AccessTokenProtected);
            Assert.Equal(Now, connection.AccessTokenIssuedAt);
            _api.Verify(a => a.GetProfileAsync("renewed", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Sync_FreshToken_IsNotRefreshed()
        {
            Connection(c => c.AccessTokenIssuedAt = Now.AddHours(-2));

            await CreateService().SyncAsync(_userId);

            _api.Verify(a => a.RefreshTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Sync_ExpiredToken_MarksNeedsReconnect_AndThrows()
        {
            var connection = Connection(c => c.AccessTokenExpiresAt = Now.AddMinutes(-1));

            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().SyncAsync(_userId));

            Assert.True(connection.NeedsReconnect);
            _api.Verify(a => a.GetProfileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Sync_InvalidTokenError_MarksNeedsReconnect()
        {
            var connection = Connection();
            _api.Setup(a => a.GetProfileAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InstagramApiException("expired", "190", requiresReconnect: true));

            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().SyncAsync(_userId));

            Assert.True(connection.NeedsReconnect);
            Assert.Equal("190", connection.LastSyncError);
        }

        [Fact]
        public async Task Sync_FullList_MarksMissingMediaRemoved_AndNewOnesFollowAutoShowSetting()
        {
            var gone = new InstagramMedia { ExternalId = "gone" };
            var connection = Connection(c =>
            {
                c.AutoShowNewMedia = false;
                c.Media.Add(gone);
            });

            await CreateService().SyncAsync(_userId);

            Assert.True(gone.IsRemoved);
            var added = Assert.Single(connection.Media, m => m.ExternalId == "m1");
            Assert.True(added.IsHidden);
            Assert.Equal("https://v.mp4", added.MediaUrl);
        }

        [Fact]
        public async Task Sync_FollowsCursorUntilNoNextPage()
        {
            Connection();
            _api.Setup(a => a.ListMediaAsync(It.IsAny<string>(), null, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramMediaPage
                {
                    Data = new() { new InstagramApiMedia { Id = "a", MediaType = "IMAGE" } },
                    Paging = new InstagramPaging { Next = "https://next", Cursors = new InstagramCursors { After = "c1" } }
                });
            _api.Setup(a => a.ListMediaAsync(It.IsAny<string>(), "c1", It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramMediaPage { Data = new() { new InstagramApiMedia { Id = "b", MediaType = "IMAGE" } } });

            await CreateService().SyncAsync(_userId);

            _api.Verify(a => a.ListMediaAsync(It.IsAny<string>(), "c1", It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        private void SetupTwoPages()
        {
            _api.Setup(a => a.ListMediaAsync(It.IsAny<string>(), null, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramMediaPage
                {
                    Data = new() { new InstagramApiMedia { Id = "new", MediaType = "IMAGE" } },
                    Paging = new InstagramPaging { Next = "https://next", Cursors = new InstagramCursors { After = "c1" } }
                });
            _api.Setup(a => a.ListMediaAsync(It.IsAny<string>(), "c1", It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new InstagramMediaPage { Data = new() { new InstagramApiMedia { Id = "old", MediaType = "IMAGE" } } });
        }

        [Fact]
        public async Task VisitorRefresh_FetchesNewestPageOnly_AndKeepsFullSyncDue()
        {
            var gone = new InstagramMedia { ExternalId = "gone" };
            var c = Connection(x => { x.LastSyncedAt = Now.AddHours(-1); x.LastFullSyncedAt = Now.AddHours(-1); x.Media.Add(gone); });
            _repository.Setup(r => r.GetVendorsDueForSyncAsync(It.IsAny<DateTime>(), 1, true, _vendorId, false, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Guid> { _vendorId });
            SetupTwoPages();

            await CreateService().RefreshStoreAsync(_vendorId);

            _api.Verify(a => a.ListMediaAsync(It.IsAny<string>(), null, InstagramLimits.MediaPageSize, It.IsAny<CancellationToken>()), Times.Once);
            _api.Verify(a => a.ListMediaAsync(It.IsAny<string>(), "c1", It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            Assert.Contains(c.Media, m => m.ExternalId == "new");
            // قائمة جزئية: لا يُستنتج أن ما لم يصل محذوف
            Assert.False(gone.IsRemoved);
            Assert.Equal(Now, c.LastSyncedAt);
            Assert.Equal(Now.AddHours(-1), c.LastFullSyncedAt);
        }

        [Fact]
        public async Task BackgroundSync_FullList_EvenIfVisitorsSyncedRecently()
        {
            var gone = new InstagramMedia { ExternalId = "gone" };
            var c = Connection(x => { x.LastSyncedAt = Now; x.LastFullSyncedAt = Now.AddHours(-1); x.Media.Add(gone); });
            _repository.Setup(r => r.GetVendorsDueForSyncAsync(It.IsAny<DateTime>(), It.IsAny<int>(), false, null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Guid> { _vendorId });
            SetupTwoPages();

            var synced = await CreateService().SyncDueConnectionsAsync();

            Assert.Equal(1, synced);
            Assert.Contains(c.Media, m => m.ExternalId == "old");
            Assert.True(gone.IsRemoved);
            Assert.Equal(Now, c.LastFullSyncedAt);
        }

        // ===================================
        // المنشورات
        // ===================================
        [Fact]
        public async Task UpdateMedia_ProductFromAnotherStore_IsRejected()
        {
            var media = new InstagramMedia { ExternalId = "m" };
            Connection(c => c.Media.Add(media));
            var productId = Guid.NewGuid();
            _repository.Setup(r => r.ProductBelongsToVendorAsync(productId, _vendorId, It.IsAny<CancellationToken>())).ReturnsAsync(false);

            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                CreateService().UpdateMediaAsync(_userId, media.Id, new SocialMediaUpdateDto { ProductId = productId }));

            Assert.Null(media.ProductId);
        }

        [Fact]
        public async Task Disconnect_RemovesConnection()
        {
            var connection = Connection();

            await CreateService().DisconnectAsync(_userId);

            _repository.Verify(r => r.RemoveConnection(connection), Times.Once);
        }

        // ===================================
        // طلبات Meta الموقّعة
        // ===================================
        private static string SignedRequest(object payload, string secret)
        {
            var body = WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
            var sig = WebEncoders.Base64UrlEncode(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body)));
            return sig + "." + body;
        }

        [Fact]
        public void SignedRequest_ValidSignature_ReturnsUserId()
        {
            var request = SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "ig-1", issued_at = 1 }, "secret");
            Assert.Equal("ig-1", InstagramService.ParseSignedRequestUserId(request, "secret"));
        }

        [Fact]
        public void SignedRequest_WrongSecretOrGarbage_IsRejected()
        {
            var request = SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "ig-1" }, "other");
            Assert.Null(InstagramService.ParseSignedRequestUserId(request, "secret"));
            Assert.Null(InstagramService.ParseSignedRequestUserId("not-signed", "secret"));
            Assert.Null(InstagramService.ParseSignedRequestUserId("!!.??", "secret"));
        }

        [Fact]
        public async Task Deauthorize_MarksConnectionsNeedReconnect_AndDropsToken()
        {
            var connection = Connection();
            _repository.Setup(r => r.GetConnectionsByInstagramUserAsync("ig-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<InstagramConnection> { connection });

            var ok = await CreateService().HandleDeauthorizeAsync(SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "ig-1" }, "secret"));

            Assert.True(ok);
            Assert.True(connection.NeedsReconnect);
            Assert.Equal("", connection.AccessTokenProtected);
        }

        [Fact]
        public async Task DataDeletion_RemovesConnections_AndReturnsCode()
        {
            var connection = Connection();
            _repository.Setup(r => r.GetConnectionsByInstagramUserAsync("ig-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<InstagramConnection> { connection });

            var code = await CreateService().HandleDataDeletionAsync(SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "ig-1" }, "secret"));

            Assert.False(string.IsNullOrEmpty(code));
            _repository.Verify(r => r.RemoveConnection(connection), Times.Once);
        }

        // ===================================
        // صيغ ردود إنستغرام
        // ===================================
        [Theory]
        [InlineData("{\"data\":[{\"access_token\":\"t\",\"user_id\":\"123\",\"permissions\":\"a,b\"}]}", "123", "a,b")]
        [InlineData("{\"access_token\":\"t\",\"user_id\":123,\"permissions\":[\"a\",\"b\"]}", "123", "a,b")]
        public void ParseShortToken_BothResponseShapes(string body, string userId, string permissions)
        {
            var token = InstagramApiClient.ParseShortToken(body);
            Assert.NotNull(token);
            Assert.Equal("t", token!.AccessToken);
            Assert.Equal(userId, token.UserId);
            Assert.Equal(permissions, token.Permissions);
        }

        [Fact]
        public void ParseShortToken_Error_ReturnsNull() =>
            Assert.Null(InstagramApiClient.ParseShortToken("{\"error_type\":\"OAuthException\",\"code\":400,\"error_message\":\"bad\"}"));

        [Theory]
        [InlineData("2024-06-19T23:46:15+0000")]
        [InlineData("2024-06-19T23:46:15+00:00")]
        [InlineData("2024-06-20T02:46:15+0300")]
        public void Timestamp_InstagramFormats_ParseToUtc(string timestamp) =>
            Assert.Equal(new DateTime(2024, 6, 19, 23, 46, 15, DateTimeKind.Utc), new InstagramApiMedia { Timestamp = timestamp }.PublishedAtUtc);

        [Fact]
        public void Mapping_CarouselCover_UsesFirstChild_AndVideoHasPlayableUrl()
        {
            var carousel = SocialMapping.FromInstagram(new InstagramMedia
            {
                MediaType = InstagramMedia.TypeCarousel,
                MediaUrl = "https://album",
                ChildrenJson = SocialMapping.WriteChildren(new()
                {
                    new InstagramMediaChild { Type = InstagramMedia.TypeVideo, Url = "https://c1.mp4", ThumbnailUrl = "https://c1.jpg" },
                    new InstagramMediaChild { Type = InstagramMedia.TypeImage, Url = "https://c2.jpg" }
                })
            });
            Assert.Equal(SocialMediaTypes.Carousel, carousel.MediaType);
            Assert.Equal("https://c1.jpg", carousel.CoverImageUrl);
            Assert.Equal(2, carousel.Children.Count);
            Assert.Null(carousel.VideoUrl);

            var video = SocialMapping.FromInstagram(new InstagramMedia { MediaType = InstagramMedia.TypeVideo, MediaUrl = "https://v.mp4", ThumbnailUrl = "https://t.jpg" });
            Assert.Equal("https://v.mp4", video.VideoUrl);
            Assert.Equal("https://t.jpg", video.CoverImageUrl);
            Assert.Equal(SocialPlatforms.Instagram, video.Platform);
        }

        private sealed class FakeProtector : IInstagramTokenProtector
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
