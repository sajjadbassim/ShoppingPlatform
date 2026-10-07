using ecommerce.Core.DTO.Product;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ProductService.ProductService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // نسخ منتج: نسخة مخفية بمخزون صفر، بصور منسوخة وخيارات ومتغيرات بمعرّفات جديدة
    public class ProductDuplicateTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IFileService> _files = new();
        private readonly Product _source;

        public ProductDuplicateTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            var store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true };
            _source = new Product { VendorId = store.Id, Name = "Shirt", NameAr = "قميص", Description = "قطن", Price = 10000, OriginalPrice = 12000, Sku = "SH", StockQuantity = 7, IsActive = true, IsAvailable = true };
            _source.Images.Add(new ProductImage { ImageUrl = "/uploads/products/a.jpg", IsPrimary = true });
            var size = new ProductAttribute { ProductId = _source.Id, Name = "Size", NameAr = "المقاس" };
            var large = new ProductAttributeValue { AttributeId = size.Id, Value = "L" };
            size.Values.Add(large);
            var variant = new ProductVariant { ProductId = _source.Id, Sku = "SH-L", StockQuantity = 4, PriceAdjustment = 500 };
            variant.AttributeValues.Add(new ProductVariantAttributeValue { VariantId = variant.Id, AttributeValueId = large.Id });
            _context.AddRange(store, _source, size, variant);
            _context.SaveChanges();

            _files.Setup(f => f.CopyImageAsync("/uploads/products/a.jpg")).ReturnsAsync("/uploads/products/b.jpg");
        }

        public void Dispose() => _context.Dispose();

        private ProductService Products() => new(
            new ProductRepository(_context), new Mock<IVendorRepository>().Object,
            new ProductImageRepository(_context), _files.Object, _context,
            new Mock<IPromotionRepository>().Object, new Mock<IInventoryService>().Object);

        [Fact]
        public async Task Duplicate_IsHiddenWithZeroStock_AndCopiesImagesAttributesVariants()
        {
            var copy = await Products().DuplicateAsync(_source.Id);

            var saved = await _context.Products.AsNoTracking().Include(p => p.Images).SingleAsync(p => p.Id == copy.Id);
            Assert.False(saved.IsActive);
            Assert.Equal(0, saved.StockQuantity);
            Assert.Equal("قميص (نسخة)", saved.NameAr);
            Assert.Equal(10000, saved.Price);
            Assert.Equal(12000, saved.OriginalPrice);
            Assert.Equal("/uploads/products/b.jpg", Assert.Single(saved.Images).ImageUrl);

            var variant = await _context.ProductVariants.AsNoTracking().Include(v => v.AttributeValues).ThenInclude(av => av.AttributeValue)
                .SingleAsync(v => v.ProductId == copy.Id);
            Assert.Equal(0, variant.StockQuantity);
            Assert.Equal(500, variant.PriceAdjustment);
            // المتغير مربوط بقيمة الخيار الجديدة لا قيمة المنتج الأصلي
            var value = Assert.Single(variant.AttributeValues).AttributeValue;
            Assert.Equal("L", value.Value);
            Assert.NotEqual(_source.Id, (await _context.ProductAttributes.AsNoTracking().SingleAsync(a => a.Id == value.AttributeId)).ProductId);
        }

        [Fact]
        public async Task Duplicate_OfDeletedProduct_IsNotFound()
        {
            _source.IsDeleted = true;
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<NotFoundException>(() => Products().DuplicateAsync(_source.Id));
        }

        [Fact]
        public async Task ZeroPrice_IsRejected() =>
            await Assert.ThrowsAsync<BusinessRuleException>(() => Products().UpdateAsync(_source.Id, new UpdateProductDto { Price = 0 }));
    }
}
