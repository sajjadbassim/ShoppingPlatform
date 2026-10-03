using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;

// أقسام الصفحة الرئيسية للمحاكاة: أقسام مميزة حسب الفئة (تتحدث تلقائياً بالأكثر مبيعاً)،
// أقسام مختارة تُملأ من البيانات الفعلية (العروض، الأعلى تقييماً، وصل حديثاً)،
// بلوكات بانرات بين الأقسام، وبانرات رأس لبعض أقسام المنتجات.
// التعرّف على القسم بعنوانه الإنجليزي، فإعادة التشغيل تحدّث الأقسام بدل تكرارها.
// أقسام الأدمن الأخرى (مثل "pets") لا يُغيَّر محتواها — فقط ترتيب ظهورها.
static class HomeSectionsSeeder
{
    private const string DemoBannerPrefix = "/uploads/banners/demo-";

    private record SectionDef(string Title, string TitleAr, string? SubtitleAr, string Type,
        string? CategoryName = null, string? Custom = null, int MaxItems = 10,
        BannerArt? Header = null, BannerArt[]? Banners = null);

    // بالترتيب الذي تظهر به في الصفحة
    private static readonly SectionDef[] Sections =
    {
        new("Promo: Electronics", "بانرات الإلكترونيات", null, "banners", Banners: new[]
        {
            new BannerArt("wide", "Electronics", "كل جديد", "بعالم الإلكترونيات", new[] { "iPhone 13 Pro", "Samsung Galaxy S10", "Apple Airpods" },
                "#e0e7ff", "#a5b4fc", "#dc2626", "#7f1d1d", "Electronics"),
            new BannerArt("square", "Headphones", "صوت يرافقك", "بكل لحظة", new[] { "Apple AirPods Max Silver" },
                "#fce7f3", "#ddd6fe", "#dc2626", "#7f1d1d", "Mobile Accessories"),
            new BannerArt("square", "Perfumes", "عطرك", "يحكي عنك", new[] { "Dior J'adore", "Gucci Bloom Eau de" },
                "#fdf2f8", "#fbcfe8", "#be123c", "#881337", "Perfumes"),
        }),
        new("Electronics Deals", "", null, "featured_products"),                       // موجود
        new("Featured Products", "", null, "featured_products"),                       // موجود — يبقى عنوانه
        new("Today's Deals", "🔥 عروض اليوم", "خصومات حقيقية لفترة محدودة", "custom_products", Custom: "deals", MaxItems: 12),
        new("Top Stores", "", "الأكثر طلباً عند زبائننا", "top_vendors", MaxItems: 6),  // موجود — أعلى 6 متاجر طلباً (لا كلها)
        new("Daily Groceries", "🛒 مقاضي البيت", "خضار، لحوم، ألبان ومشروبات لباب بيتك", "featured_products", "Supermarket",
            Header: new BannerArt("header", "Groceries", "", "", new[] { "Strawberry", "Lemon", "Apple" }, "#14532d", "#22c55e", "", "")),
        new("Beauty World", "💄 عالم الجمال", "عطور أصلية ومكياج وعناية بالبشرة", "featured_products", "Beauty & Care",
            Header: new BannerArt("header", "Beauty", "", "", new[] { "Gucci Bloom Eau de", "Eyeshadow Palette with Mirror", "Essence Mascara Lash Princess" }, "#831843", "#ec4899", "", "")),
        new("Promo: Fresh", "بانر الخضار", null, "banners", Banners: new[]
        {
            new BannerArt("wide", "Fresh Basket", "خضار وفواكه طازجة", "خصم 15% لفترة محدودة", new[] { "Strawberry", "Apple", "Kiwi" },
                "#ecfccb", "#86efac", "#15803d", "#14532d", "Fruits & Vegetables"),
        }),
        new("Fashion & Accessories", "👗 أزياء وإكسسوارات", "ملابس وحقائب وإكسسوارات بأحدث الصيحات", "featured_products", "Fashion"),
        new("Top Rated", "⭐ الأعلى تقييماً", "المنتجات المفضلة عند زبائننا", "custom_products", Custom: "top-rated"),
        new("Phone Accessories", "🎧 إكسسوارات الهواتف", "سماعات، شواحن وكفرات أصلية", "featured_products", "Mobile Accessories",
            Header: new BannerArt("header", "Phone Accessories", "", "", new[] { "Apple AirPods Max Silver", "Apple Airpods" }, "#1e1b4b", "#6366f1", "", "")),
        new("Shoes", "👟 أحذية لكل خطوة", "رياضية وكلاسيكية للرجال والنساء", "featured_products", "Shoes"),
        new("Promo: Style", "بانرات الأناقة", null, "banners", Banners: new[]
        {
            new BannerArt("square", "Shoes", "خطوتك", "بأناقة", new[] { "Nike Air Jordan 1 Red And Black" },
                "#ffedd5", "#fdba74", "#c2410c", "#7c2d12", "Shoes"),
            new BannerArt("square", "Watches", "ساعات", "تليق بك", new[] { "Rolex Submariner Watch" },
                "#f1f5f9", "#cbd5e1", "#b91c1c", "#334155", "Watches"),
        }),
        new("Home & Kitchen", "🏠 كل ما يحتاجه بيتك", "أدوات مطبخ، أثاث وديكور", "featured_products", "Home",
            Header: new BannerArt("header", "Home & Kitchen", "", "", new[] { "Microwave Oven", "Boxed Blender", "Electric Stove" }, "#7c2d12", "#f97316", "", "")),
        new("Watches", "⌚ ساعات أنيقة", "من الكلاسيكية إلى الفاخرة", "featured_products", "Watches"),
        new("Sports", "⚽ رياضة ونشاط", "كرات ومضارب ومعدات لكل الألعاب", "featured_products", "Sports"),
        new("New Arrivals", "✨ وصل حديثاً", "آخر ما أضافته المتاجر", "custom_products", Custom: "new"),
    };

    public static async Task SeedAsync(AppDbContext db, string wwwroot)
    {
        Console.WriteLine("أقسام الصفحة الرئيسية...");
        var categories = await db.Categories.AsNoTracking().ToListAsync();
        var existing = await db.HomeSections.Include(s => s.Items).ToListAsync();
        var lists = await BuildCustomListsAsync(db);
        var art = new ArtWriter(db, wwwroot);
        var now = DateTime.UtcNow;

        var order = 1;
        foreach (var def in Sections)
        {
            var section = existing.FirstOrDefault(s => s.Title == def.Title);
            if (section == null)
            {
                section = new HomeSection { Title = def.Title, Type = def.Type, CreatedAt = now, UpdatedAt = now };
                db.HomeSections.Add(section);
                existing.Add(section);
            }

            section.DisplayOrder = order++;
            section.IsActive = true;
            section.MaxItems = def.MaxItems;
            if (def.TitleAr.Length > 0) section.TitleAr = def.TitleAr;
            if (def.SubtitleAr != null) section.SubtitleAr = def.SubtitleAr;
            if (def.CategoryName != null)
                section.FilterCategoryId = categories.First(c => c.Name == def.CategoryName).Id;

            if (def.Custom != null)
            {
                db.HomeSectionItems.RemoveRange(section.Items);
                var i = 0;
                foreach (var productId in lists[def.Custom].Take(def.MaxItems))
                    db.HomeSectionItems.Add(new HomeSectionItem { SectionId = section.Id, EntityId = productId, DisplayOrder = i++ });
            }

            // بانر رأس قسم المنتجات (لا نستبدل صورة رفعها الأدمن)
            if (def.Header != null && (section.BannerImageUrl == null || section.BannerImageUrl.StartsWith(DemoBannerPrefix)))
                section.BannerImageUrl = await art.WriteAsync(def.Header, $"header-{Slug(def.Title)}");

            // بانرات البلوك: نعيد إنشاء بانرات المحاكاة فقط، ونترك ما أضافه الأدمن
            if (def.Banners != null)
            {
                db.Banners.RemoveRange(await db.Banners.Where(b => b.SectionId == section.Id && b.ImageUrl.StartsWith(DemoBannerPrefix)).ToListAsync());
                var i = 0;
                foreach (var banner in def.Banners)
                {
                    db.Banners.Add(new Banner
                    {
                        Title = banner.Title, TitleAr = $"{banner.Line1} {banner.Line2}".Trim(),
                        ImageUrl = await art.WriteAsync(banner, $"{Slug(def.Title)}-{i + 1}"),
                        LinkType = banner.LinkCategory != null ? "category" : null,
                        LinkEntityId = banner.LinkCategory != null ? categories.First(c => c.Name == banner.LinkCategory).Id : null,
                        SectionId = section.Id, DisplayOrder = i++, IsActive = true, CreatedAt = now, UpdatedAt = now,
                    });
                }
            }
        }

        // أقسام الأدمن غير المعرّفة هنا تأتي بعد أقسام المحاكاة بنفس ترتيبها
        foreach (var other in existing.Where(s => Sections.All(d => d.Title != s.Title)).OrderBy(s => s.DisplayOrder))
            other.DisplayOrder = order++;

        await SeedCategoryPhotosAsync(db, wwwroot);
        await SeedStoreCoversAsync(db, art);
        await SeedStoreLogosAsync(db, wwwroot);
        await db.SaveChangesAsync();
        Console.WriteLine($"  {Sections.Length} قسم محاكاة، {art.Count} صورة بانر");
    }

    // أغلفة المتاجر: خلفية متدرجة بلون المتجر + صور من منتجاته — بدل الغلاف التجريبي المكرر.
    // لا نستبدل غلافاً خاصاً رفعه البائع — فقط الفارغ أو المكرر بين عدة متاجر أو أغلفة المحاكاة.
    private static readonly Dictionary<string, BannerArt> StoreCovers = new()
    {
        ["Elite Electronics"] = Cover(new[] { "iPhone 13 Pro", "Apple MacBook Pro 14 Inch Space Grey", "Apple Airpods" }, "#1e1b4b", "#4f46e5"),
        ["City Fashion"] = Cover(new[] { "Black Women's Gown", "Man Plaid Shirt", "Blue Frock" }, "#831843", "#f472b6"),
        ["Home Essentials"] = Cover(new[] { "Microwave Oven", "Boxed Blender", "Electric Stove" }, "#7c2d12", "#fb923c"),
        ["Al-Rafidain Mart"] = Cover(new[] { "Strawberry", "Apple", "Milk" }, "#14532d", "#4ade80"),
        ["Beauty House"] = Cover(new[] { "Gucci Bloom Eau de", "Eyeshadow Palette with Mirror", "Red Lipstick" }, "#701a75", "#e879f9"),
        ["Shoes & Sports World"] = Cover(new[] { "Nike Air Jordan 1 Red And Black", "Football", "Puma Future Rider Trainers" }, "#0c4a6e", "#38bdf8"),
        ["Watches & Accessories Corner"] = Cover(new[] { "Rolex Submariner Watch", "Prada Women Bag", "Black Sun Glasses" }, "#422006", "#ca8a04"),
        ["Decor & Furniture House"] = Cover(new[] { "Annibale Colombo Sofa", "Table Lamp", "Plant Pot" }, "#134e4a", "#2dd4bf"),
    };

    private static BannerArt Cover(string[] products, string bg1, string bg2) => new("header", "Cover", "", "", products, bg1, bg2, "", "");

    private static async Task SeedStoreCoversAsync(AppDbContext db, ArtWriter art)
    {
        var vendors = await db.Vendors.ToListAsync();
        var shared = vendors.Where(v => !string.IsNullOrEmpty(v.CoverImageUrl)).GroupBy(v => v.CoverImageUrl)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();

        foreach (var vendor in vendors)
        {
            if (!StoreCovers.TryGetValue(vendor.Name, out var cover)) continue;
            var replaceable = string.IsNullOrEmpty(vendor.CoverImageUrl) || shared.Contains(vendor.CoverImageUrl) || vendor.CoverImageUrl.Contains("/demo-");
            if (!replaceable) continue;
            vendor.CoverImageUrl = await art.WriteAsync(cover, $"store-{Slug(vendor.Name)}");
        }
    }

    // شعارات المتاجر: مربع بزوايا دائرية بتدرج ألوان غلاف المتجر + أيقونة نشاطه بالأبيض (أيقونات lucide، رخصة ISC).
    // لا نستبدل شعاراً رفعه البائع — فقط الفارغ أو الشعارات التجريبية (المسماة باسم المتجر) أو شعارات المحاكاة.
    private static readonly Dictionary<string, string> StoreIcons = new()
    {
        ["Elite Electronics"] = "<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"/><path d=\"M12 18h.01\"/>",
        ["City Fashion"] = "<path d=\"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z\"/>",
        ["Home Essentials"] = "<path d=\"M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z\"/><line x1=\"6\" x2=\"18\" y1=\"17\" y2=\"17\"/>",
        ["Al-Rafidain Mart"] = "<circle cx=\"8\" cy=\"21\" r=\"1\"/><circle cx=\"19\" cy=\"21\" r=\"1\"/><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\"/>",
        ["Beauty House"] = "<path d=\"m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z\"/><path d=\"M5 3v4\"/><path d=\"M19 17v4\"/><path d=\"M3 5h4\"/><path d=\"M17 19h4\"/>",
        ["Shoes & Sports World"] = "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\"/><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\"/><path d=\"M16 17h4\"/><path d=\"M4 13h4\"/>",
        ["Watches & Accessories Corner"] = "<circle cx=\"12\" cy=\"12\" r=\"6\"/><polyline points=\"12 10 12 12 13 13\"/><path d=\"m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05\"/><path d=\"m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05\"/>",
        ["Decor & Furniture House"] = "<path d=\"M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3\"/><path d=\"M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z\"/><path d=\"M4 18v2\"/><path d=\"M20 18v2\"/><path d=\"M12 4v9\"/>",
    };

    private static async Task SeedStoreLogosAsync(AppDbContext db, string wwwroot)
    {
        var dir = Path.Combine(wwwroot, "uploads", "vendors");
        Directory.CreateDirectory(dir);

        foreach (var vendor in await db.Vendors.ToListAsync())
        {
            if (!StoreIcons.TryGetValue(vendor.Name, out var icon) || !StoreCovers.TryGetValue(vendor.Name, out var palette)) continue;
            var logo = vendor.LogoUrl ?? "";
            var placeholder = logo.Length == 0 || logo.Contains("/demo-") ||
                              System.Text.RegularExpressions.Regex.IsMatch(logo, @"^/uploads/vendors/[a-z0-9-]+-logo\.(png|svg)$");
            if (!placeholder) continue;

            // من الفاتح إلى الداكن (عكس الغلاف) ليبرز الشعار فوق الغلاف
            var svg =
                "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\">" +
                $"<defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"{palette.Bg2}\"/><stop offset=\"1\" stop-color=\"{palette.Bg1}\"/></linearGradient></defs>" +
                "<rect width=\"256\" height=\"256\" rx=\"64\" fill=\"url(#g)\"/>" +
                "<circle cx=\"48\" cy=\"36\" r=\"96\" fill=\"#fff\" opacity=\"0.12\"/>" +
                $"<g transform=\"translate(64 64) scale(5.333)\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\">{icon}</g></svg>";

            var name = $"demo-logo-{Slug(vendor.Name)}.svg";
            await File.WriteAllTextAsync(Path.Combine(dir, name), svg);
            vendor.LogoUrl = $"/uploads/vendors/{name}";
        }
    }

    // صور دوائر الفئات: صورة منتج حقيقي (خلفيتها شفافة) بدل الأيقونات التجريبية المكررة.
    // لا نستبدل أيقونة خاصة رفعها الأدمن — فقط الفارغة أو المكررة بين عدة فئات أو صور المحاكاة.
    private static readonly Dictionary<string, string> RootCategoryPhotos = new()
    {
        ["Electronics"] = "iPhone 13 Pro", ["Beauty & Care"] = "Gucci Bloom Eau de", ["Fashion"] = "Black Women's Gown",
        ["Sports"] = "Football", ["Home"] = "Table Lamp", ["Supermarket"] = "Apple", ["Pets"] = "Dog Food",
    };

    private static async Task SeedCategoryPhotosAsync(AppDbContext db, string wwwroot)
    {
        var categories = await db.Categories.ToListAsync();
        var shared = categories.Where(c => !string.IsNullOrEmpty(c.IconUrl)).GroupBy(c => c.IconUrl)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
        var dir = Path.Combine(wwwroot, "uploads", "categories");
        Directory.CreateDirectory(dir);

        foreach (var category in categories)
        {
            var replaceable = string.IsNullOrEmpty(category.IconUrl) || shared.Contains(category.IconUrl) || category.IconUrl.Contains("/demo-");
            if (!replaceable) continue;

            // الرئيسية: منتج مختار، والفرعية: أول منتج ظاهر فيها
            var query = db.ProductImages.AsNoTracking().Where(i => i.IsPrimary && !i.Product.IsDeleted && i.Product.IsActive);
            var imageUrl = RootCategoryPhotos.TryGetValue(category.Name, out var productName)
                ? await query.Where(i => i.Product.Name == productName).Select(i => i.ImageUrl).FirstOrDefaultAsync()
                : null;
            if (imageUrl == null)
            {
                // المنتج المختار غير ظاهر (أو لا اختيار): أول منتج ظاهر في الفئة أو فئاتها الفرعية
                var ids = await CategoryVisibility.GetWithDescendantsAsync(db, category.Id);
                imageUrl = await query.Where(i => i.Product.CategoryId != null && ids.Contains(i.Product.CategoryId.Value))
                    .OrderBy(i => i.Product.CreatedAt).Select(i => i.ImageUrl).FirstOrDefaultAsync();
            }
            if (imageUrl == null) continue;

            var source = Path.Combine(wwwroot, imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(source)) continue;
            var name = $"demo-{Slug(category.Name)}{Path.GetExtension(source)}";
            File.Copy(source, Path.Combine(dir, name), overwrite: true);
            category.IconUrl = $"/uploads/categories/{name}";
        }
    }

    private static string Slug(string title) =>
        new string(title.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-').Replace("--", "-");

    // يكتب صورة البانر في wwwroot/uploads/banners ويعيد رابطها
    private sealed class ArtWriter(AppDbContext db, string wwwroot)
    {
        private readonly Dictionary<string, string> _dataUris = new();
        public int Count { get; private set; }

        public async Task<string> WriteAsync(BannerArt banner, string name)
        {
            var images = new List<string>();
            foreach (var productName in banner.Products)
            {
                var uri = await DataUriAsync(productName);
                if (uri != null) images.Add(uri);
            }

            var dir = Path.Combine(wwwroot, "uploads", "banners");
            Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(Path.Combine(dir, $"demo-{name}.svg"), banner.Render(images));
            Count++;
            return $"{DemoBannerPrefix}{name}.svg";
        }

        private async Task<string?> DataUriAsync(string productName)
        {
            if (_dataUris.TryGetValue(productName, out var cached)) return cached;
            var url = await db.ProductImages.AsNoTracking()
                .Where(i => i.IsPrimary && i.Product.Name == productName && !i.Product.IsDeleted)
                .Select(i => i.ImageUrl).FirstOrDefaultAsync();
            if (url == null) return null;

            var path = Path.Combine(wwwroot, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(path)) return null;
            var mime = Path.GetExtension(path).ToLowerInvariant() switch { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", _ => "image/webp" };
            return _dataUris[productName] = $"data:{mime};base64,{Convert.ToBase64String(await File.ReadAllBytesAsync(path))}";
        }
    }

    // القوائم المختارة من المنتجات الظاهرة والمتوفرة فقط
    private static async Task<Dictionary<string, List<Guid>>> BuildCustomListsAsync(AppDbContext db)
    {
        var hidden = await CategoryVisibility.GetHiddenCategoryIdsAsync(db);
        var products = (await db.Products.AsNoTracking()
                .Where(p => p.IsActive && !p.IsDeleted && p.Vendor.IsActive)
                .Select(p => new { p.Id, p.Price, p.OriginalPrice, p.CategoryId, p.VendorId, p.StockQuantity, p.IsAvailable, p.CreatedAt })
                .ToListAsync())
            .Where(p => p.CategoryId == null || !hidden.Contains(p.CategoryId.Value))
            .ToList();

        var variantStock = await db.ProductVariants.AsNoTracking()
            .GroupBy(v => v.ProductId)
            .Select(g => new { ProductId = g.Key, Stock = g.Sum(v => v.IsAvailable ? v.StockQuantity : 0) })
            .ToDictionaryAsync(x => x.ProductId, x => x.Stock);
        var inStock = products
            .Where(p => variantStock.TryGetValue(p.Id, out var s) ? s > 0 : p.IsAvailable && p.StockQuantity > 0)
            .ToList();

        // العروض: نسبة التوفير الفعلية بعد العرض (نفس حساب السلة) مقارنة بالسعر المشطوب
        var now = DateTime.UtcNow;
        var promotions = await db.Promotions.AsNoTracking()
            .Where(p => p.IsActive && (p.StartsAt == null || p.StartsAt <= now) && (p.ExpiresAt == null || p.ExpiresAt >= now))
            .ToListAsync();
        var deals = inStock
            .Select(p =>
            {
                var promo = PromotionPricing.SelectBest(promotions, p.Id, p.CategoryId, p.VendorId);
                var final = promo == null ? p.Price : PromotionPricing.CalculateDiscount(p.Price, promo).FinalPrice;
                var reference = p.OriginalPrice ?? p.Price;
                return new { p.Id, Saving = reference > 0 ? (reference - final) / reference : 0 };
            })
            .Where(x => x.Saving > 0)
            .OrderByDescending(x => x.Saving)
            .Select(x => x.Id)
            .ToList();

        // الأعلى تقييماً: تقييمان على الأقل
        var ids = inStock.Select(p => p.Id).ToList();
        var topRated = (await db.Reviews.AsNoTracking()
                .Where(r => r.IsApproved && ids.Contains(r.ProductId))
                .GroupBy(r => r.ProductId)
                .Select(g => new { ProductId = g.Key, Avg = g.Average(r => (double)r.Rating), Count = g.Count() })
                .ToListAsync())
            .Where(x => x.Count >= 2)
            .OrderByDescending(x => x.Avg).ThenByDescending(x => x.Count)
            .Select(x => x.ProductId)
            .ToList();

        // وصل حديثاً: من متاجر مختلفة قدر الإمكان حتى لا يطغى متجر واحد
        var newest = inStock
            .OrderByDescending(p => p.CreatedAt)
            .GroupBy(p => p.VendorId)
            .SelectMany(g => g.Take(2))
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => p.Id)
            .ToList();

        return new Dictionary<string, List<Guid>> { ["deals"] = deals, ["top-rated"] = topRated, ["new"] = newest };
    }
}
