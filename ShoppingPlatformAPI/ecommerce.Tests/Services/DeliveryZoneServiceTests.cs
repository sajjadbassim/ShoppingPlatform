using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class DeliveryZoneServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

        private readonly User _customer;
        private readonly Vendor _a, _b;
        private readonly DeliveryZone _karada, _closed;

        public DeliveryZoneServiceTests()
        {
            _customer = new User { Phone = "07701234567", FullName = "زبون", Email = "", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _a = new Vendor { Name = "متجر أ", OwnerId = _customer.Id, DeliveryFee = 3000, IsActive = true };
            _b = new Vendor { Name = "متجر ب", OwnerId = _customer.Id, DeliveryFee = 5000, IsActive = true };
            _karada = new DeliveryZone { Name = "الكرادة", Fee = 2000 };
            _closed = new DeliveryZone { Name = "مغلقة", Fee = 1000, IsActive = false };
            _context.Users.Add(_customer);
            _context.Vendors.AddRange(_a, _b);
            _context.DeliveryZones.AddRange(_karada, _closed);
            _context.DeliverySettings.Add(new DeliverySettings());
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private DeliveryZoneService Service() => new(_context);

        private void Cart(params Vendor[] vendors)
        {
            var cart = new Cart { UserId = _customer.Id };
            _context.Carts.Add(cart);
            foreach (var v in vendors)
            {
                var p = new Product { Name = "منتج", VendorId = v.Id, Price = 1000, IsActive = true };
                _context.Products.Add(p);
                _context.CartItems.Add(new CartItem { CartId = cart.Id, ProductId = p.Id, Quantity = 1 });
            }
            _context.SaveChanges();
        }

        private Address AddressIn(DeliveryZone? zone)
        {
            var a = new Address { UserId = _customer.Id, Label = "بيت", StreetAddress = "1", Area = "x", City = "بغداد", Phone = "07701234567", ZoneId = zone?.Id };
            _context.Addresses.Add(a); _context.SaveChanges();
            return a;
        }

        [Fact]
        public async Task Off_EveryStoreKeepsItsFixedFee()
        {
            Cart(_a, _b);
            var q = await Service().QuoteAsync(_customer.Id, AddressIn(_karada).Id, null);
            Assert.Equal(8000, q.Total);
            Assert.All(q.Vendors, l => Assert.False(l.ByZone));
            Assert.Null(q.ZoneName);
        }

        [Fact]
        public async Task All_ZoneFeeReplacesEveryStoreFee()
        {
            Cart(_a, _b);
            await Service().SetModeAsync(new SetZonesModeDto { Mode = "all" }, _customer.Id);
            var q = await Service().QuoteAsync(_customer.Id, AddressIn(_karada).Id, null);
            Assert.Equal(4000, q.Total);
            Assert.Equal("الكرادة", q.ZoneName);
        }

        [Fact]
        public async Task Selected_OnlyChosenStoresUseTheZone()
        {
            Cart(_a, _b);
            await Service().SetModeAsync(new SetZonesModeDto { Mode = ZonesMode.Selected, VendorIds = new() { _a.Id } }, _customer.Id);
            var q = await Service().QuoteAsync(_customer.Id, AddressIn(_karada).Id, null);
            Assert.Equal(2000, q.Vendors.Single(l => l.VendorId == _a.Id).Fee);
            Assert.Equal(5000, q.Vendors.Single(l => l.VendorId == _b.Id).Fee);
            Assert.Equal(7000, q.Total);

            var pub = await Service().GetPublicAsync();
            Assert.True(pub.Enabled);
            Assert.Equal(new[] { _a.Id }, pub.VendorIds);
            Assert.DoesNotContain(pub.Zones, z => z.Name == "مغلقة");
        }

        [Fact]
        public async Task AddressWithoutZone_OrInactiveZone_UsesStoreFixedFee()
        {
            Cart(_a);
            await Service().SetModeAsync(new SetZonesModeDto { Mode = ZonesMode.All }, _customer.Id);
            Assert.Equal(3000, (await Service().QuoteAsync(_customer.Id, AddressIn(null).Id, null)).Total);
            Assert.Equal(3000, (await Service().QuoteAsync(_customer.Id, AddressIn(_closed).Id, null)).Total);
        }

        [Fact]
        public async Task Quote_RejectsSomeoneElsesAddress()
        {
            var other = new Address { UserId = Guid.NewGuid(), Label = "x", StreetAddress = "1", Area = "x", City = "x", Phone = "x" };
            _context.Addresses.Add(other); _context.SaveChanges();
            await Assert.ThrowsAsync<ForbiddenException>(() => Service().QuoteAsync(_customer.Id, other.Id, null));
        }

        [Fact]
        public async Task Zones_NameIsUnique_FeeValidated_DeleteKeepsAddresses()
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(new SaveDeliveryZoneDto { Name = " الكرادة ", Fee = 1 }));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().CreateAsync(new SaveDeliveryZoneDto { Name = "المنصور", Fee = -5 }));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetModeAsync(new SetZonesModeDto { Mode = "SOME" }, _customer.Id));

            var addr = AddressIn(_karada);
            await Service().DeleteAsync(_karada.Id);
            Assert.Null((await _context.Addresses.FindAsync(addr.Id))!.ZoneId);
        }

        [Fact]
        public void Rules_CoverExactlyTheConfiguredStores()
        {
            _a.UseDeliveryZones = true;
            var selected = new DeliveryFeeRules { Mode = ZonesMode.Selected, Zone = _karada };
            Assert.Equal(2000, selected.FeeFor(_a));
            Assert.Equal(5000, selected.FeeFor(_b));
            Assert.Equal(3000, new DeliveryFeeRules { Mode = ZonesMode.Off, Zone = _karada }.FeeFor(_a));
        }
    }
}
