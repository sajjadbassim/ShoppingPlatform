using ecommerce.Core.Constants;
using ecommerce.Core.DTO.HomePage;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.FileService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.HomeService
{
    public class HomeService : IHomeService
    {
        private readonly AppDbContext _context;
        private readonly IFileService _fileService;

        public HomeService(AppDbContext context, IFileService fileService)
        {
            _context = context;
            _fileService = fileService;
        }

        // ===================================
        // GetHomePageAsync
        // ===================================
        public async Task<HomePageDto> GetHomePageAsync()
        {
            var now = DateTime.UtcNow;

            var banners = await _context.Banners
                .Where(b =>
                    b.IsActive &&
                    (b.StartsAt == null || b.StartsAt <= now) &&
                    (b.EndsAt == null || b.EndsAt >= now))
                .OrderBy(b => b.DisplayOrder)
                .AsNoTracking()
                .ToListAsync();

            var sections = await _context.HomeSections
                .Include(s => s.Items)
                .Where(s => s.IsActive)
                .OrderBy(s => s.DisplayOrder)
                .AsNoTracking()
                .ToListAsync();

            var sectionDtos = new List<HomeSectionDto>();
            foreach (var section in sections)
                sectionDtos.Add(await LoadSectionDataAsync(section));

            return new HomePageDto
            {
                Banners = banners.Select(MapBannerToDto).ToList(),
                Sections = sectionDtos
            };
        }

        // ===================================
        // GetBannersAsync
        // ===================================
        public async Task<List<BannerDto>> GetBannersAsync(bool onlyActive = true)
        {
            var now = DateTime.UtcNow;
            var query = _context.Banners.AsQueryable();

            if (onlyActive)
                query = query.Where(b =>
                    b.IsActive &&
                    (b.StartsAt == null || b.StartsAt <= now) &&
                    (b.EndsAt == null || b.EndsAt >= now));

            var banners = await query
                .OrderBy(b => b.DisplayOrder)
                .AsNoTracking()
                .ToListAsync();

            return banners.Select(MapBannerToDto).ToList();
        }

        // ===================================
        // GetBannerByIdAsync
        // ===================================
        public async Task<BannerDto> GetBannerByIdAsync(Guid id)
        {
            var banner = await _context.Banners.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == id);

            if (banner == null)
                throw new Exception("البانر غير موجود");

            return MapBannerToDto(banner);
        }

        // ===================================
        // CreateBannerAsync — ✅ يقبل ملف أو رابط
        // ===================================
        public async Task<BannerDto> CreateBannerAsync(CreateBannerDto dto)
        {
            var imageUrl = await _fileService.SaveImageAsync(dto.ImageFile, "banners");

            var banner = new Banner
            {
                Title = dto.Title,
                TitleAr = dto.TitleAr,
                Subtitle = dto.Subtitle,
                SubtitleAr = dto.SubtitleAr,
                ImageUrl = imageUrl,
                LinkUrl = dto.LinkUrl,
                LinkType = dto.LinkType,
                LinkEntityId = dto.LinkEntityId,
                DisplayOrder = dto.DisplayOrder,
                StartsAt = dto.StartsAt,
                EndsAt = dto.EndsAt
            };

            await _context.Banners.AddAsync(banner);
            await _context.SaveChangesAsync();

            return MapBannerToDto(banner);
        }

        // ===================================
        // UpdateBannerAsync — ✅ يقبل ملف أو رابط
        // ===================================
        public async Task<BannerDto> UpdateBannerAsync(Guid id, UpdateBannerDto dto)
        {
            var banner = await _context.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner == null)
                throw new Exception("البانر غير موجود");

            // ✅ رفع صورة جديدة إذا أُرسلت
            if (dto.ImageFile != null)
            {
                if (!string.IsNullOrWhiteSpace(banner.ImageUrl) &&
                    banner.ImageUrl.StartsWith("/uploads/"))
                    await _fileService.DeleteImageAsync(banner.ImageUrl);

                banner.ImageUrl = await _fileService.SaveImageAsync(dto.ImageFile, "banners");
            }

            if (dto.Title != null) banner.Title = dto.Title;
            if (dto.TitleAr != null) banner.TitleAr = dto.TitleAr;
            if (dto.Subtitle != null) banner.Subtitle = dto.Subtitle;
            if (dto.SubtitleAr != null) banner.SubtitleAr = dto.SubtitleAr;
            // عند تغيير نوع الرابط تُمسح الحقول التي لا تخصّه، حتى لا تبقى وجهة قديمة
            if (dto.LinkType != null)
            {
                switch (dto.LinkType)
                {
                    case "none":
                        banner.LinkType = null;
                        banner.LinkUrl = null;
                        banner.LinkEntityId = null;
                        break;
                    case "url":
                        banner.LinkType = "url";
                        banner.LinkUrl = dto.LinkUrl;
                        banner.LinkEntityId = null;
                        break;
                    default:
                        banner.LinkType = dto.LinkType;
                        banner.LinkEntityId = dto.LinkEntityId;
                        banner.LinkUrl = null;
                        break;
                }
            }
            else
            {
                if (dto.LinkUrl != null) banner.LinkUrl = dto.LinkUrl;
                if (dto.LinkEntityId != null) banner.LinkEntityId = dto.LinkEntityId;
            }
            if (dto.IsActive != null) banner.IsActive = dto.IsActive.Value;
            if (dto.DisplayOrder != null) banner.DisplayOrder = dto.DisplayOrder.Value;
            if (dto.StartsAt != null) banner.StartsAt = dto.StartsAt;
            if (dto.EndsAt != null) banner.EndsAt = dto.EndsAt;

            banner.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return MapBannerToDto(banner);
        }

        // ===================================
        // DeleteBannerAsync
        // ===================================
        public async Task<bool> DeleteBannerAsync(Guid id)
        {
            var banner = await _context.Banners.FirstOrDefaultAsync(b => b.Id == id);
            if (banner == null) return false;

            // ✅ حذف الصورة المحلية إن وجدت
            if (!string.IsNullOrWhiteSpace(banner.ImageUrl) &&
                banner.ImageUrl.StartsWith("/uploads/"))
                await _fileService.DeleteImageAsync(banner.ImageUrl);

            _context.Banners.Remove(banner);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // GetSectionsAsync
        // ===================================
        public async Task<List<HomeSectionDto>> GetSectionsAsync(bool onlyActive = true)
        {
            var query = _context.HomeSections
                .Include(s => s.Items)
                .AsQueryable();

            if (onlyActive)
                query = query.Where(s => s.IsActive);

            var sections = await query
                .OrderBy(s => s.DisplayOrder)
                .AsNoTracking()
                .ToListAsync();

            var dtos = new List<HomeSectionDto>();
            foreach (var section in sections)
                dtos.Add(await LoadSectionDataAsync(section));

            return dtos;
        }

        // ===================================
        // GetSectionByIdAsync
        // ===================================
        public async Task<HomeSectionDto> GetSectionByIdAsync(Guid id)
        {
            var section = await _context.HomeSections
                .Include(s => s.Items)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);

            if (section == null)
                throw new Exception("القسم غير موجود");

            return await LoadSectionDataAsync(section);
        }

        // ===================================
        // CreateSectionAsync
        // ===================================
        public async Task<HomeSectionDto> CreateSectionAsync(CreateHomeSectionDto dto)
        {
            var validTypes = new[] { "featured_products", "top_vendors", "top_categories", "custom_products" };
            if (!validTypes.Contains(dto.Type))
                throw new Exception($"نوع القسم غير صحيح. الأنواع المتاحة: {string.Join(", ", validTypes)}");

            var section = new HomeSection
            {
                Type = dto.Type,
                Title = dto.Title,
                TitleAr = dto.TitleAr,
                Subtitle = dto.Subtitle,
                SubtitleAr = dto.SubtitleAr,
                MaxItems = dto.MaxItems,
                FilterCategoryId = dto.FilterCategoryId,
                FilterVendorId = dto.FilterVendorId,
                DisplayOrder = dto.DisplayOrder
            };

            if (dto.Type == "custom_products" && dto.ProductIds?.Any() == true)
            {
                section.Items = dto.ProductIds.Select((pid, index) => new HomeSectionItem
                {
                    EntityId = pid,
                    DisplayOrder = index
                }).ToList();
            }

            await _context.HomeSections.AddAsync(section);
            await _context.SaveChangesAsync();

            return await GetSectionByIdAsync(section.Id);
        }

        // ===================================
        // UpdateSectionAsync
        // ===================================
        public async Task<HomeSectionDto> UpdateSectionAsync(Guid id, UpdateHomeSectionDto dto)
        {
            var section = await _context.HomeSections
                .Include(s => s.Items)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (section == null)
                throw new Exception("القسم غير موجود");

            if (dto.Title != null) section.Title = dto.Title;
            if (dto.TitleAr != null) section.TitleAr = dto.TitleAr;
            if (dto.Subtitle != null) section.Subtitle = dto.Subtitle;
            if (dto.SubtitleAr != null) section.SubtitleAr = dto.SubtitleAr;
            if (dto.MaxItems != null) section.MaxItems = dto.MaxItems.Value;
            if (dto.IsActive != null) section.IsActive = dto.IsActive.Value;
            if (dto.DisplayOrder != null) section.DisplayOrder = dto.DisplayOrder.Value;
            if (dto.FilterCategoryId != null) section.FilterCategoryId = dto.FilterCategoryId;
            if (dto.FilterVendorId != null) section.FilterVendorId = dto.FilterVendorId;

            section.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return await GetSectionByIdAsync(id);
        }

        // ===================================
        // DeleteSectionAsync
        // ===================================
        public async Task<bool> DeleteSectionAsync(Guid id)
        {
            var section = await _context.HomeSections
                .Include(s => s.Items)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (section == null) return false;

            _context.HomeSections.Remove(section);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // AddSectionItemAsync
        // ===================================
        public async Task<HomeSectionDto> AddSectionItemAsync(Guid sectionId, AddSectionItemDto dto)
        {
            var section = await _context.HomeSections
                .Include(s => s.Items)
                .FirstOrDefaultAsync(s => s.Id == sectionId);

            if (section == null)
                throw new Exception("القسم غير موجود");

            if (section.Type != "custom_products")
                throw new Exception("إضافة عناصر يدوية متاحة فقط لأقسام custom_products");

            var productExists = await _context.Products.AnyAsync(p => p.Id == dto.ProductId);
            if (!productExists)
                throw new Exception("المنتج غير موجود");

            if (section.Items.Any(i => i.EntityId == dto.ProductId))
                throw new Exception("المنتج موجود بالفعل في هذا القسم");

            section.Items.Add(new HomeSectionItem
            {
                SectionId = sectionId,
                EntityId = dto.ProductId,
                DisplayOrder = dto.DisplayOrder
            });

            await _context.SaveChangesAsync();
            return await GetSectionByIdAsync(sectionId);
        }

        // ===================================
        // RemoveSectionItemAsync
        // ===================================
        public async Task<bool> RemoveSectionItemAsync(Guid sectionId, Guid productId)
        {
            var item = await _context.HomeSectionItems
                .FirstOrDefaultAsync(i => i.SectionId == sectionId && i.EntityId == productId);

            if (item == null) return false;

            _context.HomeSectionItems.Remove(item);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // Private: LoadSectionDataAsync
        // ===================================
        private async Task<HomeSectionDto> LoadSectionDataAsync(HomeSection section)
        {
            var dto = new HomeSectionDto
            {
                Id = section.Id,
                Type = section.Type,
                Title = section.Title,
                TitleAr = section.TitleAr,
                Subtitle = section.Subtitle,
                SubtitleAr = section.SubtitleAr,
                MaxItems = section.MaxItems,
                DisplayOrder = section.DisplayOrder,
                FilterCategoryId = section.FilterCategoryId,
                FilterVendorId = section.FilterVendorId,
                IsActive = section.IsActive
            };

            switch (section.Type)
            {
                case "featured_products":
                    dto.Data = await GetFeaturedProductsAsync(section);
                    break;
                case "top_vendors":
                    dto.Data = await GetTopVendorsAsync(section.MaxItems);
                    break;
                case "top_categories":
                    dto.Data = await GetTopCategoriesAsync(section.MaxItems);
                    break;
                case "custom_products":
                    dto.Data = await GetCustomProductsAsync(section);
                    break;
            }

            return dto;
        }

        // ===================================
        // Private: GetFeaturedProductsAsync
        // ===================================
        private async Task<object> GetFeaturedProductsAsync(HomeSection section)
        {
            var query = _context.Products
                .Include(p => p.Images)
                .Include(p => p.Vendor)
                .Include(p => p.Reviews)
                .Where(p => p.IsActive && p.IsAvailable);

            if (section.FilterCategoryId.HasValue)
                query = query.Where(p => p.CategoryId == section.FilterCategoryId);

            if (section.FilterVendorId.HasValue)
                query = query.Where(p => p.VendorId == section.FilterVendorId);

            var products = await query
                .OrderByDescending(p => p.SubOrderItems
                    .Where(i => i.SubOrder.Status == SubOrderStatus.Delivered)
                    .Sum(i => (int?)i.Quantity) ?? 0)
                .ThenByDescending(p => p.CreatedAt)
                .Take(section.MaxItems)
                .AsNoTracking()
                .ToListAsync();

            return products.Select(p => MapProductToSimpleDto(p));
        }

        // ===================================
        // Private: GetTopVendorsAsync
        // ===================================
        private async Task<object> GetTopVendorsAsync(int maxItems)
        {
            return await _context.Vendors
                .Where(v => v.IsActive)
                .OrderByDescending(v => v.SubOrders
                    .Count(so => so.Status == SubOrderStatus.Delivered))
                .Take(maxItems)
                .Select(v => new
                {
                    v.Id,
                    v.Name,
                    v.NameAr,
                    v.LogoUrl,
                    v.DeliveryFee,
                    v.EstimatedPrepTime,
                    v.MinOrderAmount,
                    TotalOrders = v.SubOrders.Count(so => so.Status == SubOrderStatus.Delivered)
                })
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // Private: GetTopCategoriesAsync
        // ===================================
        private async Task<object> GetTopCategoriesAsync(int maxItems)
        {
            return await _context.Categories
                .Where(c => c.IsActive && c.ParentId == null)
                .OrderBy(c => c.DisplayOrder)
                .Take(maxItems)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.NameAr,
                    c.IconUrl,
                    c.DisplayOrder,
                    ProductCount = c.Products.Count(p => p.IsActive && p.IsAvailable)
                })
                .AsNoTracking()
                .ToListAsync();
        }

        // ===================================
        // Private: GetCustomProductsAsync
        // ===================================
        private async Task<object> GetCustomProductsAsync(HomeSection section)
        {
            if (!section.Items.Any())
                return new List<object>();

            var productIds = section.Items
                .OrderBy(i => i.DisplayOrder)
                .Select(i => i.EntityId)
                .ToList();

            var products = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.Vendor)
                .Include(p => p.Reviews)
                .Where(p => productIds.Contains(p.Id) && p.IsActive && p.IsAvailable)
                .AsNoTracking()
                .ToListAsync();

            return productIds
                .Select(id => products.FirstOrDefault(p => p.Id == id))
                .Where(p => p != null)
                .Select(p => MapProductToSimpleDto(p!));
        }

        // ===================================
        // Private: MapProductToSimpleDto
        // ===================================
        private static object MapProductToSimpleDto(Product p)
        {
            var primaryImage = p.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl
                            ?? p.Images?.FirstOrDefault()?.ImageUrl;
            var approvedReviews = p.Reviews?.Where(r => r.IsApproved).ToList() ?? new();

            return new
            {
                p.Id,
                p.Name,
                p.NameAr,
                p.Price,
                p.OriginalPrice,
                HasDiscount = p.OriginalPrice.HasValue && p.OriginalPrice > p.Price,
                DiscountPercentage = p.OriginalPrice.HasValue && p.OriginalPrice > 0
                    ? (int)Math.Round((1 - (double)p.Price / (double)p.OriginalPrice!) * 100)
                    : (int?)null,
                PrimaryImageUrl = primaryImage,
                VendorName = p.Vendor?.Name,
                AverageRating = approvedReviews.Any()
                    ? Math.Round((decimal)approvedReviews.Average(r => r.Rating), 1)
                    : (decimal?)null,
                ReviewCount = approvedReviews.Count,
                p.IsAvailable,
                p.StockQuantity
            };
        }

        // ===================================
        // Private: MapBannerToDto
        // ===================================
        private static BannerDto MapBannerToDto(Banner b) => new()
        {
            Id = b.Id,
            Title = b.Title,
            TitleAr = b.TitleAr,
            Subtitle = b.Subtitle,
            SubtitleAr = b.SubtitleAr,
            ImageUrl = b.ImageUrl,
            LinkUrl = b.LinkUrl,
            LinkType = b.LinkType,
            LinkEntityId = b.LinkEntityId,
            DisplayOrder = b.DisplayOrder,
            StartsAt = b.StartsAt,
            EndsAt = b.EndsAt,
            IsActive = b.IsActive
        };
    }
}