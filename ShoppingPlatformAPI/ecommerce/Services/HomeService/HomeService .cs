using ecommerce.Core.Constants;
using ecommerce.Core.DTO.HomePage;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
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

            // السلايدر العلوي فقط — بانرات البلوكات تأتي مع أقسامها
            var banners = await _context.Banners
                .Where(b =>
                    b.SectionId == null &&
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

            return new HomePageDto
            {
                Banners = banners.Select(MapBannerToDto).ToList(),
                Sections = await BuildSectionDtosAsync(sections)
            };
        }

        // ===================================
        // GetBannersAsync
        // ===================================
        public async Task<List<BannerDto>> GetBannersAsync(bool onlyActive = true, bool heroOnly = false)
        {
            var now = DateTime.UtcNow;
            var query = _context.Banners.AsQueryable();

            if (heroOnly)
                query = query.Where(b => b.SectionId == null);

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
            if (dto.SectionId.HasValue)
                await EnsureBannerSectionAsync(dto.SectionId.Value);

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
                EndsAt = dto.EndsAt,
                SectionId = dto.SectionId
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

            if (dto.MoveToHero)
                banner.SectionId = null;
            else if (dto.SectionId.HasValue && dto.SectionId != banner.SectionId)
            {
                await EnsureBannerSectionAsync(dto.SectionId.Value);
                banner.SectionId = dto.SectionId;
            }

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

            return await BuildSectionDtosAsync(sections);
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

            return (await BuildSectionDtosAsync(new List<HomeSection> { section }))[0];
        }

        // ===================================
        // CreateSectionAsync
        // ===================================
        public async Task<HomeSectionDto> CreateSectionAsync(CreateHomeSectionDto dto)
        {
            var validTypes = new[] { "featured_products", "top_vendors", "top_categories", "custom_products", "banners" };
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

            // صور بانرات البلوك وصورة رأس القسم (السجلات تُحذف تلقائياً مع القسم)
            var bannerImages = await _context.Banners.Where(b => b.SectionId == id).Select(b => b.ImageUrl).ToListAsync();
            foreach (var url in bannerImages.Append(section.BannerImageUrl).Where(u => !string.IsNullOrWhiteSpace(u) && u!.StartsWith("/uploads/")))
                await _fileService.DeleteImageAsync(url!);

            _context.HomeSections.Remove(section);
            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // صورة بانر رأس القسم (لأقسام المنتجات)
        // ===================================
        public async Task<HomeSectionDto> SetSectionBannerAsync(Guid id, IFormFile image)
        {
            var section = await _context.HomeSections.FirstOrDefaultAsync(s => s.Id == id)
                ?? throw new Exception("القسم غير موجود");
            if (section.Type is "banners" or "top_vendors" or "top_categories")
                throw new Exception("صورة الرأس متاحة لأقسام المنتجات فقط");

            // الجديدة أولاً ثم حذف القديمة بعد الحفظ
            var old = section.BannerImageUrl;
            section.BannerImageUrl = await _fileService.SaveImageAsync(image, "banners");
            section.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            if (!string.IsNullOrWhiteSpace(old) && old.StartsWith("/uploads/"))
                await _fileService.DeleteImageAsync(old);

            return await GetSectionByIdAsync(id);
        }

        public async Task<bool> RemoveSectionBannerAsync(Guid id)
        {
            var section = await _context.HomeSections.FirstOrDefaultAsync(s => s.Id == id);
            if (section == null || string.IsNullOrWhiteSpace(section.BannerImageUrl)) return false;

            var old = section.BannerImageUrl;
            section.BannerImageUrl = null;
            section.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            if (old.StartsWith("/uploads/"))
                await _fileService.DeleteImageAsync(old);
            return true;
        }

        private async Task EnsureBannerSectionAsync(Guid sectionId)
        {
            if (!await _context.HomeSections.AnyAsync(s => s.Id == sectionId && s.Type == "banners"))
                throw new Exception("القسم المحدد ليس قسم بانرات");
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

            var productExists = await _context.Products.AnyAsync(p => p.Id == dto.ProductId && !p.IsDeleted);
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
        // تحميل الأقسام
        // البيانات المشتركة (شجرة الفئات، العروض، بانرات البلوكات) تُحمَّل مرة واحدة لكل الأقسام،
        // ثم التقييمات ومخزون المتغيرات دفعة واحدة لكل منتجات الصفحة — بدل تكرارها في كل قسم
        // ===================================
        private sealed class SectionLoadContext
        {
            public required IReadOnlyCollection<CategoryVisibility.CategoryNode> CategoryTree { get; init; }
            public required List<Guid> HiddenCategoryIds { get; init; }
            public required List<Promotion> Promotions { get; init; }
            public required ILookup<Guid, Banner> BlockBanners { get; init; }
        }

        private async Task<SectionLoadContext> CreateLoadContextAsync(IEnumerable<HomeSection> sections)
        {
            var now = DateTime.UtcNow;
            var tree = await CategoryVisibility.LoadTreeAsync(_context);

            var promotions = await _context.Promotions.AsNoTracking()
                .Where(p => p.IsActive && (p.StartsAt == null || p.StartsAt <= now) && (p.ExpiresAt == null || p.ExpiresAt >= now))
                .ToListAsync();

            var blockIds = sections.Where(s => s.Type == "banners").Select(s => s.Id).ToList();
            var blockBanners = blockIds.Count == 0 ? new List<Banner>() : await _context.Banners.AsNoTracking()
                .Where(b => b.SectionId != null && blockIds.Contains(b.SectionId.Value) && b.IsActive &&
                            (b.StartsAt == null || b.StartsAt <= now) && (b.EndsAt == null || b.EndsAt >= now))
                .OrderBy(b => b.DisplayOrder)
                .ToListAsync();

            return new SectionLoadContext
            {
                CategoryTree = tree,
                HiddenCategoryIds = CategoryVisibility.ComputeHidden(tree).ToList(),
                Promotions = promotions,
                BlockBanners = blockBanners.ToLookup(b => b.SectionId!.Value),
            };
        }

        private async Task<List<HomeSectionDto>> BuildSectionDtosAsync(List<HomeSection> sections)
        {
            var ctx = await CreateLoadContextAsync(sections);
            var dtos = new List<HomeSectionDto>();
            var picks = new List<(HomeSectionDto Dto, List<Guid> ProductIds)>();

            // المرشحون: كل المنتجات الظاهرة والمتوفرة مع مبيعاتها المسلَّمة — استعلام خفيف واحد،
            // ثم يُختار محتوى كل قسم في الذاكرة بدل استعلام مرتّب لكل قسم
            List<ProductCandidate>? candidates = null;
            async Task<List<ProductCandidate>> Candidates() => candidates ??= await LoadCandidatesAsync(ctx);

            foreach (var section in sections)
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
                    BannerImageUrl = section.BannerImageUrl,
                    IsActive = section.IsActive
                };
                dtos.Add(dto);

                switch (section.Type)
                {
                    case "featured_products":
                        picks.Add((dto, PickFeatured(section, await Candidates(), ctx)));
                        break;
                    case "custom_products":
                        picks.Add((dto, PickCustom(section, await Candidates())));
                        break;
                    case "top_vendors":
                        dto.Data = await GetTopVendorsAsync(section.MaxItems);
                        break;
                    case "top_categories":
                        dto.Data = await GetTopCategoriesAsync(section.MaxItems);
                        break;
                    case "banners":
                        dto.Data = ctx.BlockBanners[section.Id].Select(MapBannerToDto).ToList();
                        break;
                }
            }

            // تفاصيل كل المنتجات المختارة + تقييماتها ومخزون متغيراتها — ثلاثة استعلامات لكل الصفحة
            var ids = picks.SelectMany(x => x.ProductIds).Distinct().ToList();
            var products = new Dictionary<Guid, Product>();
            var ratings = new Dictionary<Guid, (double Average, int Count)>();
            var variantStock = new Dictionary<Guid, int>();
            if (ids.Count > 0)
            {
                products = await _context.Products.AsNoTracking()
                    .Include(p => p.Images)
                    .Include(p => p.Vendor)
                    .Where(p => ids.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id);
                ratings = (await _context.Reviews.AsNoTracking()
                        .Where(r => r.IsApproved && ids.Contains(r.ProductId))
                        .GroupBy(r => r.ProductId)
                        .Select(g => new { ProductId = g.Key, Average = g.Average(r => (double)r.Rating), Count = g.Count() })
                        .ToListAsync())
                    .ToDictionary(x => x.ProductId, x => (x.Average, x.Count));
                variantStock = await _context.ProductVariants.AsNoTracking()
                    .Where(v => ids.Contains(v.ProductId))
                    .GroupBy(v => v.ProductId)
                    .Select(g => new { ProductId = g.Key, Stock = g.Sum(v => v.IsAvailable ? v.StockQuantity : 0) })
                    .ToDictionaryAsync(x => x.ProductId, x => x.Stock);
            }

            foreach (var (dto, productIds) in picks)
                dto.Data = productIds
                    .Where(products.ContainsKey)
                    .Select(id => MapProductToSimpleDto(products[id], ctx.Promotions, variantStock, ratings))
                    .ToList();

            return dtos;
        }

        private sealed record ProductCandidate(Guid Id, Guid? CategoryId, Guid VendorId, DateTime CreatedAt, int Sold);

        // الظاهر للعامة ومتوفر: بلا متغيرات → مفتاح المنتج؛ بمتغيرات → متغير متوفر بمخزون
        private async Task<List<ProductCandidate>> LoadCandidatesAsync(SectionLoadContext ctx)
        {
            var query = _context.Products.AsNoTracking()
                .Where(p => p.IsActive && !p.IsDeleted && p.Vendor.IsActive &&
                    ((!_context.ProductVariants.Any(v => v.ProductId == p.Id) && p.IsAvailable) ||
                     _context.ProductVariants.Any(v => v.ProductId == p.Id && v.IsAvailable && v.StockQuantity > 0)));

            var hidden = ctx.HiddenCategoryIds;
            if (hidden.Count > 0)
                query = query.Where(p => p.CategoryId == null || !hidden.Contains(p.CategoryId.Value));

            return await query
                .Select(p => new ProductCandidate(p.Id, p.CategoryId, p.VendorId, p.CreatedAt,
                    p.SubOrderItems.Where(i => i.SubOrder.Status == SubOrderStatus.Delivered).Sum(i => (int?)i.Quantity) ?? 0))
                .ToListAsync();
        }

        // المميزة: الأكثر مبيعاً (ثم الأحدث)، والفئة الرئيسية تشمل فئاتها الفرعية
        private static List<Guid> PickFeatured(HomeSection section, List<ProductCandidate> candidates, SectionLoadContext ctx)
        {
            IEnumerable<ProductCandidate> query = candidates;

            if (section.FilterCategoryId.HasValue)
            {
                var categoryIds = CategoryVisibility.Descendants(ctx.CategoryTree, section.FilterCategoryId.Value).ToHashSet();
                query = query.Where(p => p.CategoryId.HasValue && categoryIds.Contains(p.CategoryId.Value));
            }

            if (section.FilterVendorId.HasValue)
                query = query.Where(p => p.VendorId == section.FilterVendorId);

            return query
                .OrderByDescending(p => p.Sold)
                .ThenByDescending(p => p.CreatedAt)
                .Take(section.MaxItems)
                .Select(p => p.Id)
                .ToList();
        }

        // المختارة يدوياً: بترتيب الأدمن، الظاهرة والمتوفرة فقط
        private static List<Guid> PickCustom(HomeSection section, List<ProductCandidate> candidates)
        {
            var visible = candidates.Select(c => c.Id).ToHashSet();
            return section.Items
                .OrderBy(i => i.DisplayOrder)
                .Select(i => i.EntityId)
                .Where(visible.Contains)
                .ToList();
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
                    v.CoverImageUrl,
                    v.DeliveryFee,
                    v.EstimatedPrepTime,
                    v.MinOrderAmount,
                    TotalOrders = v.SubOrders.Count(so => so.Status == SubOrderStatus.Delivered),
                    Rating = _context.SubOrderRatings.Where(r => r.VendorId == v.Id).Average(r => (double?)r.VendorRating),
                    RatingsCount = _context.SubOrderRatings.Count(r => r.VendorId == v.Id)
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
        // Private: MapProductToSimpleDto
        // نفس سعر العرض في القوائم والسلة، ومخزون/توفر المنتج ذي المتغيرات من متغيراته
        // ===================================
        private static object MapProductToSimpleDto(Product p, List<Promotion> activePromotions,
            Dictionary<Guid, int> variantStock, Dictionary<Guid, (double Average, int Count)> ratings)
        {
            var primaryImage = p.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl
                            ?? p.Images?.FirstOrDefault()?.ImageUrl;

            var promotion = PromotionPricing.SelectBest(activePromotions, p.Id, p.CategoryId, p.VendorId);
            var price = promotion == null ? p.Price : PromotionPricing.CalculateDiscount(p.Price, promotion).FinalPrice;
            var originalPrice = promotion == null ? p.OriginalPrice : p.OriginalPrice ?? p.Price;
            var hasDiscount = originalPrice.HasValue && originalPrice > price;

            var hasVariants = variantStock.TryGetValue(p.Id, out var stockFromVariants);
            var hasRating = ratings.TryGetValue(p.Id, out var rating);

            return new
            {
                p.Id,
                p.Name,
                p.NameAr,
                Price = price,
                OriginalPrice = originalPrice,
                HasDiscount = hasDiscount,
                DiscountPercentage = hasDiscount
                    ? (int)Math.Round((1 - (double)price / (double)originalPrice!.Value) * 100)
                    : (int?)null,
                HasPromotion = promotion != null,
                PromotionNameAr = promotion?.NameAr,
                PrimaryImageUrl = primaryImage,
                p.VendorId,
                VendorName = p.Vendor?.Name,
                AverageRating = hasRating ? Math.Round((decimal)rating.Average, 1) : (decimal?)null,
                ReviewCount = hasRating ? rating.Count : 0,
                IsAvailable = hasVariants ? stockFromVariants > 0 : p.IsAvailable,
                StockQuantity = hasVariants ? stockFromVariants : p.StockQuantity,
                HasVariants = hasVariants
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
            IsActive = b.IsActive,
            SectionId = b.SectionId
        };
    }
}