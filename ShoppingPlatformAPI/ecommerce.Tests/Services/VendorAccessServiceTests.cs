using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.VendorAccessService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class VendorAccessServiceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Guid _ownerId = Guid.NewGuid();
        private readonly Guid _otherOwnerId = Guid.NewGuid();

        private readonly Vendor _myStore;
        private readonly Vendor _otherStore;
        private readonly Product _myProduct;
        private readonly Product _otherProduct;
        private readonly ProductImage _otherImage;
        private readonly ProductAttribute _otherAttribute;
        private readonly ProductAttributeValue _otherValue;
        private readonly ProductVariant _otherVariant;

        public VendorAccessServiceTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _myStore = new Vendor { Name = "متجري", NameAr = "متجري", OwnerId = _ownerId };
            _otherStore = new Vendor { Name = "متجر آخر", NameAr = "متجر آخر", OwnerId = _otherOwnerId };
            _myProduct = new Product { VendorId = _myStore.Id, Name = "p1", NameAr = "p1", Price = 1 };
            _otherProduct = new Product { VendorId = _otherStore.Id, Name = "p2", NameAr = "p2", Price = 1 };
            _otherImage = new ProductImage { ProductId = _otherProduct.Id, ImageUrl = "/x.png" };
            _otherAttribute = new ProductAttribute { ProductId = _otherProduct.Id, Name = "Size", NameAr = "المقاس" };
            _otherValue = new ProductAttributeValue { AttributeId = _otherAttribute.Id, Value = "L", ValueAr = "كبير" };
            _otherVariant = new ProductVariant { ProductId = _otherProduct.Id, Sku = "V1" };

            _context.AddRange(_myStore, _otherStore, _myProduct, _otherProduct, _otherImage, _otherAttribute, _otherValue, _otherVariant);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private VendorAccessService As(string role, Guid? userId = null)
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, (userId ?? _ownerId).ToString()),
                new Claim(ClaimTypes.Role, role),
            }, "test");
            var accessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } };
            return new VendorAccessService(_context, accessor);
        }

        // ===================================
        // المتجر وطلباته
        // ===================================
        [Fact]
        public async Task Owner_CanManage_OwnStore()
        {
            await As("VENDOR").EnsureCanManageVendorAsync(_myStore.Id);
        }

        [Fact]
        public async Task Vendor_CannotAccess_AnotherStore()
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => As("VENDOR").EnsureCanManageVendorAsync(_otherStore.Id));
        }

        [Fact]
        public async Task Customer_CannotManage_EvenOwnedStoreId()
        {
            // الدور هو المعيار: زبون لا يدير متجراً حتى لو طابق المعرّف
            await Assert.ThrowsAsync<ForbiddenException>(() => As("CUSTOMER").EnsureCanManageVendorAsync(_myStore.Id));
        }

        [Theory]
        [InlineData("ADMIN")]
        [InlineData("OPS")]
        public async Task Staff_CanManage_AnyStore(string role)
        {
            await As(role, Guid.NewGuid()).EnsureCanManageVendorAsync(_otherStore.Id);
        }

        [Fact]
        public async Task UnknownStore_IsNotFound()
        {
            await Assert.ThrowsAsync<NotFoundException>(() => As("VENDOR").EnsureCanManageVendorAsync(Guid.NewGuid()));
        }

        // ===================================
        // المنتجات والصور
        // ===================================
        [Fact]
        public async Task Owner_CanManage_OwnProduct()
        {
            await As("VENDOR").EnsureCanManageProductAsync(_myProduct.Id);
        }

        [Fact]
        public async Task Vendor_CannotManage_AnotherStoresProduct()
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => As("VENDOR").EnsureCanManageProductAsync(_otherProduct.Id));
        }

        [Fact]
        public async Task Vendor_CannotDelete_AnotherStoresImage()
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => As("VENDOR").EnsureCanManageProductImageAsync(_otherImage.Id));
        }

        // ===================================
        // المتغيرات: العنصر يجب أن يتبع المنتج المذكور في الرابط
        // ===================================
        [Fact]
        public async Task OwnProductInRoute_WithAnotherProductsAttribute_IsRejected()
        {
            await Assert.ThrowsAsync<NotFoundException>(() =>
                As("VENDOR").EnsureCanManageAttributeAsync(_myProduct.Id, _otherAttribute.Id));
        }

        [Fact]
        public async Task OwnProductInRoute_WithAnotherProductsVariant_IsRejected()
        {
            await Assert.ThrowsAsync<NotFoundException>(() =>
                As("VENDOR").EnsureCanManageVariantAsync(_myProduct.Id, _otherVariant.Id));
        }

        [Fact]
        public async Task Vendor_CannotDelete_AnotherStoresAttributeValue()
        {
            await Assert.ThrowsAsync<ForbiddenException>(() =>
                As("VENDOR").EnsureCanManageAttributeValueAsync(_otherProduct.Id, _otherAttribute.Id, _otherValue.Id));
        }

        [Fact]
        public async Task OtherOwner_CanManage_TheirVariant()
        {
            await As("VENDOR", _otherOwnerId).EnsureCanManageVariantAsync(_otherProduct.Id, _otherVariant.Id);
        }
    }
}
