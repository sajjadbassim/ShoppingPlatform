using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ecommerce.Core.DTO.Facebook;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.FacebookService;
using ecommerce.Services.InstagramService;
using ecommerce.Services.SocialFeedService;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace ecommerce.Tests.Services
{
    public class FacebookServiceTests
    {
        private readonly Mock<IFacebookRepository> _repository = new();
        private readonly Mock<IUnitOfWork> _unitOfWork = new();
        private readonly Mock<IFacebookApiClient> _api = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());
        private readonly FakeTime _time = new(new DateTimeOffset(2026, 10, 3, 12, 0, 0, TimeSpan.Zero));
        private readonly FacebookOptions _options = new()
        {
            AppId = "app",
            AppSecret = "secret",
            ConfigId = "cfg",
            RedirectUri = "https://example.com/api/integrations/facebook/callback"
        };

        private readonly Guid _userId = Guid.NewGuid();
        private readonly Guid _vendorId = Guid.NewGuid();
        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public FacebookServiceTests()
        {
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(_userId, It.IsAny<CancellationToken>())).ReturnsAsync(_vendorId);
            _repository.Setup(r => r.ConnectionExistsAsync(_vendorId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _api.Setup(a => a.BuildAuthorizeUrl(It.IsAny<string>())).Returns<string>(s => "https://facebook/dialog?state=" + s);
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>())).ReturnsAsync(new FacebookTokenResponse { AccessToken = "short" });
            _api.Setup(a => a.ExchangeForLongLivedTokenAsync("short", It.IsAny<CancellationToken>())).ReturnsAsync(new FacebookTokenResponse { AccessToken = "long" });
            _api.Setup(a => a.GetMeAsync("long", It.IsAny<CancellationToken>())).ReturnsAsync(new FacebookUser { Id = "fb-user" });
            _api.Setup(a => a.GetGrantedPermissionsAsync("long", It.IsAny<CancellationToken>())).ReturnsAsync(new List<string> { "pages_show_list", "pages_read_engagement" });
            _api.Setup(a => a.GetGrantedPageIdsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<string>());
            _api.Setup(a => a.GetPageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookPageInfo { Name = "متجر", Username = "store", FanCount = 120 });
            _api.Setup(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<string>(), false, It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookList<FacebookApiVideo>
                {
                    Data = new() { new FacebookApiVideo { Id = "v1", Source = "https://v1.mp4", PermalinkUrl = "/store/videos/v1/", Length = 12.6, CreatedTime = "2026-09-01T10:00:00+0000",
                        Thumbnails = new() { Data = new() { new FacebookThumbnail { Uri = "https://small", Width = 100 }, new FacebookThumbnail { Uri = "https://big", Width = 720 } } } } }
                });
            _api.Setup(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<string>(), true, It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookList<FacebookApiVideo> { Data = new() { new FacebookApiVideo { Id = "v1" }, new FacebookApiVideo { Id = "r2", Source = "https://r2.mp4" } } });
            _api.Setup(a => a.ListPostsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookList<FacebookApiPost>
                {
                    Data = new()
                    {
                        Post("p-photo", "photo", image: "https://photo.jpg"),
                        Post("p-album", "album", children: new[] { "https://a1.jpg", "https://a2.jpg" }),
                        Post("p-video", "video", image: "https://thumb.jpg"),
                        Post("p-link", "link", image: "https://link.jpg"),
                    }
                });
        }

        private static FacebookApiPost Post(string id, string type, string? image = null, string[]? children = null) => new()
        {
            Id = id,
            Message = "نص " + id,
            CreatedTime = "2026-09-02T10:00:00+0000",
            PermalinkUrl = "https://www.facebook.com/" + id,
            Attachments = new()
            {
                Data = new()
                {
                    new FacebookAttachment
                    {
                        MediaType = type,
                        Media = image == null ? null : new FacebookAttachmentMedia { Image = new FacebookAttachmentImage { Src = image } },
                        Subattachments = children == null ? null : new()
                        {
                            Data = children.Select(c => new FacebookAttachment { MediaType = "photo", Media = new FacebookAttachmentMedia { Image = new FacebookAttachmentImage { Src = c } } }).ToList()
                        }
                    }
                }
            }
        };

        private FacebookService CreateService() => new(
            _repository.Object, _unitOfWork.Object, _api.Object, new FakeProtector(), _cache,
            Options.Create(_options), _time, NullLogger<FacebookService>.Instance);

        private static string Hash(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

        private void SetupState(string nonce = "n", DateTime? expiresAt = null) =>
            _repository.Setup(r => r.GetStateAsync("state-1", It.IsAny<CancellationToken>())).ReturnsAsync(new FacebookOAuthState
            {
                State = "state-1",
                VendorId = _vendorId,
                NonceHash = Hash(nonce),
                ExpiresAt = expiresAt ?? Now.AddMinutes(5)
            });

        private void SetupPages(params string[] ids) =>
            _api.Setup(a => a.GetPagesAsync("long", It.IsAny<CancellationToken>()))
                .ReturnsAsync(ids.Select(id => new FacebookPageAccount { Id = id, Name = "صفحة " + id, AccessToken = "page-token-" + id }).ToList());

        private FacebookConnection Connection(Action<FacebookConnection>? configure = null)
        {
            var c = new FacebookConnection
            {
                VendorId = _vendorId,
                FacebookUserId = "fb-user",
                PageId = "page-1",
                PageAccessTokenProtected = "p:page-token",
                Scopes = "pages_show_list,pages_read_engagement"
            };
            configure?.Invoke(c);
            _repository.Setup(r => r.GetConnectionAsync(_vendorId, It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(c);
            return c;
        }

        // الحساب المُضاف يصبح هو ما يعيده GetConnectionAsync (كما في قاعدة البيانات)
        private void CaptureAdded() =>
            _repository.Setup(r => r.AddConnectionAsync(It.IsAny<FacebookConnection>(), It.IsAny<CancellationToken>()))
                .Callback<FacebookConnection, CancellationToken>((c, _) =>
                    _repository.Setup(r => r.GetConnectionAsync(_vendorId, It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(c));

        // ===================================
        // بدء الربط والعودة
        // ===================================
        [Fact]
        public async Task StartConnect_WhenNotConfigured_Throws()
        {
            _options.ConfigId = "";
            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().StartConnectAsync(_userId));
        }

        [Fact]
        public async Task StartConnect_SavesStateBoundToVendor()
        {
            FacebookOAuthState? saved = null;
            _repository.Setup(r => r.AddStateAsync(It.IsAny<FacebookOAuthState>(), It.IsAny<CancellationToken>()))
                .Callback<FacebookOAuthState, CancellationToken>((s, _) => saved = s);

            var start = await CreateService().StartConnectAsync(_userId);

            Assert.Equal(_vendorId, saved!.VendorId);
            Assert.Equal(Hash(start.Nonce), saved.NonceHash);
            Assert.EndsWith(saved.State, start.AuthorizeUrl);
        }

        [Fact]
        public async Task CompleteConnect_NonceFromAnotherBrowser_IsRejected()
        {
            SetupState("real");
            var result = await CreateService().CompleteConnectAsync("code", "state-1", "other", null);
            Assert.Equal("invalid_state", result.Reason);
            _api.Verify(a => a.ExchangeCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CompleteConnect_NoPagesGranted_ReturnsNoPages()
        {
            SetupState();
            SetupPages();
            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);
            Assert.False(result.Success);
            Assert.Equal("no_pages", result.Reason);
        }

        [Fact]
        public async Task CompleteConnect_BusinessPageMissingFromAccounts_FoundThroughGrantedIds()
        {
            SetupState();
            SetupPages();
            CaptureAdded();
            _api.Setup(a => a.GetGrantedPageIdsAsync("long", It.IsAny<CancellationToken>())).ReturnsAsync(new List<string> { "biz-page" });
            _api.Setup(a => a.GetPageWithTokenAsync("biz-page", "long", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookPageAccount { Id = "biz-page", Name = "صفحة الأعمال", AccessToken = "biz-token" });

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.True(result.Success);
            var c = await _repository.Object.GetConnectionAsync(_vendorId, false);
            Assert.Equal("biz-page", c!.PageId);
            Assert.Equal("p:biz-token", c.PageAccessTokenProtected);
        }

        [Fact]
        public async Task CompleteConnect_SinglePage_ConnectsAndSyncsContent()
        {
            SetupState();
            SetupPages("page-1");
            CaptureAdded();

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.True(result.Success);
            Assert.Null(result.SelectionId);
            var c = await _repository.Object.GetConnectionAsync(_vendorId, true);
            Assert.NotNull(c);
            Assert.Equal("fb-user", c!.FacebookUserId);
            Assert.Equal("page-1", c.PageId);
            Assert.Equal("p:page-token-page-1", c.PageAccessTokenProtected);
            Assert.Equal("pages_show_list,pages_read_engagement", c.Scopes);
            Assert.Equal(120, c.FollowersCount);
            _api.Verify(a => a.GetPageAsync("page-1", "page-token-page-1", It.IsAny<CancellationToken>()), Times.Once);

            // فيديو + ريلز + صورة + ألبوم — منشورات الفيديو والروابط لا تُكرَّر
            Assert.Equal(new[] { "p-album", "p-photo", "r2", "v1" }, c.Media.Select(m => m.ExternalId).OrderBy(x => x));
            var video = c.Media.Single(m => m.ExternalId == "v1");
            Assert.Equal(FacebookMedia.TypeVideo, video.MediaType);
            Assert.True(video.IsReel);
            Assert.Equal("https://v1.mp4", video.MediaUrl);
            Assert.Equal("https://big", video.ThumbnailUrl);
            Assert.Equal("https://www.facebook.com/store/videos/v1/", video.Permalink);
            Assert.Equal(13, video.DurationSeconds);
            Assert.Equal(new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc), video.PublishedAt);
            Assert.True(c.Media.Single(m => m.ExternalId == "r2").IsReel);
            var album = c.Media.Single(m => m.ExternalId == "p-album");
            Assert.Equal(FacebookMedia.TypeCarousel, album.MediaType);
            Assert.Equal(2, SocialMapping.ReadChildren(album.ChildrenJson).Count);
            Assert.All(c.Media, m => Assert.False(m.IsHidden));
        }

        [Fact]
        public async Task CompleteConnect_SeveralPages_AsksToChoose_ThenSelectionConnects()
        {
            SetupState();
            SetupPages("page-1", "page-2");
            CaptureAdded();

            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            Assert.True(result.Success);
            Assert.NotNull(result.SelectionId);
            _repository.Verify(r => r.AddConnectionAsync(It.IsAny<FacebookConnection>(), It.IsAny<CancellationToken>()), Times.Never);

            var options = await CreateService().GetPendingPagesAsync(_userId, result.SelectionId!);
            Assert.Equal(new[] { "page-1", "page-2" }, options.Select(o => o.Id));

            await CreateService().SelectPageAsync(_userId, new FacebookSelectPageDto { SelectionId = result.SelectionId!, PageId = "page-2" });

            var c = await _repository.Object.GetConnectionAsync(_vendorId, false);
            Assert.Equal("page-2", c!.PageId);
            Assert.Equal("p:page-token-page-2", c.PageAccessTokenProtected);
            // الاختيار صالح لمرة واحدة
            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().GetPendingPagesAsync(_userId, result.SelectionId!));
        }

        [Fact]
        public async Task SelectPage_FromAnotherVendor_IsRejected()
        {
            SetupState();
            SetupPages("page-1", "page-2");
            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);

            var otherUser = Guid.NewGuid();
            _repository.Setup(r => r.GetVendorIdByOwnerAsync(otherUser, It.IsAny<CancellationToken>())).ReturnsAsync(Guid.NewGuid());

            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                CreateService().SelectPageAsync(otherUser, new FacebookSelectPageDto { SelectionId = result.SelectionId!, PageId = "page-1" }));
        }

        [Fact]
        public async Task CompleteConnect_TokenExchangeFails_ReturnsToken()
        {
            SetupState();
            _api.Setup(a => a.ExchangeCodeAsync("code", It.IsAny<CancellationToken>())).ThrowsAsync(new FacebookApiException("bad", "100"));
            var result = await CreateService().CompleteConnectAsync("code", "state-1", "n", null);
            Assert.Equal("token", result.Reason);
        }

        // ===================================
        // المزامنة
        // ===================================
        [Fact]
        public async Task Sync_InvalidToken_MarksNeedsReconnect()
        {
            var c = Connection();
            _api.Setup(a => a.GetPageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new FacebookApiException("expired", "190", requiresReconnect: true));

            await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService().SyncAsync(_userId));

            Assert.True(c.NeedsReconnect);
            Assert.Equal("190", c.LastSyncError);
        }

        [Fact]
        public async Task Sync_ReelsListUnavailable_KeepsVideos_AndDoesNotMarkRemoved()
        {
            var gone = new FacebookMedia { ExternalId = "gone" };
            var c = Connection(x => x.Media.Add(gone));
            _api.Setup(a => a.ListVideosAsync(It.IsAny<string>(), It.IsAny<string>(), true, It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new FacebookApiException("unsupported", "100"));

            await CreateService().SyncAsync(_userId);

            Assert.Contains(c.Media, m => m.ExternalId == "v1");
            // قائمة ناقصة: لا يُستنتج الحذف
            Assert.False(gone.IsRemoved);
            Assert.Null(c.LastSyncError);
        }

        [Fact]
        public async Task Sync_CompleteLists_MarksMissingRemoved()
        {
            var gone = new FacebookMedia { ExternalId = "gone" };
            var c = Connection(x => x.Media.Add(gone));

            await CreateService().SyncAsync(_userId);

            Assert.True(gone.IsRemoved);
        }

        [Fact]
        public async Task VisitorRefresh_FetchesOnePagePerList_AndKeepsFullSyncDue()
        {
            var c = Connection(x => { x.LastSyncedAt = Now.AddHours(-1); x.LastFullSyncedAt = Now.AddHours(-1); });
            _repository.Setup(r => r.GetVendorsDueForSyncAsync(It.IsAny<DateTime>(), 1, true, _vendorId, false, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Guid> { _vendorId });
            _api.Setup(a => a.ListPostsAsync(It.IsAny<string>(), It.IsAny<string>(), null, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FacebookList<FacebookApiPost>
                {
                    Data = new() { Post("p-new", "photo", image: "https://n.jpg") },
                    Paging = new InstagramPaging { Next = "https://next", Cursors = new InstagramCursors { After = "c1" } }
                });

            await CreateService().RefreshStoreAsync(_vendorId);

            _api.Verify(a => a.ListPostsAsync(It.IsAny<string>(), It.IsAny<string>(), "c1", It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
            Assert.Contains(c.Media, m => m.ExternalId == "p-new");
            Assert.Equal(Now, c.LastSyncedAt);
            Assert.Equal(Now.AddHours(-1), c.LastFullSyncedAt);
        }

        [Fact]
        public async Task UpdateMedia_ProductFromAnotherStore_IsRejected()
        {
            var media = new FacebookMedia { ExternalId = "m" };
            Connection(x => x.Media.Add(media));
            var productId = Guid.NewGuid();

            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                CreateService().UpdateMediaAsync(_userId, media.Id, new SocialMediaUpdateDto { ProductId = productId }));
        }

        // ===================================
        // طلبات Meta والخصائص المساعدة
        // ===================================
        private static string SignedRequest(object payload, string secret)
        {
            var body = WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
            var sig = WebEncoders.Base64UrlEncode(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body)));
            return sig + "." + body;
        }

        [Fact]
        public async Task Deauthorize_MarksNeedsReconnect_AndDropsToken()
        {
            var c = Connection();
            _repository.Setup(r => r.GetConnectionsByFacebookUserAsync("fb-user", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<FacebookConnection> { c });

            var ok = await CreateService().HandleDeauthorizeAsync(SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "fb-user" }, "secret"));

            Assert.True(ok);
            Assert.True(c.NeedsReconnect);
            Assert.Equal("", c.PageAccessTokenProtected);
        }

        [Fact]
        public async Task DataDeletion_WrongSignature_IsRejected() =>
            Assert.Null(await CreateService().HandleDataDeletionAsync(SignedRequest(new { algorithm = "HMAC-SHA256", user_id = "fb-user" }, "other")));

        [Fact]
        public void AppSecretProof_IsHmacSha256Hex()
        {
            var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes("secret"), Encoding.UTF8.GetBytes("token"))).ToLowerInvariant();
            Assert.Equal(expected, FacebookApiClient.AppSecretProof("token", "secret"));
        }

        [Fact]
        public void Mapping_Video_PlaysNatively_AndAlbumUsesFirstImageAsCover()
        {
            var video = SocialMapping.FromFacebook(new FacebookMedia { MediaType = FacebookMedia.TypeVideo, MediaUrl = "https://v.mp4", ThumbnailUrl = "https://t.jpg", DurationSeconds = 9 });
            Assert.Equal(SocialPlatforms.Facebook, video.Platform);
            Assert.Equal("https://v.mp4", video.VideoUrl);
            Assert.Equal("https://t.jpg", video.CoverImageUrl);

            var album = SocialMapping.FromFacebook(new FacebookMedia
            {
                MediaType = FacebookMedia.TypeCarousel,
                MediaUrl = "https://a1.jpg",
                ChildrenJson = SocialMapping.WriteChildren(new() { new InstagramMediaChild { Url = "https://a1.jpg" }, new InstagramMediaChild { Url = "https://a2.jpg" } })
            });
            Assert.Equal(SocialMediaTypes.Carousel, album.MediaType);
            Assert.Equal("https://a1.jpg", album.CoverImageUrl);
            Assert.Null(album.VideoUrl);
        }

        private sealed class FakeProtector : IFacebookTokenProtector
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
