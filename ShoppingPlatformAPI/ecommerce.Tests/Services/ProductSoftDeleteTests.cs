using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ProductService.ProductService;
using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;

namespace ecommerce.Tests.Services
{
    // الفرق بين الحذف (نهائي) والإخفاء (مؤقت) للبائع
    public class ProductSoftDeleteTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly ProductRepository _repository;
        private readonly Guid _ownerId = Guid.NewGuid();
        private readonly Vendor _store;
        private readonly Product _visible;
        private readonly Product _hidden;
        private readonly Product _toDelete;

        public ProductSoftDeleteTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _repository = new ProductRepository(_context);

            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = _ownerId, IsActive = true };
            _visible = new Product { VendorId = _store.Id, Name = "visible", NameAr = "ظاهر", Price = 10 };
            _hidden = new Product { VendorId = _store.Id, Name = "hidden", NameAr = "مخفي", Price = 10, IsActive = false };
            _toDelete = new Product { VendorId = _store.Id, Name = "deleted", NameAr = "محذوف", Price = 10 };

            _context.AddRange(_store, _visible, _hidden, _toDelete,
                new ProductImage { ProductId = _toDelete.Id, ImageUrl = "/uploads/products/d.png", IsPrimary = true },
                new CartItem { CartId = Guid.NewGuid(), ProductId = _toDelete.Id, Quantity = 1 },
                new Wishlist { UserId = Guid.NewGuid(), ProductId = _toDelete.Id });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private ProductService Products() => new(
            _repository, new Mock<IVendorRepository>().Object,
            new ProductImageRepository(_context), new Mock<IFileService>().Object, _context,
            new Mock<IPromotionRepository>().Object, new Mock<IInventoryService>().Object);

        private VendorAccessService OwnerAccess()
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, _ownerId.ToString()),
                new Claim(ClaimTypes.Role, "VENDOR"),
            }, "test");
            return new VendorAccessService(_context,
                new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } });
        }

        [Fact]
        public async Task Delete_MarksDeleted_KeepsRecordAndImages_ClearsCartsAndWishlists()
        {
            Assert.True(await Products().DeleteAsync(_toDelete.Id));

            var product = (await _context.Products.FindAsync(_toDelete.Id))!;
            Assert.True(product.IsDeleted);
            Assert.False(product.IsActive);
            Assert.NotNull(product.DeletedAt);
            Assert.Single(_context.ProductImages.Where(i => i.ProductId == _toDelete.Id));
            Assert.Empty(_context.CartItems);
            Assert.Empty(_context.Wishlists);
        }

        [Fact]
        public async Task Delete_Twice_ReturnsFalse()
        {
            Assert.True(await Products().DeleteAsync(_toDelete.Id));
            Assert.False(await Products().DeleteAsync(_toDelete.Id));
        }

        [Fact]
        public async Task VendorDashboardList_ShowsHiddenButNotDeleted()
        {
            await Products().DeleteAsync(_toDelete.Id);

            var ids = (await _repository.GetByVendorAsync(_store.Id, includeInactiveVendor: true, includeHidden: true))
                .Select(p => p.Id).ToHashSet();

            Assert.Equal(new HashSet<Guid> { _visible.Id, _hidden.Id }, ids);
        }

        [Fact]
        public async Task PublicStoreList_ShowsVisibleOnly()
        {
            await Products().DeleteAsync(_toDelete.Id);

            var products = await _repository.GetByVendorAsync(_store.Id);

            Assert.Equal(_visible.Id, Assert.Single(products).Id);
        }

        [Fact]
        public async Task StaffFilterOnInactive_DoesNotReturnDeleted()
        {
            await Products().DeleteAsync(_toDelete.Id);

            var result = await _repository.GetAdvancedFilteredAsync(isActive: false);

            Assert.Equal(_hidden.Id, Assert.Single(result.Items).Id);
        }

        [Fact]
        public async Task DeletedProduct_CannotBeViewedOrManaged_HiddenCan()
        {
            await Products().DeleteAsync(_toDelete.Id);
            var access = OwnerAccess();

            await Assert.ThrowsAsync<Exception>(() => Products().GetByIdAsync(_toDelete.Id));
            await Assert.ThrowsAsync<NotFoundException>(() => access.EnsureCanManageProductAsync(_toDelete.Id));

            // المخفي يبقى قابلاً للعرض والتعديل لصاحبه
            Assert.Equal(_hidden.Id, (await Products().GetByIdAsync(_hidden.Id)).Id);
            await access.EnsureCanManageProductAsync(_hidden.Id);
        }
    }
}
