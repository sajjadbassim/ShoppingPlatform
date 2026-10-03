using ecommerce.Core.DTO.Social;
using ecommerce.Repositories;
using ecommerce.Services.InstagramService;
using ecommerce.Services.TikTokService;

namespace ecommerce.Services.SocialFeedService
{
    // المحتوى العام من كل المنصات معاً: تبويب المتجر وصفحة ريلز
    public interface ISocialFeedService
    {
        Task<SocialStoreFeedDto> GetStoreFeedAsync(Guid vendorId, CancellationToken ct = default);
        Task<SocialStoreFeedDto> RefreshStoreFeedAsync(Guid vendorId, CancellationToken ct = default);
        Task<SocialReelsPageDto> GetReelsAsync(int page, int pageSize, CancellationToken ct = default);
        Task<SocialReelsPageDto> RefreshReelsAsync(int pageSize, CancellationToken ct = default);
    }

    public class SocialFeedService : ISocialFeedService
    {
        // الدمج بين جدولين يحتاج أول (page × pageSize) عنصراً من كل منهما — حد أعلى للتمرير العميق
        private const int MaxReelsWindow = 600;

        private readonly ITikTokService _tikTok;
        private readonly ITikTokRepository _tikTokRepository;
        private readonly IInstagramService _instagram;
        private readonly IInstagramRepository _instagramRepository;

        public SocialFeedService(
            ITikTokService tikTok,
            ITikTokRepository tikTokRepository,
            IInstagramService instagram,
            IInstagramRepository instagramRepository)
        {
            _tikTok = tikTok;
            _tikTokRepository = tikTokRepository;
            _instagram = instagram;
            _instagramRepository = instagramRepository;
        }

        public async Task<SocialStoreFeedDto> GetStoreFeedAsync(Guid vendorId, CancellationToken ct = default)
        {
            var feed = new SocialStoreFeedDto();
            var items = new List<SocialFeedItemDto>();

            var tiktok = await _tikTokRepository.GetPublicConnectionAsync(vendorId, ct);
            if (tiktok != null)
            {
                feed.Accounts.Add(new SocialAccountDto
                {
                    Platform = SocialPlatforms.TikTok,
                    DisplayName = tiktok.DisplayName,
                    Username = tiktok.Username,
                    AvatarUrl = tiktok.AvatarUrl,
                    ProfileUrl = tiktok.ProfileUrl
                });
                items.AddRange(tiktok.Videos.Select(SocialMapping.FromTikTok));
            }

            var instagram = await _instagramRepository.GetPublicConnectionAsync(vendorId, ct);
            if (instagram != null)
            {
                feed.Accounts.Add(new SocialAccountDto
                {
                    Platform = SocialPlatforms.Instagram,
                    DisplayName = instagram.Name ?? instagram.Username,
                    Username = instagram.Username,
                    AvatarUrl = instagram.ProfilePictureUrl,
                    ProfileUrl = SocialMapping.InstagramProfileUrl(instagram.Username)
                });
                items.AddRange(instagram.Media.Select(SocialMapping.FromInstagram));
            }

            feed.Items = Newest(items).ToList();
            return feed;
        }

        // يجلب الجديد من المنصتين ثم يعيد المحتوى (كل منصة تحدّ من تكرار المزامنة بنفسها)
        public async Task<SocialStoreFeedDto> RefreshStoreFeedAsync(Guid vendorId, CancellationToken ct = default)
        {
            await _tikTok.RefreshStoreFeedAsync(vendorId, ct);
            await _instagram.RefreshStoreAsync(vendorId, ct);
            return await GetStoreFeedAsync(vendorId, ct);
        }

        // صفحة ريلز: فيديوهات تيك توك + منشورات إنستغرام (ريلز وفيديو وصور وألبومات)، الأحدث أولاً
        public async Task<SocialReelsPageDto> GetReelsAsync(int page, int pageSize, CancellationToken ct = default)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 30);
            var skip = (page - 1) * pageSize;
            var window = skip + pageSize + 1;
            if (window > MaxReelsWindow)
                return new SocialReelsPageDto { Page = page, HasMore = false };

            var tiktok = await _tikTokRepository.GetPublicReelsAsync(0, window, ct);
            var instagram = await _instagramRepository.GetPublicReelsAsync(0, window, ct);

            var merged = Newest(
                    tiktok.Select(v => WithStore(SocialMapping.FromTikTok(v), SocialMapping.FromVendor(v.Connection.Vendor)))
                    .Concat(instagram.Select(m => WithStore(SocialMapping.FromInstagram(m), SocialMapping.FromVendor(m.Connection.Vendor)))))
                .Skip(skip)
                .Take(pageSize + 1)
                .ToList();

            return new SocialReelsPageDto
            {
                Page = page,
                HasMore = merged.Count > pageSize,
                Items = merged.Take(pageSize).ToList()
            };
        }

        public async Task<SocialReelsPageDto> RefreshReelsAsync(int pageSize, CancellationToken ct = default)
        {
            await _tikTok.RefreshReelsAsync(pageSize, ct);
            await _instagram.RefreshVisibleAsync(ct);
            return await GetReelsAsync(1, pageSize, ct);
        }

        private static IEnumerable<SocialFeedItemDto> Newest(IEnumerable<SocialFeedItemDto> items) =>
            items.OrderByDescending(i => i.PublishedAt).ThenBy(i => i.Id);

        private static SocialFeedItemDto WithStore(SocialFeedItemDto item, SocialStoreDto store)
        {
            item.Store = store;
            return item;
        }
    }
}
