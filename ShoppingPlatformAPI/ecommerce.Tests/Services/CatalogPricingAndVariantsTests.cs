using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ProductService;
using ecommerce.Services.ProductService.ProductService;
using ecommerce.Services.VendorService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // فلترة/ترتيب بسعر العرض، توفر المنتج ذي المتغيرات، اكتمال المتغيرات، وإحصائيات البائع
    public class CatalogPricingAndVariantsTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IPromotionRepository> _promotions = new();
        private readonly Vendor _store;
        private readonly Product _cheap;      // 50 بلا عرض
        private readonly Product _promoted;   // 100 وعليه عرض 60% → 40
        private readonly Product _discounted; // 80 (أصلي 120) بلا عرض
        private readonly Product _variantProduct;

        public CatalogPricingAndVariantsTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true };
            _cheap = NewProduct("cheap", 50);
            _promoted = NewProduct("promoted", 100);
            _discounted = NewProduct("discounted", 80);
            _discounted.OriginalPrice = 120;

            // المفتاح العام "متوفر" مطفأ ومخزون المنتج صفر — لكن المتغيرات متوفرة
            _variantProduct = NewProduct("variants", 30);
            _variantProduct.IsAvailable = false;
            _variantProduct.StockQuantity = 0;

            _context.AddRange(_store, _cheap, _promoted, _discounted, _variantProduct,
                new ProductVariant { ProductId = _variantProduct.Id, Sku = "a", StockQuantity = 3, IsAvailable = true },
                new ProductVariant { ProductId = _variantProduct.Id, Sku = "b", StockQuantity = 4, IsAvailable = true },
                new ProductVariant { ProductId = _variantProduct.Id, Sku = "c", StockQuantity = 9, IsAvailable = false });
            _context.SaveChanges();

            _promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new[]
            {
                new Promotion
                {
                    Name = "sale", TargetType = PromotionTargetType.PRODUCT, TargetId = _promoted.Id,
                    DiscountType = DiscountType.PERCENTAGE, DiscountValue = 60, IsActive = true
                }
            });
        }

        public void Dispose() => _context.Dispose();

        private Product NewProduct(string name, decimal price) => new()
        {
            VendorId = _store.Id, Name = name, NameAr = name, Price = price, StockQuantity = 10
        };

        private ProductService Products() => new(
            new ProductRepository(_context), new Mock<IVendorRepository>().Object,
            new ProductImageRepository(_context), new Mock<IFileService>().Object, _context,
            _promotions.Object, new Mock<IInventoryService>().Object);

        private async Task<List<string>> Names(ProductFilterDto filter) =>
            (await Products().GetAdvancedFilteredAsync(filter)).Data.Select(p => p.Name).ToList();

        // ===================================
        // السعر بعد العروض
        // ===================================
        [Fact]
        public async Task ProductDto_KeepsStoredPricesForEditForms()
        {
            var promo = (await _promotions.Object.GetActivePromotionsAsync()).Single();
            _promotions.Setup(p => p.GetBestPromotionForProductAsync(_promoted.Id, It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync(promo);

            var dto = await Products().GetByIdAsync(_promoted.Id);

            Assert.Equal(40m, dto.Price);            // ما يراه الزبون بعد العرض
            Assert.Equal(100m, dto.RegularPrice);    // السعر المخزّن الذي يعدّله البائع
            Assert.Null(dto.RegularOriginalPrice);

            var variants = await Products().GetByIdAsync(_variantProduct.Id);
            Assert.Equal(7, variants.StockQuantity);       // مجموع المتغيرات
            Assert.Equal(0, variants.RegularStockQuantity); // مخزون المنتج نفسه
        }

        [Fact]
        public async Task DiscountFilter_IncludesPromotionOnlyProducts()
        {
            var names = await Names(new ProductFilterDto { HasDiscount = true });

            Assert.Equal(new[] { "discounted", "promoted" }, names.OrderBy(n => n));
        }

        [Fact]
        public async Task PriceSort_UsesPromotionPrice()
        {
            var names = await Names(new ProductFilterDto { SortBy = "price", SortOrder = "asc" });

            // variants 30، promoted 40 (بدل 100)، cheap 50، discounted 80
            Assert.Equal(new[] { "variants", "promoted", "cheap", "discounted" }, names);
        }

        [Fact]
        public async Task MaxPrice_UsesPromotionPrice_AndPaginates()
        {
            var result = await Products().GetAdvancedFilteredAsync(new ProductFilterDto
            {
                MaxPrice = 45, SortBy = "price", SortOrder = "desc", PageSize = 1, PageNumber = 1
            });

            Assert.Equal("promoted", Assert.Single(result.Data).Name);
            Assert.Equal(2, result.Pagination.TotalCount); // promoted 40 + variants 30
            Assert.Equal(40m, result.Data.Single().Price);
        }

        // ===================================
        // التوفر والمخزون للمنتج ذي المتغيرات
        // ===================================
        [Fact]
        public async Task VariantProduct_AvailabilityAndStockComeFromVariants()
        {
            var dto = await Products().GetByIdAsync(_variantProduct.Id);

            Assert.True(dto.HasVariants);
            Assert.True(dto.IsAvailable);
            Assert.Equal(7, dto.StockQuantity); // المتغير غير المتوفر لا يُحسب
        }

        [Fact]
        public async Task InStockFilter_UsesVariantStock()
        {
            _cheap.StockQuantity = 0;
            await _context.SaveChangesAsync();

            var names = await Names(new ProductFilterDto { IsAvailable = true });

            Assert.Contains("variants", names);
            Assert.DoesNotContain("cheap", names); // بلا متغيرات ومخزونه صفر
        }

        // ===================================
        // اكتمال المتغيرات
        // ===================================
        private (ProductAttributeValue small, ProductAttributeValue red) SeedTwoAttributes(Product product)
        {
            var size = new ProductAttribute { ProductId = product.Id, Name = "Size" };
            var color = new ProductAttribute { ProductId = product.Id, Name = "Color" };
            var small = new ProductAttributeValue { AttributeId = size.Id, Value = "S" };
            var red = new ProductAttributeValue { AttributeId = color.Id, Value = "Red" };
            _context.AddRange(size, color, small, red);
            _context.SaveChanges();
            return (small, red);
        }

        private VariantService Variants() => new(
            _context, new Mock<IInventoryService>().Object, new Mock<IPromotionService>().Object);

        [Fact]
        public async Task CreateVariant_MissingAttribute_IsRejected()
        {
            var (small, _) = SeedTwoAttributes(_cheap);

            var ex = await Assert.ThrowsAsync<Exception>(() => Variants().CreateVariantAsync(_cheap.Id,
                new CreateProductVariantDto { AttributeValueIds = new() { small.Id } }));

            Assert.Contains("لكل خاصية", ex.Message);
        }

        [Fact]
        public async Task CreateAttribute_AfterVariantsExist_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Variants().CreateAttributeAsync(_variantProduct.Id,
                new CreateProductAttributeDto { Name = "Material", Values = new() { new CreateAttributeValueDto { Value = "Cotton" } } }));

            Assert.Contains("بعد إنشاء متغيرات", ex.Message);
        }

        // ===================================
        // إحصائيات منتجات البائع
        // ===================================
        [Fact]
        public async Task VendorProductStats_AggregatesDeliveredSalesAndVariantStock()
        {
            var delivered = new SubOrder { VendorId = _store.Id, Status = SubOrderStatus.Delivered };
            var pending = new SubOrder { VendorId = _store.Id };
            _context.AddRange(delivered, pending,
                new SubOrderItem { SubOrderId = delivered.Id, ProductId = _cheap.Id, ProductName = "c", UnitPrice = 50, Quantity = 2, Subtotal = 100 },
                new SubOrderItem { SubOrderId = pending.Id, ProductId = _cheap.Id, ProductName = "c", UnitPrice = 50, Quantity = 5, Subtotal = 250 },
                new Review { ProductId = _cheap.Id, UserId = Guid.NewGuid(), Rating = 4, IsApproved = true },
                new Review { ProductId = _cheap.Id, UserId = Guid.NewGuid(), Rating = 5, IsApproved = true });
            await _context.SaveChangesAsync();

            var result = await new VendorDashboardService(_context, new Mock<IInventoryService>().Object)
                .GetProductsWithStatsAsync(_store.Id, 1, 50);

            var cheap = result.Data.Single(p => p.ProductId == _cheap.Id);
            Assert.Equal(2, cheap.TotalSold);
            Assert.Equal(100m, cheap.TotalRevenue);
            Assert.Equal(4.5m, cheap.AverageRating);
            Assert.Equal(2, cheap.ReviewCount);

            var variants = result.Data.Single(p => p.ProductId == _variantProduct.Id);
            Assert.Equal(7, variants.StockQuantity);
            Assert.True(variants.IsAvailable);
        }
    }
}
