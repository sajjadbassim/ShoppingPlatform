// =====================================================================
// DemoSeeder — يملأ قاعدة بيانات التطوير ببيانات محاكاة واقعية:
// 8 متاجر، ~180 منتجاً بصور حقيقية (DummyJSON) وأسماء عربية وأسعار بالدينار،
// متغيرات (مقاسات/أحجام/سعات)، عروض، زبائن وعناوين في بغداد، سائقون،
// طلبات آخر 60 يوماً بحالاتها، قيود مالية للمتاجر، تقييمات منتجات ومتاجر وسائقين.
//
// الاستخدام (من مجلد DemoSeeder):  dotnet run -- [مسار مجلد ecommerce]
// لا يُشغَّل إلا على بيانات التطوير. يتوقف إن وجد بيانات محاكاة سابقة (@demo.seed).
// كلمة مرور كل حسابات المحاكاة: Demo@12345
// =====================================================================

using System.Text.Json;
using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.FinanceService;
using Microsoft.EntityFrameworkCore;

Console.OutputEncoding = System.Text.Encoding.UTF8;
const string DemoDomain = "@demo.seed";
const string DemoPassword = "Demo@12345";
var rnd = new Random(2026);
var nowUtc = DateTime.UtcNow;

// ---------- المسارات والاتصال ----------
var apiDir = args.Length > 0 ? args[0] : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "ecommerce"));
var settingsPath = Path.Combine(apiDir, "appsettings.Development.json");
if (!File.Exists(settingsPath)) { Console.WriteLine($"لم أجد {settingsPath}"); return 1; }
var connectionString = JsonDocument.Parse(File.ReadAllText(settingsPath))
    .RootElement.GetProperty("ConnectionStrings").GetProperty("DefaultConnection").GetString()!;
var wwwroot = Path.Combine(apiDir, "wwwroot");

var products = JsonSerializer.Deserialize<List<SeedProduct>>(
    File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "products.json")),
    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connectionString).Options);

// --sections: إنشاء/تحديث أقسام الصفحة الرئيسية فقط (يمكن تكراره لتحديث القوائم المختارة)
if (args.Contains("--sections"))
{
    await HomeSectionsSeeder.SeedAsync(db, wwwroot);
    return 0;
}

if (await db.Users.AnyAsync(u => u.Email.EndsWith(DemoDomain)))
{
    Console.WriteLine("بيانات المحاكاة موجودة مسبقاً — توقفت دون تغيير.");
    return 1;
}

// ---------- 1) تنزيل الصور (قبل المعاملة) ----------
Console.WriteLine("تنزيل صور المنتجات...");
var productsDir = Path.Combine(wwwroot, "uploads", "products");
Directory.CreateDirectory(productsDir);
var imageMap = new Dictionary<string, string>();
using (var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) })
{
    var gate = new SemaphoreSlim(6);
    var urls = products.SelectMany(p => p.Images).Distinct().ToList();
    var failed = 0;
    await Task.WhenAll(urls.Select(async url =>
    {
        await gate.WaitAsync();
        try
        {
            // اسم ثابت مشتق من الرابط — إعادة التشغيل تستخدم الملف الموجود بدل تنزيل نسخة جديدة
            var ext = Path.GetExtension(new Uri(url).AbsolutePath);
            var hash = Convert.ToHexString(System.Security.Cryptography.SHA1.HashData(System.Text.Encoding.UTF8.GetBytes(url)))[..16].ToLowerInvariant();
            var name = $"demo-{hash}{(string.IsNullOrEmpty(ext) ? ".webp" : ext)}";
            var path = Path.Combine(productsDir, name);
            if (!File.Exists(path))
                await File.WriteAllBytesAsync(path, await http.GetByteArrayAsync(url));
            lock (imageMap) imageMap[url] = $"/uploads/products/{name}";
        }
        catch { Interlocked.Increment(ref failed); }
        finally { gate.Release(); }
    }));
    Console.WriteLine($"  {imageMap.Count} صورة ({failed} فشل)");
}

await using var tx = await db.Database.BeginTransactionAsync();
var passwordHash = BCrypt.Net.BCrypt.HashPassword(DemoPassword);
var usedPhones = (await db.Users.Select(u => u.Phone).Where(p => p != null).ToListAsync()).ToHashSet();
string NewPhone()
{
    string phone;
    do phone = $"+9647{new[] { "7", "8", "5" }[rnd.Next(3)]}{rnd.Next(10000000, 99999999)}";
    while (!usedPhones.Add(phone));
    return phone;
}
User NewUser(string fullName, string email, string role, DateTime createdAt) => new()
{
    FullName = fullName, Email = email, Phone = NewPhone(), PasswordHash = passwordHash,
    HasPassword = true, Role = role, IsActive = true, CreatedAt = createdAt, UpdatedAt = createdAt,
};

// ---------- 2) الفئات ----------
Console.WriteLine("الفئات...");
var allCategories = await db.Categories.ToListAsync();
Category EnsureCategory(string name, string nameAr, Category? parent, int order)
{
    var existing = allCategories.FirstOrDefault(c => c.Name == name || c.NameAr == nameAr);
    if (existing != null) { existing.IsActive = true; return existing; }
    var created = new Category
    {
        Name = name, NameAr = nameAr, Description = nameAr, IconUrl = "", ParentId = parent?.Id,
        DisplayOrder = order, IsActive = true, CreatedAt = nowUtc.AddDays(-70), UpdatedAt = nowUtc.AddDays(-70),
    };
    db.Categories.Add(created);
    allCategories.Add(created);
    return created;
}
Category Root(string name) => allCategories.First(c => c.Name == name && c.ParentId == null);
var beautyRoot = EnsureCategory("Beauty & Care", "الجمال والعناية", null, 2);
var categoryMap = new Dictionary<string, Category>
{
    ["phones"] = EnsureCategory("Smartphones", "الهواتف الذكية", Root("Electronics"), 1),
    ["laptops"] = EnsureCategory("Laptops", "الحواسيب المحمولة", Root("Electronics"), 2),
    ["tablets"] = EnsureCategory("Tablets", "الأجهزة اللوحية", Root("Electronics"), 3),
    ["mobile-acc"] = EnsureCategory("Mobile Accessories", "إكسسوارات الهواتف", Root("Electronics"), 4),
    ["mens-clothing"] = EnsureCategory("Men's Clothing", "ملابس رجالية", Root("Fashion"), 1),
    ["womens-clothing"] = EnsureCategory("Women's Clothing", "ملابس نسائية", Root("Fashion"), 2),
    ["shoes"] = EnsureCategory("Shoes", "أحذية", Root("Fashion"), 3),
    ["bags"] = EnsureCategory("Bags", "حقائب", Root("Fashion"), 4),
    ["watches"] = EnsureCategory("Watches", "ساعات", Root("Fashion"), 5),
    ["accessories"] = EnsureCategory("Jewelry & Sunglasses", "مجوهرات ونظارات", Root("Fashion"), 6),
    ["makeup"] = EnsureCategory("Makeup", "مكياج", beautyRoot, 1),
    ["perfumes"] = EnsureCategory("Perfumes", "عطور", beautyRoot, 2),
    ["skincare"] = EnsureCategory("Skin & Body Care", "العناية بالبشرة والجسم", beautyRoot, 3),
    ["kitchen"] = EnsureCategory("Kitchen Tools", "أدوات المطبخ", Root("Home"), 1),
    ["furniture"] = EnsureCategory("Furniture", "أثاث", Root("Home"), 2),
    ["decor"] = EnsureCategory("Home Decor", "ديكور منزلي", Root("Home"), 3),
    ["fruits-veg"] = EnsureCategory("Fruits & Vegetables", "خضار وفواكه", Root("Supermarket"), 1),
    ["meat"] = EnsureCategory("Meat & Fish", "لحوم وأسماك", Root("Supermarket"), 2),
    ["dairy"] = EnsureCategory("Dairy & Eggs", "ألبان وبيض", Root("Supermarket"), 3),
    ["drinks"] = EnsureCategory("Beverages", "مشروبات", Root("Supermarket"), 4),
    ["pantry"] = EnsureCategory("Pantry", "مواد غذائية", Root("Supermarket"), 5),
    ["household"] = EnsureCategory("Household Paper", "مناديل ومستلزمات", Root("Supermarket"), 6),
    ["pet-food"] = allCategories.First(c => c.Name == "Pet Food"),
    ["sports-gear"] = EnsureCategory("Sports Equipment", "معدات رياضية", Root("Sports"), 1),
};
foreach (var c in categoryMap.Values) for (var p = c; p?.ParentId != null; p = allCategories.FirstOrDefault(x => x.Id == p.ParentId)) p.IsActive = true;
foreach (var r in new[] { "Electronics", "Fashion", "Home", "Supermarket", "Pets", "Sports" }) Root(r).IsActive = true;
await db.SaveChangesAsync();

// ---------- 3) المتاجر ----------
Console.WriteLine("المتاجر...");
var existingVendors = await db.Vendors.ToListAsync();
var vendors = new Dictionary<string, Vendor>
{
    ["elite"] = existingVendors.First(v => v.Name == "Elite Electronics"),
    ["fashion"] = existingVendors.First(v => v.Name == "City Fashion"),
    ["home"] = existingVendors.First(v => v.Name == "Home Essentials"),
    ["mart"] = existingVendors.First(v => v.Name == "Al-Rafidain Mart"),
};
var newStores = new[]
{
    ("beauty", "Beauty House", "دار الجمال للعطور والتجميل", "عطور أصلية ومستحضرات تجميل وعناية بالبشرة من أشهر الماركات.", "بغداد - الكرادة داخل", 3000m, 10000m, 25, "زينب حسن الجبوري", "#be185d", "د"),
    ("shoes", "Shoes & Sports World", "عالم الأحذية والرياضة", "أحذية رياضية وكلاسيكية للرجال والنساء ومعدات رياضية لكل الألعاب.", "بغداد - المنصور، شارع 14 رمضان", 3500m, 15000m, 30, "مصطفى كريم العبيدي", "#1d4ed8", "ع"),
    ("watches", "Watches & Accessories Corner", "ركن الساعات والإكسسوارات", "ساعات فاخرة وعصرية، حقائب، نظارات شمسية ومجوهرات.", "بغداد - زيونة، شارع الربيعي", 4000m, 20000m, 30, "علي حيدر الموسوي", "#a16207", "ر"),
    ("decor", "Decor & Furniture House", "بيت الديكور والأثاث", "أثاث منزلي ومكتبي وقطع ديكور تضيف لمسة جمال لبيتك.", "بغداد - اليرموك", 7000m, 25000m, 90, "نور الهدى عباس", "#15803d", "ب"),
};
var vendorsDir = Path.Combine(wwwroot, "uploads", "vendors");
Directory.CreateDirectory(Path.Combine(vendorsDir, "covers"));
foreach (var (key, name, nameAr, desc, address, fee, min, prep, owner, color, letter) in newStores)
{
    var created = nowUtc.AddDays(-65 + rnd.Next(5));
    var ownerUser = NewUser(owner, $"vendor.{key}{DemoDomain}", "VENDOR", created);
    db.Users.Add(ownerUser);

    var logoFile = $"{key}-logo.svg";
    await File.WriteAllTextAsync(Path.Combine(vendorsDir, logoFile),
        $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\"><rect width=\"256\" height=\"256\" rx=\"56\" fill=\"{color}\"/><text x=\"128\" y=\"170\" font-size=\"140\" font-family=\"Tahoma, Arial, sans-serif\" font-weight=\"700\" fill=\"#fff\" text-anchor=\"middle\">{letter}</text></svg>");

    // الغلاف: نسخة من صورة أول منتج في المتجر
    string? cover = null;
    var firstImage = products.Where(p => p.Store == key).SelectMany(p => p.Images).FirstOrDefault(imageMap.ContainsKey);
    if (firstImage != null)
    {
        var coverName = $"demo-{key}-cover{Path.GetExtension(imageMap[firstImage])}";
        File.Copy(Path.Combine(wwwroot, imageMap[firstImage].TrimStart('/').Replace('/', Path.DirectorySeparatorChar)),
                  Path.Combine(vendorsDir, "covers", coverName), overwrite: true);
        cover = $"/uploads/vendors/covers/{coverName}";
    }

    var vendor = new Vendor
    {
        Name = name, NameAr = nameAr, Description = desc, LogoUrl = $"/uploads/vendors/{logoFile}", CoverImageUrl = cover!,
        Phone = ownerUser.Phone!, Address = address, IsActive = true, MinOrderAmount = min, DeliveryFee = fee,
        EstimatedPrepTime = prep, OwnerId = ownerUser.Id, CreatedAt = created, UpdatedAt = created,
    };
    db.Vendors.Add(vendor);
    vendors[key] = vendor;
}
await db.SaveChangesAsync();
var ownerOf = vendors.Values.ToDictionary(v => v.Id, v => v.OwnerId);

// ---------- 4) حذف المنتجات التجريبية القديمة (حذف ناعم — الطلبات القديمة تبقى سليمة) ----------
Console.WriteLine("حذف المنتجات القديمة...");
var oldProducts = await db.Products.Where(p => !p.IsDeleted).ToListAsync();
var oldIds = oldProducts.Select(p => p.Id).ToList();
foreach (var p in oldProducts) { p.IsDeleted = true; p.IsActive = false; p.DeletedAt = nowUtc; }
db.CartItems.RemoveRange(await db.CartItems.Where(c => oldIds.Contains(c.ProductId)).ToListAsync());
db.Wishlists.RemoveRange(await db.Wishlists.Where(w => oldIds.Contains(w.ProductId)).ToListAsync());
db.HomeSectionItems.RemoveRange(await db.HomeSectionItems.Where(i => oldIds.Contains(i.EntityId)).ToListAsync());
await db.SaveChangesAsync();
Console.WriteLine($"  {oldProducts.Count} منتج قديم");

// ---------- 5) المنتجات والصور والمتغيرات ----------
Console.WriteLine("المنتجات...");
var created_ = new List<(Product Product, SeedProduct Seed, List<ProductVariant> Variants)>();
var skuCounters = new Dictionary<string, int>();
foreach (var seed in products)
{
    var vendor = vendors[seed.Store];
    var createdAt = vendor.CreatedAt.AddDays(rnd.NextDouble() * 5).AddHours(rnd.Next(24));
    if (createdAt > nowUtc.AddDays(-3)) createdAt = nowUtc.AddDays(-3);
    skuCounters[seed.Store] = skuCounters.GetValueOrDefault(seed.Store) + 1;

    var roll = rnd.NextDouble();
    var stock = roll < 0.08 ? 0 : roll < 0.20 ? rnd.Next(1, StockThresholds.LowStock) : rnd.Next(10, 81);
    decimal? original = rnd.NextDouble() < 0.22 ? RoundIqd(seed.Price * (decimal)(1.15 + rnd.NextDouble() * 0.25)) : null;

    var product = new Product
    {
        VendorId = vendor.Id, CategoryId = categoryMap[seed.Category].Id,
        Name = seed.Name, NameAr = seed.NameAr, Description = seed.DescriptionAr,
        Price = seed.Price, OriginalPrice = original,
        Sku = $"{seed.Store[..3].ToUpperInvariant()}-{skuCounters[seed.Store]:D4}",
        StockQuantity = stock, IsAvailable = stock > 0, IsActive = true,
        CreatedAt = createdAt, UpdatedAt = createdAt,
    };
    db.Products.Add(product);

    var order = 0;
    foreach (var url in seed.Images.Where(imageMap.ContainsKey))
        db.ProductImages.Add(new ProductImage { ProductId = product.Id, ImageUrl = imageMap[url], IsPrimary = order == 0, DisplayOrder = order++, CreatedAt = createdAt });

    var variants = new List<ProductVariant>();
    if (seed.Variants != null)
    {
        var attribute = new ProductAttribute { ProductId = product.Id, Name = seed.Variants.Name, NameAr = seed.Variants.NameAr, CreatedAt = createdAt };
        db.ProductAttributes.Add(attribute);
        var i = 0;
        foreach (var v in seed.Variants.Values)
        {
            var value = new ProductAttributeValue { AttributeId = attribute.Id, Value = v[0].GetString()!, ValueAr = v[1].GetString(), DisplayOrder = i };
            db.ProductAttributeValues.Add(value);
            var vStock = rnd.NextDouble() < 0.15 ? 0 : rnd.Next(1, 16);
            var variant = new ProductVariant
            {
                ProductId = product.Id, Sku = $"{product.Sku}-{v[0].GetString()!.Replace(" ", "")}",
                PriceAdjustment = v[2].GetDecimal(), StockQuantity = vStock, IsAvailable = true,
                DisplayOrder = i++, CreatedAt = createdAt, UpdatedAt = createdAt,
            };
            db.ProductVariants.Add(variant);
            db.ProductVariantAttributeValues.Add(new ProductVariantAttributeValue { VariantId = variant.Id, AttributeValueId = value.Id });
            variants.Add(variant);
        }
        product.StockQuantity = variants.Sum(v => v.StockQuantity);
        product.IsAvailable = true;
    }
    created_.Add((product, seed, variants));
}
// منتجات مخفية قليلة (لتجربة فلتر "مخفي" في لوحة البائع)
foreach (var (p, _, _) in created_.Where((_, i) => i % 45 == 7)) p.IsActive = false;
await db.SaveChangesAsync();
Console.WriteLine($"  {created_.Count} منتج، {created_.Sum(x => x.Variants.Count)} متغير");

// ---------- 6) العروض ----------
db.Promotions.AddRange(
    new Promotion { Name = "Beauty Week", NameAr = "أسبوع الجمال", Description = "خصم 10% على كل منتجات دار الجمال", TargetType = PromotionTargetType.VENDOR, TargetId = vendors["beauty"].Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 10, MaxDiscountAmount = 25000, IsActive = true, StartsAt = nowUtc.AddDays(-2), ExpiresAt = nowUtc.AddDays(12), CreatedAt = nowUtc.AddDays(-3), UpdatedAt = nowUtc.AddDays(-3) },
    new Promotion { Name = "Fresh Basket", NameAr = "سلة الخضار الطازجة", Description = "خصم 15% على الخضار والفواكه", TargetType = PromotionTargetType.CATEGORY, TargetId = categoryMap["fruits-veg"].Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 15, IsActive = true, StartsAt = nowUtc.AddDays(-5), ExpiresAt = nowUtc.AddDays(5), CreatedAt = nowUtc.AddDays(-6), UpdatedAt = nowUtc.AddDays(-6) },
    new Promotion { Name = "AirPods Deal", NameAr = "عرض الإيربودز", Description = "خصم 20 ألف دينار على سماعات إيربودز", TargetType = PromotionTargetType.PRODUCT, TargetId = created_.First(x => x.Seed.SourceId == 100).Product.Id, DiscountType = DiscountType.FIXED, DiscountValue = 20000, IsActive = true, StartsAt = nowUtc.AddDays(-1), ExpiresAt = nowUtc.AddDays(7), CreatedAt = nowUtc.AddDays(-1), UpdatedAt = nowUtc.AddDays(-1) },
    new Promotion { Name = "Back to School", NameAr = "العودة للمدارس", Description = "عرض منتهي — خصم 8% على الإلكترونيات", TargetType = PromotionTargetType.VENDOR, TargetId = vendors["elite"].Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 8, IsActive = true, StartsAt = nowUtc.AddDays(-40), ExpiresAt = nowUtc.AddDays(-25), CreatedAt = nowUtc.AddDays(-41), UpdatedAt = nowUtc.AddDays(-41) });
await db.SaveChangesAsync();

// ---------- 7) الزبائن والعناوين والسائقون ----------
Console.WriteLine("الزبائن والسائقون...");
string[] maleNames = { "أحمد", "علي", "حسين", "محمد", "عمر", "مصطفى", "حيدر", "يوسف", "كرار", "سجاد", "عباس", "مهدي", "ياسر" };
string[] femaleNames = { "فاطمة", "زينب", "مريم", "نور", "سارة", "هدى", "رقية", "آية", "دعاء", "شهد", "رنا", "بنين" };
string[] families = { "الجبوري", "العبيدي", "الموسوي", "الحسيني", "التميمي", "الربيعي", "الشمري", "الدليمي", "الكعبي", "الساعدي", "البياتي", "الخفاجي" };
(string Area, double Lat, double Lng)[] areas =
{
    ("المنصور", 33.3152, 44.3466), ("الكرادة", 33.3006, 44.4206), ("زيونة", 33.3247, 44.4497), ("الأعظمية", 33.3683, 44.3725),
    ("الجادرية", 33.2786, 44.3864), ("اليرموك", 33.3020, 44.3360), ("الكاظمية", 33.3797, 44.3410), ("حي الجامعة", 33.3110, 44.3260),
    ("البلديات", 33.3480, 44.4630), ("الدورة", 33.2553, 44.4000), ("العامرية", 33.2960, 44.2890), ("شارع فلسطين", 33.3460, 44.4300),
};
var customers = new List<(User User, Address Address)>();
for (var i = 1; i <= 28; i++)
{
    var female = i % 3 == 0;
    var fullName = $"{(female ? femaleNames : maleNames)[rnd.Next((female ? femaleNames : maleNames).Length)]} {maleNames[rnd.Next(maleNames.Length)]} {families[rnd.Next(families.Length)]}";
    var createdAt = nowUtc.AddDays(-62 + rnd.Next(0, 55)).AddHours(-rnd.Next(24));
    var user = NewUser(fullName, $"customer{i:D2}{DemoDomain}", "CUSTOMER", createdAt);
    db.Users.Add(user);
    var area = areas[rnd.Next(areas.Length)];
    var address = new Address
    {
        UserId = user.Id, Label = rnd.NextDouble() < 0.75 ? "البيت" : "العمل", StreetAddress = $"محلة {rnd.Next(601, 999)}، زقاق {rnd.Next(1, 60)}",
        Area = area.Area, City = "بغداد", BuildingNumber = rnd.Next(1, 120).ToString(), FloorNumber = "", ApartmentNumber = "",
        Phone = user.Phone!, Notes = "", IsDefault = true,
        Latitude = (decimal)(area.Lat + (rnd.NextDouble() - 0.5) * 0.02), Longitude = (decimal)(area.Lng + (rnd.NextDouble() - 0.5) * 0.02),
        CreatedAt = createdAt, UpdatedAt = createdAt,
    };
    db.Addresses.Add(address);
    customers.Add((user, address));
}

var drivers = await db.Drivers.Where(d => d.Status == DriverStatus.Active).ToListAsync();
foreach (var (name, area) in new[] { ("حسن جاسم", "الكرخ"), ("ليث عدنان", "الرصافة"), ("أمير صلاح", "الكرادة والجادرية") })
{
    var createdAt = nowUtc.AddDays(-63);
    var user = NewUser(name, $"driver.{drivers.Count + 1}{DemoDomain}", "DRIVER", createdAt);
    db.Users.Add(user);
    var driver = new Driver
    {
        FullName = name, Phone = user.Phone!, Email = user.Email, VehicleType = "motorcycle", WorkArea = area,
        Status = DriverStatus.Active, WorkStatus = DriverWorkStatus.Available, UserId = user.Id, CreatedAt = createdAt, UpdatedAt = createdAt,
    };
    db.Drivers.Add(driver);
    drivers.Add(driver);
}
await db.SaveChangesAsync();
var opsUserId = await db.Users.Where(u => u.Role == "OPS").Select(u => (Guid?)u.Id).FirstOrDefaultAsync();

// ---------- 8) الطلبات (آخر 60 يوماً + طلبات جارية اليوم) ----------
Console.WriteLine("الطلبات...");
var sellable = created_.Where(x => x.Product.IsActive).GroupBy(x => x.Seed.Store).ToDictionary(g => g.Key, g => g.ToList());
var storeWeights = new (string Key, int Weight)[] { ("mart", 30), ("elite", 18), ("fashion", 14), ("beauty", 12), ("shoes", 10), ("home", 8), ("watches", 5), ("decor", 3) };
string PickStore(string? except = null)
{
    var pool = storeWeights.Where(s => s.Key != except).ToList();
    var r = rnd.Next(pool.Sum(s => s.Weight));
    foreach (var s in pool) { if (r < s.Weight) return s.Key; r -= s.Weight; }
    return pool[0].Key;
}
var sequences = new Dictionary<string, int>();
foreach (var number in await db.Orders.Where(o => o.OrderNumber.StartsWith("ORD-")).Select(o => o.OrderNumber).ToListAsync())
{
    var parts = number.Split('-');
    if (parts.Length == 3 && int.TryParse(parts[2], out var seq)) sequences[parts[1]] = Math.Max(sequences.GetValueOrDefault(parts[1]), seq);
}
string NextOrderNumber(DateTime at)
{
    var day = at.ToString("yyyyMMdd");
    sequences[day] = sequences.GetValueOrDefault(day) + 1;
    return $"ORD-{day}-{sequences[day]:D4}";
}
// زبائن متكررون: بعضهم يطلب أكثر بكثير من غيره
var customerWeights = customers.Select((c, i) => (c, Weight: i < 6 ? 6 : i < 14 ? 3 : 1)).ToList();
(User User, Address Address) PickCustomer(DateTime at)
{
    var pool = customerWeights.Where(c => c.c.User.CreatedAt < at).ToList();
    if (pool.Count == 0) pool = customerWeights;
    var r = rnd.Next(pool.Sum(c => c.Weight));
    foreach (var c in pool) { if (r < c.Weight) return c.c; r -= c.Weight; }
    return pool[0].c;
}

var allOrders = new List<Order>();
var deliveredSubs = new List<(SubOrder Sub, DateTime DeliveredAt)>();
var logs = new List<OrderStatusLog>();
void Log(Guid? orderId, Guid? subId, string from, string to, Guid? by, string reason, DateTime at) =>
    logs.Add(new OrderStatusLog { OrderId = orderId, SubOrderId = subId, OldStatus = from, NewStatus = to, ChangedBy = by, Reason = reason, CreatedAt = at });

void CreateOrder(DateTime createdAt, string finalStatus)
{
    var (customer, address) = PickCustomer(createdAt);
    var storeKeys = new List<string> { PickStore() };
    if (rnd.NextDouble() < 0.15) storeKeys.Add(PickStore(storeKeys[0]));

    var order = new Order
    {
        OrderNumber = NextOrderNumber(createdAt), CustomerId = customer.Id, AddressId = address.Id,
        PaymentMethod = PaymentMethods.COD, PaymentStatus = PaymentStatus.Pending, CustomerNotes = rnd.NextDouble() < 0.2 ? "يرجى الاتصال قبل الوصول" : "",
        DeliveryLatitude = address.Latitude, DeliveryLongitude = address.Longitude, CreatedAt = createdAt, UpdatedAt = createdAt,
    };
    var driver = drivers[rnd.Next(drivers.Count)];
    var subs = new List<SubOrder>();
    var index = 1;
    foreach (var key in storeKeys)
    {
        var vendor = vendors[key];
        var sub = new SubOrder { OrderId = order.Id, VendorId = vendor.Id, SubOrderNumber = $"{order.OrderNumber}-V{index++}", DeliveryFee = vendor.DeliveryFee, CreatedAt = createdAt, UpdatedAt = createdAt };
        var picks = sellable[key].OrderBy(_ => rnd.Next()).Take(rnd.Next(1, key == "mart" ? 5 : 3)).ToList();
        var items = new List<SubOrderItem>();
        foreach (var (product, _, variants) in picks)
        {
            var variant = variants.Count > 0 ? variants[rnd.Next(variants.Count)] : null;
            var unit = product.Price + (variant?.PriceAdjustment ?? 0);
            var qty = key == "mart" ? rnd.Next(1, 4) : 1;
            items.Add(new SubOrderItem
            {
                SubOrderId = sub.Id, ProductId = product.Id, VariantId = variant?.Id, ProductName = product.Name, ProductNameAr = product.NameAr,
                ProductImageUrl = db.ProductImages.Local.FirstOrDefault(i => i.ProductId == product.Id && i.IsPrimary)?.ImageUrl ?? "",
                UnitPrice = unit, Quantity = qty, Subtotal = unit * qty,
            });
        }
        // الحد الأدنى للطلب: نزيد كمية أول قطعة حتى نتجاوزه
        while (items.Sum(i => i.Subtotal) < vendor.MinOrderAmount) { items[0].Quantity++; items[0].Subtotal = items[0].UnitPrice * items[0].Quantity; }
        sub.Subtotal = items.Sum(i => i.Subtotal);
        db.SubOrderItems.AddRange(items);
        subs.Add(sub);
    }
    order.Subtotal = subs.Sum(s => s.Subtotal);
    order.DeliveryFees = subs.Sum(s => s.DeliveryFee);
    order.TotalAmount = order.Subtotal + order.DeliveryFees;

    // التسلسل الزمني للحالات
    var t = createdAt;
    Log(order.Id, null, "", OrderStatus.PENDING_CONFIRMATION, customer.Id, "إنشاء طلب جديد", t);
    foreach (var s in subs) { s.Status = SubOrderStatus.PendingConfirmation; s.ConfirmationDeadline = t.AddMinutes(5); Log(null, s.Id, "", s.Status, customer.Id, "إنشاء طلب فرعي", t); }

    string[] flow = { OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED };
    var target = finalStatus == OrderStatus.CANCELLED ? -1 : Array.IndexOf(flow, finalStatus);
    var status = OrderStatus.PENDING_CONFIRMATION;

    if (finalStatus == OrderStatus.CANCELLED)
    {
        var byVendor = rnd.NextDouble() < 0.6;
        var reason = byVendor ? "نفاد الكمية من المتجر" : "ألغى الزبون الطلب";
        t = t.AddMinutes(rnd.Next(2, 20));
        foreach (var s in subs)
        {
            s.Status = SubOrderStatus.Cancelled; s.CancellationReason = reason; s.CancelledAt = t;
            s.CancelledBy = byVendor ? ownerOf[s.VendorId] : customer.Id; s.UpdatedAt = t;
            Log(null, s.Id, SubOrderStatus.PendingConfirmation, SubOrderStatus.Cancelled, s.CancelledBy, reason, t);
        }
        order.Status = OrderStatus.CANCELLED; order.CancellationReason = reason; order.UpdatedAt = t;
        Log(order.Id, null, status, OrderStatus.CANCELLED, subs[0].CancelledBy, reason, t);
    }
    else
    {
        for (var step = 0; step <= target; step++)
        {
            var next = flow[step];
            t = t.AddMinutes(next switch
            {
                OrderStatus.CONFIRMED => rnd.Next(1, 8),
                OrderStatus.PREPARING => rnd.Next(1, 4),
                OrderStatus.READY => rnd.Next(12, 50),
                OrderStatus.OUT_FOR_DELIVERY => rnd.Next(5, 20),
                _ => rnd.Next(15, 45),
            });
            foreach (var s in subs)
            {
                var by = next is OrderStatus.OUT_FOR_DELIVERY or OrderStatus.DELIVERED ? driver.UserId : ownerOf[s.VendorId];
                if (next == OrderStatus.CONFIRMED) { s.ConfirmedAt = t; s.ConfirmedBy = ownerOf[s.VendorId]; }
                if (next == OrderStatus.OUT_FOR_DELIVERY) { s.DriverId = driver.Id; s.AssignedAt = t.AddMinutes(-rnd.Next(3, 10)); s.PickedUpAt = t; }
                Log(null, s.Id, s.Status, next, by, next == OrderStatus.DELIVERED ? "تم التسليم للزبون" : "تحديث حالة الطلب", t);
                s.Status = next; s.UpdatedAt = t;
            }
            Log(order.Id, null, status, next, next is OrderStatus.OUT_FOR_DELIVERY or OrderStatus.DELIVERED ? driver.UserId : ownerOf[subs[0].VendorId], "تحديث حالة الطلب", t);
            status = next;
        }
        order.Status = status; order.UpdatedAt = t;
        if (status == OrderStatus.DELIVERED)
        {
            order.PaymentStatus = PaymentStatus.Paid;
            order.CashCollectedAmount = order.TotalAmount; order.CashCollectedAt = t; order.CashCollectedByDriverId = driver.Id;
            if (t < nowUtc.AddDays(-2)) { order.CashSettledAt = t.AddDays(1).Date.AddHours(9); order.CashSettledBy = opsUserId; }
            foreach (var s in subs) deliveredSubs.Add((s, t));
        }
        if (status == OrderStatus.OUT_FOR_DELIVERY) driver.WorkStatus = DriverWorkStatus.Delivering;
    }

    db.Orders.Add(order);
    db.SubOrders.AddRange(subs);
    allOrders.Add(order);
}

// التاريخ: الطلبات تزيد تدريجياً كأن المنصة تنمو (توقيت بغداد = UTC+3، ذروة المساء)
for (var daysAgo = 60; daysAgo >= 1; daysAgo--)
{
    var count = (int)Math.Round(1 + 4.0 * (60 - daysAgo) / 60 + rnd.NextDouble() * 2);
    for (var k = 0; k < count; k++)
    {
        var hourLocal = rnd.NextDouble() < 0.55 ? rnd.Next(17, 23) : rnd.Next(9, 17);
        var at = nowUtc.Date.AddDays(-daysAgo).AddHours(hourLocal - 3).AddMinutes(rnd.Next(60));
        CreateOrder(at, rnd.NextDouble() < 0.9 ? OrderStatus.DELIVERED : OrderStatus.CANCELLED);
    }
}
// اليوم: طلبات مكتملة صباحاً + طلبات جارية بحالات مختلفة للوحة العمليات
foreach (var (minutesAgo, status) in new[]
{
    (400, OrderStatus.DELIVERED), (330, OrderStatus.DELIVERED), (250, OrderStatus.DELIVERED),
    (95, OrderStatus.OUT_FOR_DELIVERY), (80, OrderStatus.OUT_FOR_DELIVERY), (60, OrderStatus.READY),
    (45, OrderStatus.PREPARING), (30, OrderStatus.PREPARING), (15, OrderStatus.CONFIRMED),
    (3, OrderStatus.PENDING_CONFIRMATION), (1, OrderStatus.PENDING_CONFIRMATION),
})
    CreateOrder(nowUtc.AddMinutes(-minutesAgo), status);

db.OrderStatusLogs.AddRange(logs);
await db.SaveChangesAsync();
Console.WriteLine($"  {allOrders.Count} طلب ({allOrders.Count(o => o.Status == OrderStatus.DELIVERED)} مُسلَّم، {allOrders.Count(o => o.Status == OrderStatus.CANCELLED)} ملغي)");

// ---------- 9) القيود المالية للمتاجر (نفس منطق النظام) بتاريخ التسليم ----------
Console.WriteLine("القيود المالية...");
var finance = new FinanceService(db);
foreach (var (sub, deliveredAt) in deliveredSubs)
{
    await finance.EnsureSubOrderEntriesAsync(sub.Id);
    // البيع لحظة التسليم والعمولة بعده بثانية (كما يحدث فعلياً) — حتى لا تتساوى أوقاتهما
    await db.VendorLedgerEntries.Where(e => e.SubOrderId == sub.Id && e.Type == LedgerType.Sale)
        .ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, deliveredAt));
    await db.VendorLedgerEntries.Where(e => e.SubOrderId == sub.Id && e.Type != LedgerType.Sale)
        .ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, deliveredAt.AddSeconds(1)));
}

// ---------- 10) التقييمات ----------
Console.WriteLine("التقييمات...");
var reviewBodies = new Dictionary<int, string[]>
{
    [5] = new[] { "منتج ممتاز وأصلي، والتوصيل كان سريع جداً. أنصح فيه.", "جودة عالية ومطابق للصور تماماً، شكراً للمتجر.", "أفضل شراء سويته هالشهر، التغليف ممتاز.", "رائع جداً وسعره مناسب مقارنة بالسوق.", "وصلني بنفس اليوم وبحالة ممتازة." },
    [4] = new[] { "منتج جيد جداً، بس التوصيل تأخر شوية.", "الجودة حلوة وسعره معقول.", "جيد ومطابق للوصف، أتمنى يكون التغليف أفضل.", "تجربة جيدة بشكل عام وراح أطلب مرة ثانية." },
    [3] = new[] { "مقبول، توقعت جودة أفضل بهالسعر.", "المنتج عادي، مو سيء بس مو ممتاز.", "اللون مختلف شوية عن الصورة." },
    [2] = new[] { "المقاس ما كان مضبوط وصار تأخير بالتوصيل.", "الجودة أقل من المتوقع." },
    [1] = new[] { "وصل المنتج متضرر، أتمنى المتجر يعالج المشكلة." },
};
int PickRating() { var r = rnd.NextDouble(); return r < 0.46 ? 5 : r < 0.80 ? 4 : r < 0.92 ? 3 : r < 0.97 ? 2 : 1; }
var reviewed = new HashSet<(Guid, Guid)>();
var deliveredOrders = allOrders.Where(o => o.Status == OrderStatus.DELIVERED && o.CashCollectedAt < nowUtc.AddDays(-1)).ToList();
var reviewCount = 0;
foreach (var order in deliveredOrders)
{
    var subs = db.SubOrders.Local.Where(s => s.OrderId == order.Id).ToList();
    foreach (var item in db.SubOrderItems.Local.Where(i => subs.Any(s => s.Id == i.SubOrderId)))
    {
        if (rnd.NextDouble() > 0.4 || !reviewed.Add((order.CustomerId, item.ProductId))) continue;
        var rating = PickRating();
        var at = order.CashCollectedAt!.Value.AddDays(rnd.NextDouble() * 4);
        if (at > nowUtc) at = nowUtc.AddMinutes(-rnd.Next(5, 600));
        var reply = rating <= 3 && rnd.NextDouble() < 0.6 ? "نعتذر عن الإزعاج، تواصلنا معك لحل المشكلة. شكراً لملاحظتك."
                  : rating == 5 && rnd.NextDouble() < 0.2 ? "شكراً لثقتك بنا، نتمنى نشوفك مرة ثانية!" : null;
        db.Reviews.Add(new Review
        {
            ProductId = item.ProductId, UserId = order.CustomerId, OrderId = order.Id, Rating = rating,
            Body = reviewBodies[rating][rnd.Next(reviewBodies[rating].Length)], IsVerifiedPurchase = true, IsApproved = true,
            VendorReply = reply, VendorReplyAt = reply != null ? at.AddHours(rnd.Next(1, 20)) : null, CreatedAt = at,
        });
        reviewCount++;
    }

    // تقييم الطلب: المتجر والسائق والتوصيل
    if (rnd.NextDouble() < 0.35)
    {
        var at = order.CashCollectedAt!.Value.AddHours(rnd.Next(1, 30));
        if (at > nowUtc) at = nowUtc;
        var rating = new OrderRating
        {
            OrderId = order.Id, CustomerId = order.CustomerId, DeliveryRating = rnd.Next(3, 6), SpeedRating = rnd.Next(3, 6),
            PackagingRating = rnd.Next(3, 6), WouldRecommend = rnd.NextDouble() < 0.85, CreatedAt = at, UpdatedAt = at,
        };
        db.OrderRatings.Add(rating);
        foreach (var s in subs)
            db.SubOrderRatings.Add(new SubOrderRating { OrderRatingId = rating.Id, SubOrderId = s.Id, VendorId = s.VendorId, VendorRating = PickRating() >= 3 ? rnd.Next(4, 6) : rnd.Next(2, 4) });
        if (subs[0].DriverId is Guid driverId)
            db.OrderDriverRatings.Add(new OrderDriverRating { OrderRatingId = rating.Id, DriverId = driverId, Rating = rnd.Next(3, 6), CreatedAt = at });
    }
}
await db.SaveChangesAsync();

// إحصائيات السائقين: عدد التسليمات ومتوسط التقييم
foreach (var driver in drivers)
{
    driver.TotalDeliveries = await db.SubOrders.CountAsync(s => s.DriverId == driver.Id && s.Status == OrderStatus.DELIVERED);
    var ratings = await db.OrderDriverRatings.Where(r => r.DriverId == driver.Id).Select(r => r.Rating).ToListAsync();
    driver.Rating = ratings.Count > 0 ? Math.Round((decimal)ratings.Average(), 1) : 0;
}

// ---------- 11) الصفحة الرئيسية ----------
// أقسام المحاكاة فقط (بعناوينها الخاصة) — أقسام الأدمن الموجودة مثل "حيوانات أليفة" لا يُغيَّر محتواها
await db.SaveChangesAsync();
await HomeSectionsSeeder.SeedAsync(db, wwwroot);
await tx.CommitAsync();

Console.WriteLine();
Console.WriteLine("تم ✔");
Console.WriteLine($"  متاجر: {vendors.Count} | منتجات: {created_.Count} | زبائن جدد: {customers.Count} | سائقون: {drivers.Count}");
Console.WriteLine($"  طلبات: {allOrders.Count} | تقييمات منتجات: {reviewCount}");
Console.WriteLine($"  كلمة مرور حسابات المحاكاة (*{DemoDomain}): {DemoPassword}");
return 0;

static decimal RoundIqd(decimal v)
{
    var step = v < 10000 ? 250m : v < 100000 ? 1000m : 5000m;
    return Math.Max(step, Math.Round(v / step) * step);
}

record SeedVariants(string Name, string NameAr, List<List<JsonElement>> Values);
record SeedProduct(int SourceId, string Store, string Category, string Name, string NameAr, string DescriptionAr,
    string? Brand, decimal Price, List<string> Images, SeedVariants? Variants);
