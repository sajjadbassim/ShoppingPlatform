using System.Text.Json;
using ecommerce.Core.DTO.Social;
using ecommerce.Core.Models;

namespace ecommerce.Services.SocialFeedService
{
    // تحويل عناصر المنصات إلى الشكل الموحّد SocialFeedItemDto
    public static class SocialMapping
    {
        public static SocialFeedItemDto FromTikTok(TikTokVideo v) => new()
        {
            Id = v.Id,
            Platform = SocialPlatforms.TikTok,
            ExternalId = v.ExternalId,
            MediaType = SocialMediaTypes.Video,
            Title = v.Title,
            CoverImageUrl = v.CoverImageUrl,
            ShareUrl = v.ShareUrl,
            EmbedLink = v.EmbedLink,
            DurationSeconds = v.DurationSeconds,
            ViewCount = v.ViewCount,
            LikeCount = v.LikeCount,
            PublishedAt = v.PublishedAt,
            IsHidden = v.IsHidden,
            Product = MapProduct(v.Product)
        };

        public static SocialFeedItemDto FromInstagram(InstagramMedia m)
        {
            var children = ReadChildren(m.ChildrenJson)
                .Select(c => new SocialMediaChildDto
                {
                    MediaType = c.Type == InstagramMedia.TypeVideo ? SocialMediaTypes.Video : SocialMediaTypes.Image,
                    Url = c.Url,
                    ThumbnailUrl = c.ThumbnailUrl
                })
                .ToList();

            var type = m.MediaType switch
            {
                InstagramMedia.TypeVideo => SocialMediaTypes.Video,
                InstagramMedia.TypeCarousel => SocialMediaTypes.Carousel,
                _ => SocialMediaTypes.Image
            };

            // الغلاف: صورة مصغّرة للفيديو، أول عنصر للألبوم، والصورة نفسها للمنشور العادي
            var cover = type switch
            {
                SocialMediaTypes.Video => m.ThumbnailUrl,
                SocialMediaTypes.Carousel => children
                    .Select(c => c.MediaType == SocialMediaTypes.Video ? c.ThumbnailUrl : c.Url)
                    .FirstOrDefault(u => !string.IsNullOrEmpty(u)) ?? m.MediaUrl,
                _ => m.MediaUrl
            };

            return new SocialFeedItemDto
            {
                Id = m.Id,
                Platform = SocialPlatforms.Instagram,
                ExternalId = m.ExternalId,
                MediaType = type,
                Title = m.Caption,
                CoverImageUrl = cover,
                ShareUrl = m.Permalink,
                VideoUrl = type == SocialMediaTypes.Video ? m.MediaUrl : null,
                Children = children,
                LikeCount = m.LikeCount,
                CommentsCount = m.CommentsCount,
                PublishedAt = m.PublishedAt,
                IsHidden = m.IsHidden,
                Product = MapProduct(m.Product)
            };
        }

        public static SocialStoreDto FromVendor(Vendor v) => new()
        {
            Id = v.Id,
            Name = v.Name,
            NameAr = v.NameAr,
            LogoUrl = v.LogoUrl
        };

        public static string? InstagramProfileUrl(string? username) =>
            string.IsNullOrEmpty(username) ? null : "https://www.instagram.com/" + Uri.EscapeDataString(username) + "/";

        // المنتج المحذوف (غير نشط) لا يُعرض كرابط شراء
        public static SocialLinkedProductDto? MapProduct(Product? p) => p is { IsActive: true }
            ? new SocialLinkedProductDto
            {
                Id = p.Id,
                Name = p.Name,
                NameAr = p.NameAr,
                Price = p.Price,
                OriginalPrice = p.OriginalPrice,
                IsAvailable = p.IsAvailable && p.StockQuantity > 0,
                PrimaryImageUrl = (p.Images?.FirstOrDefault(i => i.IsPrimary) ?? p.Images?.OrderBy(i => i.DisplayOrder).FirstOrDefault())?.ImageUrl
            }
            : null;

        public static string? WriteChildren(List<InstagramMediaChild>? children) =>
            children is { Count: > 0 } ? JsonSerializer.Serialize(children) : null;

        public static List<InstagramMediaChild> ReadChildren(string? json)
        {
            if (string.IsNullOrEmpty(json)) return new();
            try { return JsonSerializer.Deserialize<List<InstagramMediaChild>>(json) ?? new(); }
            catch (JsonException) { return new(); }
        }
    }
}
