using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ProductService;
using ecommerce.Services.ProductService.ProductService;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // الصور الرئيسية، قاعدة توفر المخزون، حذف المتغيرات، والتحقق من توقيع ملفات الصور
    public class CatalogMaintenanceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IFileService> _files = new();
        private readonly Vendor _store;
        private readonly Product _product;

        public CatalogMaintenanceTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid() };
            _product = new Product { VendorId = _store.Id, Name = "p", NameAr = "p", Price = 10, StockQuantity = 5 };
            _context.AddRange(_store, _product);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private ProductService Products() => new(
            new ProductRepository(_context), new Mock<IVendorRepository>().Object,
            new ProductImageRepository(_context), _files.Object, _context,
            new Mock<IPromotionRepository>().Object, new Mock<IInventoryService>().Object);

        // ===================================
        // الصور
        // ===================================
        [Fact]
        public async Task DeletingPrimaryImage_PromotesNextImage()
        {
            var primary = new ProductImage { ProductId = _product.Id, ImageUrl = "/uploads/products/1.png", IsPrimary = true, DisplayOrder = 0 };
            var second = new ProductImage { ProductId = _product.Id, ImageUrl = "/uploads/products/2.png", DisplayOrder = 1 };
            _context.AddRange(primary, second);
            await _context.SaveChangesAsync();

            Assert.True(await Products().DeleteImageAsync(primary.Id));

            Assert.True((await _context.ProductImages.FindAsync(second.Id))!.IsPrimary);
        }

        [Fact]
        public async Task AddImage_AfterDeletion_UsesNextDisplayOrder()
        {
            _context.AddRange(
                new ProductImage { ProductId = _product.Id, ImageUrl = "/a.png", IsPrimary = true, DisplayOrder = 0 },
                new ProductImage { ProductId = _product.Id, ImageUrl = "/c.png", DisplayOrder = 2 });
            await _context.SaveChangesAsync();
            _files.Setup(f => f.SaveImageAsync(It.IsAny<IFormFile>(), It.IsAny<string>())).ReturnsAsync("/new.png");

            var added = await Products().AddImageAsync(_product.Id, new Mock<IFormFile>().Object);

            Assert.Equal(3, added.DisplayOrder);
            Assert.False(added.IsPrimary);
        }

        // ===================================
        // المخزون والتوفر
        // ===================================
        [Theory]
        [InlineData(true, 5, 0, false)]   // نفاد الكمية
        [InlineData(false, 0, 7, true)]   // إعادة التخزين من صفر
        [InlineData(false, 5, 9, false)]  // إخفاء يدوي يبقى
        [InlineData(true, 5, 2, true)]
        public async Task UpdateStock_AvailabilityRule(bool available, int before, int after, bool expected)
        {
            _product.IsAvailable = available;
            _product.StockQuantity = before;
            await _context.SaveChangesAsync();

            Assert.True(await Products().UpdateStockAsync(_product.Id, after));

            Assert.Equal(expected, (await _context.Products.FindAsync(_product.Id))!.IsAvailable);
        }

        [Fact]
        public async Task UpdateStock_ProductWithVariants_KeepsAvailability()
        {
            _context.Add(new ProductVariant { ProductId = _product.Id, Sku = "v" });
            await _context.SaveChangesAsync();

            await Products().UpdateStockAsync(_product.Id, 0);

            Assert.True((await _context.Products.FindAsync(_product.Id))!.IsAvailable);
        }

        // ===================================
        // حذف المتغيرات
        // ===================================
        [Fact]
        public async Task DeleteVariant_UsedInOrder_IsRejected()
        {
            var variant = new ProductVariant { ProductId = _product.Id, Sku = "v" };
            _context.AddRange(variant, new SubOrderItem
            {
                SubOrderId = Guid.NewGuid(), ProductId = _product.Id, VariantId = variant.Id,
                ProductName = "p", UnitPrice = 10, Quantity = 1, Subtotal = 10
            });
            await _context.SaveChangesAsync();

            var service = new VariantService(_context, new Mock<IInventoryService>().Object, new Mock<IPromotionService>().Object);
            var ex = await Assert.ThrowsAsync<Exception>(() => service.DeleteVariantAsync(variant.Id));

            Assert.Contains("طلبات سابقة", ex.Message);
        }

        [Fact]
        public async Task DeleteVariant_RemovesItFromCarts()
        {
            var variant = new ProductVariant { ProductId = _product.Id, Sku = "v" };
            _context.AddRange(variant, new CartItem { CartId = Guid.NewGuid(), ProductId = _product.Id, VariantId = variant.Id, Quantity = 1 });
            await _context.SaveChangesAsync();

            var service = new VariantService(_context, new Mock<IInventoryService>().Object, new Mock<IPromotionService>().Object);
            Assert.True(await service.DeleteVariantAsync(variant.Id));

            Assert.Empty(_context.CartItems);
        }

        // ===================================
        // توقيع ملفات الصور
        // ===================================
        private static IFormFile FormFile(string name, byte[] content) =>
            new FormFile(new MemoryStream(content), 0, content.Length, "file", name);

        [Fact]
        public async Task SaveImage_RejectsFakeImageAndAcceptsRealPng()
        {
            var webRoot = Path.Combine(Path.GetTempPath(), "file-service-tests", Guid.NewGuid().ToString());
            var env = new Mock<IWebHostEnvironment>();
            env.Setup(e => e.WebRootPath).Returns(webRoot);
            var service = new FileService(env.Object);

            try
            {
                await Assert.ThrowsAsync<ArgumentException>(() =>
                    service.SaveImageAsync(FormFile("evil.png", "<script>alert(1)</script>"u8.ToArray())));

                var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
                var url = await service.SaveImageAsync(FormFile("ok.png", png));

                Assert.StartsWith("/uploads/products/", url);
                Assert.True(await service.DeleteImageAsync(url));
                Assert.False(await service.DeleteImageAsync("/../outside.txt")); // خارج مجلد الرفع
            }
            finally
            {
                if (Directory.Exists(webRoot)) Directory.Delete(webRoot, true);
            }
        }
    }
}
