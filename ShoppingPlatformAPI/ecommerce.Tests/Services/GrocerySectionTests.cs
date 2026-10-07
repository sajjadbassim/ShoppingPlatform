using System.Text.Json;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.HomePage;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.HomeService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // فصل السوبرماركت: منتجات فئة مُعلَّمة (وفئاتها الفرعية) لا تظهر في الرئيسية والبحث العام، ولها صفحتها
    public class GrocerySectionTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Vendor _store;
        private readonly Category _grocery;
        private readonly Category _dairy;
        private readonly Category _electronics;
        private readonly Product _milk;
        private readonly Product _phone;
        private readonly Product _uncategorized;

        public GrocerySectionTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            // متجر واحد يبيع النوعين — الفصل بالفئة لا بالمتجر
            _store = new Vendor { Name = "mart", NameAr = "ماركت", OwnerId = Guid.NewGuid(), IsActive = true };
            _grocery = new Category { Name = "Supermarket", NameAr = "سوبرماركت", IsGrocery = true };
            _dairy = new Category { Name = "Dairy", NameAr = "ألبان", ParentId = _grocery.Id };
            _electronics = new Category { Name = "Electronics", NameAr = "إلكترونيات" };
            _milk = NewProduct("milk", "حليب", _dairy.Id);
            _phone = NewProduct("phone", "هاتف حليبي", _electronics.Id);
            _uncategorized = NewProduct("misc", "متفرقات", null);

            _context.AddRange(_store, _grocery, _dairy, _electronics, _milk, _phone, _uncategorized);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private Product NewProduct(string name, string nameAr, Guid? categoryId) => new()
        {
            VendorId = _store.Id, CategoryId = categoryId, Name = name, NameAr = nameAr, Price = 1000, StockQuantity = 5
        };

        private HomeService Home() => new(_context, new Mock<IFileService>().Object);

        private static List<Guid> Ids(object? data) =>
            JsonSerializer.Deserialize<List<JsonElement>>(JsonSerializer.Serialize(data))!
                .Select(p => p.GetProperty("Id").GetGuid()).ToList();

        [Fact]
        public void GroceryFlag_IsInheritedBySubcategories()
        {
            var tree = _context.Categories.Select(c => new CategoryVisibility.CategoryNode(c.Id, c.ParentId, c.IsActive, c.IsGrocery)).ToList();

            var grocery = CategoryVisibility.ComputeGrocery(tree);

            Assert.Equal(new[] { _dairy.Id, _grocery.Id }.OrderBy(x => x), grocery.OrderBy(x => x));
        }

        [Fact]
        public async Task ProductFilter_ScopeSeparatesGroceryFromGeneral()
        {
            var repo = new ProductRepository(_context);

            var grocery = (await repo.GetAdvancedFilteredAsync(scope: ShopScope.Grocery)).Items.Select(p => p.Id);
            var general = (await repo.GetAdvancedFilteredAsync(scope: ShopScope.General)).Items.Select(p => p.Id).ToList();
            var all = await repo.GetAdvancedFilteredAsync();

            Assert.Equal(new[] { _milk.Id }, grocery);
            Assert.Equal(new[] { _phone.Id, _uncategorized.Id }.OrderBy(x => x), general.OrderBy(x => x));
            Assert.Equal(3, all.TotalCount); // بدون scope (الإدارة والتاجر) يبقى كل شيء
        }

        [Fact]
        public async Task UnifiedSearch_RespectsScope()
        {
            var repo = new ProductRepository(_context);

            // «حليب» يطابق الحليب (سوبرماركت) و«هاتف حليبي» (عام)
            var general = await repo.UnifiedSearchAsync("حليب", 10, ShopScope.General);
            var grocery = await repo.UnifiedSearchAsync("حليب", 10, ShopScope.Grocery);

            Assert.Equal(_phone.Id, Assert.Single(general.Products).Id);
            Assert.Equal(_milk.Id, Assert.Single(grocery.Products).Id);
        }

        [Fact]
        public async Task HomePage_GeneralAndGroceryPagesShowOnlyTheirProducts()
        {
            var generalSection = new HomeSection { Type = "featured_products", Title = "all", MaxItems = 10 };
            var grocerySection = new HomeSection { Type = "featured_products", Title = "mart", MaxItems = 10, Page = ShopScope.Grocery };
            // قسم يدوي في الرئيسية اختير فيه منتج سوبرماركت بالخطأ — لا يظهر
            var custom = new HomeSection { Type = "custom_products", Title = "picks", MaxItems = 10 };
            _context.AddRange(generalSection, grocerySection, custom,
                new HomeSectionItem { SectionId = custom.Id, EntityId = _milk.Id },
                new HomeSectionItem { SectionId = custom.Id, EntityId = _phone.Id, DisplayOrder = 1 },
                new Banner { Title = "hero", ImageUrl = "/h.png" },
                new Banner { Title = "mart hero", ImageUrl = "/m.png", Page = ShopScope.Grocery });
            await _context.SaveChangesAsync();

            var home = await Home().GetHomePageAsync();
            var mart = await Home().GetHomePageAsync(ShopScope.Grocery);

            Assert.Equal(new[] { "hero" }, home.Banners.Select(b => b.Title));
            Assert.DoesNotContain(home.Sections, s => s.Id == grocerySection.Id);
            Assert.DoesNotContain(_milk.Id, Ids(home.Sections.Single(s => s.Id == generalSection.Id).Data));
            Assert.Equal(new[] { _phone.Id }, Ids(home.Sections.Single(s => s.Id == custom.Id).Data));

            Assert.Equal(new[] { "mart hero" }, mart.Banners.Select(b => b.Title));
            Assert.Equal(new[] { _milk.Id }, Ids(Assert.Single(mart.Sections).Data));
        }

        [Fact]
        public async Task MovingSectionToGroceryPage_MovesItsBlockBanners()
        {
            var block = new HomeSection { Type = "banners", Title = "block" };
            var banner = new Banner { Title = "b", ImageUrl = "/b.png", SectionId = block.Id };
            _context.AddRange(block, banner);
            await _context.SaveChangesAsync();

            var updated = await Home().UpdateSectionAsync(block.Id, new UpdateHomeSectionDto { Page = "grocery" });

            Assert.Equal(ShopScope.Grocery, updated.Page);
            Assert.Equal(ShopScope.Grocery, (await _context.Banners.AsNoTracking().SingleAsync(b => b.Id == banner.Id)).Page);
            Assert.Empty(await Home().GetBannersAsync(onlyActive: false, page: ShopScope.General));
        }

        [Fact]
        public async Task TopVendors_ArePerPage()
        {
            var electronicsOnly = new Vendor { Name = "tech", NameAr = "تقنية", OwnerId = Guid.NewGuid(), IsActive = true };
            _context.AddRange(electronicsOnly, new Product { VendorId = electronicsOnly.Id, CategoryId = _electronics.Id, Name = "tv", NameAr = "تلفاز", Price = 1, StockQuantity = 1 },
                new HomeSection { Type = "top_vendors", Title = "stores", MaxItems = 10, Page = ShopScope.Grocery });
            await _context.SaveChangesAsync();

            var mart = await Home().GetHomePageAsync(ShopScope.Grocery);
            var vendors = JsonSerializer.Deserialize<List<JsonElement>>(JsonSerializer.Serialize(mart.Sections.Single().Data))!;

            Assert.Equal(_store.Id, Assert.Single(vendors).GetProperty("Id").GetGuid());
        }

        [Fact]
        public void ParsePage_DefaultsToGeneral()
        {
            Assert.Equal(ShopScope.General, ShopScope.ParsePage(null));
            Assert.Equal(ShopScope.General, ShopScope.ParsePage("anything"));
            Assert.Equal(ShopScope.Grocery, ShopScope.ParsePage(" Grocery "));
            Assert.Null(ShopScope.Parse(""));
        }
    }
}
