using ecommerce.Core.DTO.Social;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.InstagramService;
using ecommerce.Services.SocialFeedService;
using ecommerce.Services.TikTokService;
using Moq;

namespace ecommerce.Tests.Services
{
    public class SocialFeedServiceTests
    {
        private readonly Mock<ITikTokRepository> _tikTokRepository = new();
        private readonly Mock<IInstagramRepository> _instagramRepository = new();
        private readonly Vendor _vendor = new() { Id = Guid.NewGuid(), Name = "Store" };

        private SocialFeedService CreateService() => new(
            Mock.Of<ITikTokService>(), _tikTokRepository.Object, Mock.Of<IInstagramService>(), _instagramRepository.Object);

        private TikTokVideo TikTok(int day) => new()
        {
            ExternalId = "t" + day,
            PublishedAt = new DateTime(2026, 9, day),
            Connection = new TikTokConnection { Vendor = _vendor }
        };

        private InstagramMedia Instagram(int day) => new()
        {
            ExternalId = "i" + day,
            MediaType = InstagramMedia.TypeVideo,
            MediaUrl = "https://v.mp4",
            PublishedAt = new DateTime(2026, 9, day),
            Connection = new InstagramConnection { Vendor = _vendor }
        };

        [Fact]
        public async Task Reels_MergesBothPlatforms_NewestFirst_WithPaging()
        {
            _tikTokRepository.Setup(r => r.GetPublicReelsAsync(0, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<TikTokVideo> { TikTok(9), TikTok(5), TikTok(1) });
            _instagramRepository.Setup(r => r.GetPublicReelsAsync(0, It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<InstagramMedia> { Instagram(8), Instagram(4) });

            var first = await CreateService().GetReelsAsync(1, 3);
            var second = await CreateService().GetReelsAsync(2, 3);

            Assert.Equal(new[] { "t9", "i8", "t5" }, first.Items.Select(i => i.ExternalId));
            Assert.True(first.HasMore);
            Assert.Equal(new[] { "i4", "t1" }, second.Items.Select(i => i.ExternalId));
            Assert.False(second.HasMore);
            Assert.All(first.Items, i => Assert.Equal(_vendor.Id, i.Store!.Id));
            Assert.Equal(SocialPlatforms.Instagram, first.Items[1].Platform);
        }

        [Fact]
        public async Task StoreFeed_ListsVisibleAccounts_AndMergesItems()
        {
            var tiktok = new TikTokConnection { Vendor = _vendor, DisplayName = "TT" };
            tiktok.Videos.Add(TikTok(2));
            var instagram = new InstagramConnection { Vendor = _vendor, Username = "ig_store" };
            instagram.Media.Add(Instagram(3));
            _tikTokRepository.Setup(r => r.GetPublicConnectionAsync(_vendor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(tiktok);
            _instagramRepository.Setup(r => r.GetPublicConnectionAsync(_vendor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(instagram);

            var feed = await CreateService().GetStoreFeedAsync(_vendor.Id);

            Assert.Equal(new[] { SocialPlatforms.TikTok, SocialPlatforms.Instagram }, feed.Accounts.Select(a => a.Platform));
            Assert.Equal("https://www.instagram.com/ig_store/", feed.Accounts[1].ProfileUrl);
            Assert.Equal(new[] { "i3", "t2" }, feed.Items.Select(i => i.ExternalId));
        }

        [Fact]
        public async Task StoreFeed_NoAccounts_IsEmpty()
        {
            var feed = await CreateService().GetStoreFeedAsync(_vendor.Id);
            Assert.Empty(feed.Accounts);
            Assert.Empty(feed.Items);
        }
    }
}
