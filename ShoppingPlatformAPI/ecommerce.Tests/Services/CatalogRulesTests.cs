using ecommerce.Core.DTO.Category;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ProductService;
using ecommerce.Services.ProductService.ProductService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // قواعد الفئات والمنتجات والمتغيرات: الحلقات، الأسماء، الإخفاء، التحقق من المدخلات
    public class CatalogRulesTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IFileService> _files = new();

        private readonly Vendor _store;
        private readonly Category _root;
        private readonly Category _child;
        private readonly Product _childProduct;
        private readonly Product _variantProduct;
        private readonly ProductAttribute _size;
        private readonly ProductAttributeValue _small;
        private readonly ProductAttributeValue _medium;
        private readonly ProductAttribute _color;
        private readonly ProductAttributeValue _red;

        public CatalogRulesTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _store = new Vendor { Name = "store", NameAr = "متجر", OwnerId = Guid.NewGuid(), IsActive = true };
            _root = new Category { Name = "Root", NameAr = "رئيسي" };
            _child = new Category { Name = "Child", NameAr = "فرعي", ParentId = _root.Id };
            _childProduct = new Product { VendorId = _store.Id, CategoryId = _child.Id, Name = "p1", NameAr = "م1", Price = 10 };
            _variantProduct = new Product { VendorId = _store.Id, Name = "p2", NameAr = "م2", Price = 10 };

            _size = new ProductAttribute { ProductId = _variantProduct.Id, Name = "Size" };
            _small = new ProductAttributeValue { AttributeId = _size.Id, Value = "S" };
            _medium = new ProductAttributeValue { AttributeId = _size.Id, Value = "M" };
            _color = new ProductAttribute { ProductId = _variantProduct.Id, Name = "Color" };
            _red = new ProductAttributeValue { AttributeId = _color.Id, Value = "Red" };

            var existingVariant = new ProductVariant { ProductId = _variantProduct.Id, Sku = "S-RED" };

            _context.AddRange(_store, _root, _child, _childProduct, _variantProduct,
                _size, _small, _medium, _color, _red, existingVariant,
                new ProductVariantAttributeValue { VariantId = existingVariant.Id, AttributeValueId = _small.Id },
                new ProductVariantAttributeValue { VariantId = existingVariant.Id, AttributeValueId = _red.Id },
                new ProductImage { ProductId = _childProduct.Id, ImageUrl = "/uploads/products/a.png", IsPrimary = true });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private CategoryService Categories() => new(new CategoryRepository(_context), _files.Object);

        private ProductService Products() => new(
            new ProductRepository(_context), new Mock<IVendorRepository>().Object,
            new ProductImageRepository(_context), _files.Object, _context,
            new Mock<IPromotionRepository>().Object, new Mock<IInventoryService>().Object);

        private VariantService Variants() => new(
            _context, new Mock<IInventoryService>().Object, new Mock<IPromotionService>().Object);

        // ===================================
        // الفئات
        // ===================================
        [Fact]
        public async Task UpdateCategory_MovingUnderOwnDescendant_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() =>
                Categories().UpdateAsync(_root.Id, new CategoryUpdateDto { ParentId = _child.Id }));

            Assert.Contains("الفرعية", ex.Message);
        }

        [Fact]
        public async Task UpdateCategory_MakeRoot_ClearsParent()
        {
            var result = await Categories().UpdateAsync(_child.Id, new CategoryUpdateDto { MakeRoot = true });

            Assert.Null(result.ParentId);
        }

        [Fact]
        public async Task UpdateCategory_DuplicateName_IsRejected()
        {
            await Assert.ThrowsAsync<Exception>(() =>
                Categories().UpdateAsync(_child.Id, new CategoryUpdateDto { Name = "Root" }));
            await Assert.ThrowsAsync<Exception>(() =>
                Categories().UpdateAsync(_child.Id, new CategoryUpdateDto { NameAr = "رئيسي" }));
        }

        [Fact]
        public async Task DeleteCategory_OnlyDeactivates_AndIsIdempotent()
        {
            Assert.True(await Categories().DeleteAsync(_root.Id));
            Assert.True(await Categories().DeleteAsync(_root.Id));

            Assert.False((await _context.Categories.FindAsync(_root.Id))!.IsActive);
        }

        [Fact]
        public async Task InactiveParent_HidesChildrenAndTheirProducts()
        {
            _root.IsActive = false;
            await _context.SaveChangesAsync();

            var visibleCategories = await Categories().GetAllAsync(onlyActive: true);
            var products = new ProductRepository(_context);

            Assert.DoesNotContain(visibleCategories, c => c.Id == _child.Id);
            Assert.DoesNotContain(await products.GetAllAsync(), p => p.Id == _childProduct.Id);
            Assert.False(await products.IsPubliclyVisibleAsync(_childProduct.Id));
            Assert.True(await products.IsPubliclyVisibleAsync(_variantProduct.Id)); // بلا فئة
        }

        [Fact]
        public async Task ProductCounts_ExcludeInactiveProducts()
        {
            _childProduct.IsActive = false;
            await _context.SaveChangesAsync();

            var counts = await new CategoryRepository(_context).GetProductCountsAsync();

            Assert.Equal(0, counts[_root.Id]);
        }

        // ===================================
        // المنتجات
        // ===================================
        [Fact]
        public async Task DeleteProduct_KeepsImages()
        {
            Assert.True(await Products().DeleteAsync(_childProduct.Id));

            Assert.False((await _context.Products.FindAsync(_childProduct.Id))!.IsActive);
            Assert.Single(_context.ProductImages.Where(i => i.ProductId == _childProduct.Id));
            _files.Verify(f => f.DeleteImagesAsync(It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task CreateProduct_UnknownCategory_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Products().CreateAsync(new CreateProductDto
            {
                VendorId = _store.Id, Name = "x", Price = 10, CategoryId = Guid.NewGuid()
            }));

            Assert.Equal("التصنيف غير موجود", ex.Message);
        }

        [Fact]
        public async Task CreateProduct_InactiveCategory_IsRejected()
        {
            _root.IsActive = false;
            await _context.SaveChangesAsync();

            var ex = await Assert.ThrowsAsync<Exception>(() => Products().CreateAsync(new CreateProductDto
            {
                VendorId = _store.Id, Name = "x", Price = 10, CategoryId = _child.Id
            }));

            Assert.Equal("التصنيف غير مفعّل", ex.Message);
        }

        [Theory]
        [InlineData(10)]
        [InlineData(8)]
        public async Task CreateProduct_OriginalPriceNotAbovePrice_IsRejected(decimal originalPrice)
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Products().CreateAsync(new CreateProductDto
            {
                VendorId = _store.Id, Name = "x", Price = 10, OriginalPrice = originalPrice
            }));

            Assert.Contains("السعر الأصلي", ex.Message);
        }

        [Fact]
        public async Task UpdateProduct_ClearFlags_RemoveOriginalPriceAndCategory()
        {
            _childProduct.OriginalPrice = 20;
            await _context.SaveChangesAsync();

            var result = await Products().UpdateAsync(_childProduct.Id,
                new UpdateProductDto { ClearOriginalPrice = true, ClearCategory = true });

            Assert.Null(result.OriginalPrice);
            Assert.Null(result.CategoryId);
        }

        // ===================================
        // المتغيرات
        // ===================================
        [Fact]
        public async Task CreateVariant_DuplicateCombination_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Variants().CreateVariantAsync(_variantProduct.Id,
                new CreateProductVariantDto { AttributeValueIds = new() { _red.Id, _small.Id } }));

            Assert.Contains("مسبقاً", ex.Message);
        }

        [Fact]
        public async Task CreateVariant_TwoValuesOfSameAttribute_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Variants().CreateVariantAsync(_variantProduct.Id,
                new CreateProductVariantDto { AttributeValueIds = new() { _small.Id, _medium.Id } }));

            Assert.Contains("نفس الخاصية", ex.Message);
        }

        [Fact]
        public async Task CreateVariant_NegativeFinalPrice_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => Variants().CreateVariantAsync(_variantProduct.Id,
                new CreateProductVariantDto { AttributeValueIds = new() { _medium.Id, _red.Id }, PriceAdjustment = -11 }));

            Assert.Contains("سالباً", ex.Message);
        }
    }
}
