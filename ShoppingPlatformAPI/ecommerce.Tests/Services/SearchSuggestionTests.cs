using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Tests.Services
{
    // اقتراحات البحث أثناء الكتابة: منتجات ومتاجر وفئات في استعلام واحد وبقواعد الظهور نفسها
    public class SearchSuggestionTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Vendor _store;
        private readonly Vendor _other;
        private readonly Vendor _closed;
        private readonly Category _grocery;
        private readonly Category _dairy;
        private readonly Category _phones;
        private readonly Product _milk;
        private readonly Product _phone;

        public SearchSuggestionTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _store = new Vendor { Name = "milk house", NameAr = "بيت الحليب", OwnerId = Guid.NewGuid(), IsActive = true };
            _other = new Vendor { Name = "mart", NameAr = "ماركت", OwnerId = Guid.NewGuid(), IsActive = true };
            _closed = new Vendor { Name = "milk gone", NameAr = "حليب المغلق", OwnerId = Guid.NewGuid(), IsActive = false };
            _grocery = new Category { Name = "Supermarket", NameAr = "سوبرماركت", IsGrocery = true };
            _dairy = new Category { Name = "Dairy", NameAr = "ألبان الحليب", ParentId = _grocery.Id };
            _phones = new Category { Name = "Phones", NameAr = "هواتف" };
            _milk = NewProduct(_store, "milk", "حليب طازج", _dairy.Id);
            _phone = NewProduct(_other, "phone", "هاتف حليبي", _phones.Id);

            _context.AddRange(_store, _other, _closed, _grocery, _dairy, _phones, _milk, _phone);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private static Product NewProduct(Vendor vendor, string name, string nameAr, Guid? categoryId) => new()
        {
            VendorId = vendor.Id, CategoryId = categoryId, Name = name, NameAr = nameAr, Price = 1000, StockQuantity = 5
        };

        [Fact]
        public async Task Suggest_MixesProductsStoresAndCategories()
        {
            var result = await new ProductRepository(_context).SuggestAsync("حليب", 8);

            Assert.Contains(result, s => s.Type == SearchSuggestionTypes.Product && s.Id == _milk.Id && s.Text == "حليب طازج" && s.Subtitle == "بيت الحليب");
            Assert.Contains(result, s => s.Type == SearchSuggestionTypes.Product && s.Id == _phone.Id);
            Assert.Contains(result, s => s.Type == SearchSuggestionTypes.Store && s.Id == _store.Id);
            Assert.Contains(result, s => s.Type == SearchSuggestionTypes.Category && s.Id == _dairy.Id);
            // المتجر المعطّل لا يظهر
            Assert.DoesNotContain(result, s => s.Id == _closed.Id);
        }

        [Fact]
        public async Task Suggest_IsCaseInsensitiveForLatinNames()
        {
            var result = await new ProductRepository(_context).SuggestAsync("MiLk", 8);

            Assert.Contains(result, s => s.Id == _milk.Id);
            Assert.Contains(result, s => s.Id == _store.Id);
        }

        [Fact]
        public async Task Suggest_RespectsScope()
        {
            var repo = new ProductRepository(_context);

            var general = await repo.SuggestAsync("حليب", 8, ShopScope.General);
            var grocery = await repo.SuggestAsync("حليب", 8, ShopScope.Grocery);

            Assert.Contains(general, s => s.Id == _phone.Id);
            Assert.DoesNotContain(general, s => s.Id == _milk.Id);
            Assert.Contains(grocery, s => s.Id == _milk.Id);
            Assert.DoesNotContain(grocery, s => s.Id == _phone.Id);
            // الفئة الفرعية للسوبرماركت لا تظهر في العام
            Assert.DoesNotContain(general, s => s.Id == _dairy.Id);
            Assert.Contains(grocery, s => s.Id == _dairy.Id);
        }

        [Fact]
        public async Task Suggest_ShowsSameProductNameOnce_AndSkipsUnavailable()
        {
            var twin = NewProduct(_other, "milk", "حليب طازج", _dairy.Id);
            var soldOut = NewProduct(_store, "milk soldout", "حليب منتهي", _dairy.Id);
            soldOut.IsAvailable = false;
            _context.AddRange(twin, soldOut);
            await _context.SaveChangesAsync();

            var result = await new ProductRepository(_context).SuggestAsync("حليب", 8);

            Assert.Single(result, s => s.Type == SearchSuggestionTypes.Product && s.Text == "حليب طازج");
            Assert.DoesNotContain(result, s => s.Id == soldOut.Id);
        }

        [Fact]
        public async Task Suggest_NeverExceedsLimit_AndPutsPrefixMatchesFirst()
        {
            for (var i = 0; i < 10; i++)
                _context.Add(NewProduct(_other, $"x{i}", $"قهوة حليب {i}", _phones.Id));
            _context.Add(NewProduct(_other, "p", "حليب البداية", _phones.Id));
            await _context.SaveChangesAsync();

            var result = await new ProductRepository(_context).SuggestAsync("حليب", 5);

            Assert.True(result.Count <= 5);
            var products = result.Where(s => s.Type == SearchSuggestionTypes.Product).ToList();
            // ما يبدأ بالكلمة («حليب طازج» و«حليب البداية») يسبق ما يحتويها فقط
            Assert.Contains(products, s => s.Text == "حليب البداية");
            Assert.StartsWith("حليب", products[0].Text);
            Assert.StartsWith("حليب", products[1].Text);
        }

        [Fact]
        public async Task Suggest_BlankTermReturnsNothing()
        {
            Assert.Empty(await new ProductRepository(_context).SuggestAsync("   ", 8));
        }
    }
}
