using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Cart;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // السلة: حدود المخزون، المتغيرات، توفر المنتج والمتجر، وتحذيرات ما تغيّر بعد الإضافة
    public class CartServiceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IPromotionRepository> _promotions = new();
        private readonly User _customer;
        private readonly Vendor _store;
        private readonly Product _shirt;

        public CartServiceTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

            _customer = new User { Phone = "07701234567", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true, DeliveryFee = 2000 };
            _shirt = new Product { VendorId = _store.Id, Name = "shirt", NameAr = "قميص", Price = 10000, StockQuantity = 5, IsActive = true, IsAvailable = true };
            _context.AddRange(_customer, _store, _shirt);
            _context.SaveChanges();

            _promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>());
        }

        public void Dispose() => _context.Dispose();

        private CartService Service() => new(
            new CartRepository(_context), new ProductRepository(_context), new UserRepository(_context), _context, new PromotionService(_promotions.Object, _context));

        private Task<CartResponseDto> Add(Guid productId, int quantity, Guid? variantId = null) =>
            Service().AddToCartAsync(_customer.Id, new AddToCartDto { ProductId = productId, VariantId = variantId, Quantity = quantity });

        [Fact]
        public async Task Add_ComputesTotalsFromServerPrices()
        {
            var cart = await Add(_shirt.Id, 2);

            Assert.Equal(20000, cart.Subtotal);
            Assert.Equal(2000, cart.TotalDeliveryFees);
            Assert.Equal(22000, cart.TotalAmount);
        }

        [Fact]
        public async Task Add_MoreThanStock_IsRejected() =>
            await Assert.ThrowsAsync<BusinessRuleException>(() => Add(_shirt.Id, 6));

        [Fact]
        public async Task Add_SameProductTwice_CannotExceedStockInTotal()
        {
            await Add(_shirt.Id, 3);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Add(_shirt.Id, 3));
            var cart = await Service().GetCartAsync(_customer.Id);
            Assert.Equal(3, Assert.Single(cart.Items).Quantity);
        }

        [Fact]
        public async Task Add_FromInactiveStore_IsRejected()
        {
            _store.IsActive = false;
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Add(_shirt.Id, 1));
        }

        [Fact]
        public async Task Add_DeletedProduct_IsRejected()
        {
            _shirt.IsDeleted = true;
            await _context.SaveChangesAsync();

            await Assert.ThrowsAnyAsync<AppException>(() => Add(_shirt.Id, 1));
        }

        [Fact]
        public async Task Add_ProductWithVariants_RequiresChoosingVariant()
        {
            _context.ProductVariants.Add(new ProductVariant { ProductId = _shirt.Id, Sku = "M", StockQuantity = 3, IsAvailable = true });
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Add(_shirt.Id, 1));
        }

        [Fact]
        public async Task Add_VariantOfAnotherProduct_IsRejected()
        {
            var other = new Product { VendorId = _store.Id, Name = "o", NameAr = "o", Price = 1, StockQuantity = 1, IsActive = true, IsAvailable = true };
            var foreignVariant = new ProductVariant { ProductId = other.Id, Sku = "X", StockQuantity = 9, IsAvailable = true };
            _context.AddRange(other, foreignVariant);
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<NotFoundException>(() => Add(_shirt.Id, 1, foreignVariant.Id));
        }

        [Fact]
        public async Task Add_Variant_UsesVariantStockAndPriceAdjustment()
        {
            var large = new ProductVariant { ProductId = _shirt.Id, Sku = "L", StockQuantity = 2, IsAvailable = true, PriceAdjustment = 1500 };
            _context.ProductVariants.Add(large);
            await _context.SaveChangesAsync();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Add(_shirt.Id, 3, large.Id));
            var cart = await Add(_shirt.Id, 2, large.Id);

            Assert.Equal(23000, cart.Subtotal);   // 2 × (10000 + 1500)
        }

        [Fact]
        public async Task UpdateQuantity_AboveStock_IsRejected()
        {
            await Add(_shirt.Id, 1);

            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                Service().UpdateQuantityAsync(_customer.Id, new UpdateCartItemDto { ProductId = _shirt.Id, Quantity = 6 }));
        }

        [Fact]
        public async Task StockDroppedAfterAdding_ShowsWarning()
        {
            await Add(_shirt.Id, 4);
            _shirt.StockQuantity = 2;
            await _context.SaveChangesAsync();

            var cart = await Service().GetCartAsync(_customer.Id);

            Assert.Contains(cart.Warnings, w => w.Contains("الكمية المتوفرة فقط 2"));
        }
    }
}
