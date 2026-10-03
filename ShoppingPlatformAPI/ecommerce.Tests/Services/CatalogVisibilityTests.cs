using ecommerce.Core.DTO.Cart;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;

namespace ecommerce.Tests.Services
{
    // اختبارات ظهور المنتجات: الفئات الفرعية، المتاجر المعطّلة، ومنع الإضافة للسلة بدون متغير
    public class CatalogVisibilityTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly ProductRepository _repository;

        private readonly Guid _ownerId = Guid.NewGuid();
        private readonly Vendor _activeStore;
        private readonly Vendor _inactiveStore;

        private readonly Category _root;
        private readonly Category _child;
        private readonly Category _grandchild;
        private readonly Category _otherRoot;

        private readonly Product _rootProduct;
        private readonly Product _childProduct;
        private readonly Product _grandchildProduct;
        private readonly Product _otherProduct;
        private readonly Product _inactiveStoreProduct;
        private readonly Product _variantProduct;

        public CatalogVisibilityTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _repository = new ProductRepository(_context);

            _activeStore = new Vendor { Name = "active", NameAr = "مفعّل", OwnerId = Guid.NewGuid(), IsActive = true };
            _inactiveStore = new Vendor { Name = "inactive", NameAr = "معطّل", OwnerId = _ownerId, IsActive = false };

            _root = new Category { Name = "root", NameAr = "رئيسي" };
            _child = new Category { Name = "child", NameAr = "فرعي", ParentId = _root.Id };
            _grandchild = new Category { Name = "grandchild", NameAr = "فرعي ثانٍ", ParentId = _child.Id };
            _otherRoot = new Category { Name = "other", NameAr = "أخرى" };

            _rootProduct = NewProduct(_activeStore, _root);
            _childProduct = NewProduct(_activeStore, _child);
            _grandchildProduct = NewProduct(_activeStore, _grandchild);
            _otherProduct = NewProduct(_activeStore, _otherRoot);
            _inactiveStoreProduct = NewProduct(_inactiveStore, _child);
            _variantProduct = NewProduct(_activeStore, _otherRoot);

            _context.AddRange(_activeStore, _inactiveStore, _root, _child, _grandchild, _otherRoot,
                _rootProduct, _childProduct, _grandchildProduct, _otherProduct, _inactiveStoreProduct, _variantProduct,
                new ProductVariant { ProductId = _variantProduct.Id, Sku = "V1", StockQuantity = 5 });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private static Product NewProduct(Vendor vendor, Category category) => new()
        {
            VendorId = vendor.Id,
            CategoryId = category.Id,
            Name = $"p-{Guid.NewGuid():N}",
            NameAr = "منتج",
            Price = 10,
            StockQuantity = 10
        };

        // ===================================
        // الفئات الفرعية
        // ===================================
        [Fact]
        public async Task GetByCategory_RootIncludesAllDescendants()
        {
            var ids = (await _repository.GetByCategoryAsync(_root.Id)).Select(p => p.Id).ToHashSet();

            Assert.Equal(new HashSet<Guid> { _rootProduct.Id, _childProduct.Id, _grandchildProduct.Id }, ids);
        }

        [Fact]
        public async Task AdvancedFilter_ChildCategoryIncludesGrandchildrenOnly()
        {
            var result = await _repository.GetAdvancedFilteredAsync(categoryId: _child.Id);
            var ids = result.Items.Select(p => p.Id).ToHashSet();

            Assert.Equal(new HashSet<Guid> { _childProduct.Id, _grandchildProduct.Id }, ids);
            Assert.Equal(2, result.TotalCount);
        }

        // ===================================
        // المتاجر المعطّلة
        // ===================================
        [Fact]
        public async Task PublicListings_HideProductsOfInactiveStores()
        {
            Assert.DoesNotContain(await _repository.GetAllAsync(), p => p.Id == _inactiveStoreProduct.Id);
            Assert.DoesNotContain((await _repository.GetAdvancedFilteredAsync()).Items, p => p.Id == _inactiveStoreProduct.Id);
            Assert.Empty(await _repository.GetByVendorAsync(_inactiveStore.Id));
            Assert.Equal(0, await _repository.GetCountAsync(vendorId: _inactiveStore.Id));
        }

        [Fact]
        public async Task OwnerViews_StillSeeProductsOfInactiveStore()
        {
            Assert.Single(await _repository.GetByVendorAsync(_inactiveStore.Id, includeInactiveVendor: true));
            Assert.Equal(1, await _repository.GetCountAsync(vendorId: _inactiveStore.Id, publicOnly: false));
        }

        [Theory]
        [InlineData("VENDOR", true, true)]    // صاحب المتجر
        [InlineData("VENDOR", false, false)]  // بائع آخر
        [InlineData("ADMIN", false, true)]
        [InlineData("CUSTOMER", true, false)]
        public async Task CanManageVendor_OnlyOwnerOrStaff(string role, bool isOwner, bool expected)
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, (isOwner ? _ownerId : Guid.NewGuid()).ToString()),
                new Claim(ClaimTypes.Role, role),
            }, "test");
            var accessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } };

            Assert.Equal(expected, await new VendorAccessService(_context, accessor).CanManageVendorAsync(_inactiveStore.Id));
        }

        [Fact]
        public async Task CanManageVendor_AnonymousIsFalse()
        {
            var accessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };

            Assert.False(await new VendorAccessService(_context, accessor).CanManageVendorAsync(_inactiveStore.Id));
        }

        // ===================================
        // السلة
        // ===================================
        private CartService NewCartService()
        {
            var users = new Mock<IUserRepository>();
            users.Setup(u => u.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync(new User { FullName = "u", Role = "CUSTOMER" });

            return new CartService(new Mock<ICartRepository>().Object, _repository, users.Object,
                _context, new Mock<IPromotionService>().Object);
        }

        [Fact]
        public async Task AddToCart_ProductWithVariants_RequiresVariant()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => NewCartService().AddToCartAsync(
                Guid.NewGuid(), new AddToCartDto { ProductId = _variantProduct.Id, Quantity = 1 }));

            Assert.Contains("خيارات", ex.Message);
        }

        [Fact]
        public async Task AddToCart_InactiveStore_IsRejected()
        {
            var ex = await Assert.ThrowsAsync<Exception>(() => NewCartService().AddToCartAsync(
                Guid.NewGuid(), new AddToCartDto { ProductId = _inactiveStoreProduct.Id, Quantity = 1 }));

            Assert.Contains("المتجر", ex.Message);
        }
    }
}
