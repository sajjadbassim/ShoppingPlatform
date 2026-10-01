using ecommerce.Core.Constants;
using ecommerce.Core.DTO.OrderRating;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.OrderRatingService;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    // تقييم التجربة وتقييم المتاجر مستقلان: أي منهما يمكن إرساله وحده، وبأي ترتيب
    public class OrderRatingSplitTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Guid _customer = Guid.NewGuid();
        private readonly Order _order;
        private readonly SubOrder _sub1, _sub2;
        private readonly Driver _driver;

        public OrderRatingSplitTests()
        {
            var v1 = new Vendor { Name = "A" }; var v2 = new Vendor { Name = "B" };
            _driver = new Driver { FullName = "باسل", Phone = "0780" };
            _order = new Order { OrderNumber = "ORD-1", CustomerId = _customer, Status = OrderStatus.DELIVERED };
            // نفس السائق أوصل من المتجرين
            _sub1 = new SubOrder { OrderId = _order.Id, VendorId = v1.Id, Vendor = v1, SubOrderNumber = "V1", DriverId = _driver.Id };
            _sub2 = new SubOrder { OrderId = _order.Id, VendorId = v2.Id, Vendor = v2, SubOrderNumber = "V2", DriverId = _driver.Id };
            _context.AddRange(new User { Id = _customer }, _driver, v1, v2, _order, _sub1, _sub2);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();
        private OrderRatingService Service() => new(_context);
        private static CreateSubOrderRatingDto Store(Guid sub, int stars, int? driver = null) =>
            new() { SubOrderId = sub, VendorRating = stars, DriverRating = driver };

        [Fact]
        public async Task Experience_Alone_DoesNotRateStores()
        {
            await Service().CreateRatingAsync(_order.Id, _customer, new CreateOrderRatingDto { DeliveryRating = 5 });

            var status = await Service().GetRatingStatusAsync(_order.Id, _customer);
            Assert.True(status.HasRated);
            Assert.Empty(status.RatedSubOrderIds);
        }

        [Fact]
        public async Task Stores_Alone_DoNotCountAsExperienceRating()
        {
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub1.Id, 4) });

            var status = await Service().GetRatingStatusAsync(_order.Id, _customer);
            Assert.False(status.HasRated);
            Assert.Equal(new[] { _sub1.Id }, status.RatedSubOrderIds);
            Assert.Null((await _context.OrderRatings.SingleAsync()).DeliveryRating);
        }

        [Fact]
        public async Task StoresFirst_ThenExperience_ThenAnotherStore_AllOnOneRecord()
        {
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub1.Id, 4) });
            await Service().CreateRatingAsync(_order.Id, _customer, new CreateOrderRatingDto { DeliveryRating = 3 });
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub2.Id, 5) });

            var rating = await _context.OrderRatings.Include(r => r.SubOrderRatings).SingleAsync();
            Assert.Equal(3, rating.DeliveryRating);
            Assert.Equal(2, rating.SubOrderRatings.Count);
        }

        [Fact]
        public async Task SameStoreTwice_IsRejected_AndExperienceTwice_IsRejected()
        {
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub1.Id, 4) });
            await Assert.ThrowsAsync<Exception>(() => Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub1.Id, 2) }));

            await Service().CreateRatingAsync(_order.Id, _customer, new CreateOrderRatingDto { DeliveryRating = 5 });
            await Assert.ThrowsAsync<Exception>(() => Service().CreateRatingAsync(_order.Id, _customer, new CreateOrderRatingDto { DeliveryRating = 1 }));
        }

        [Fact]
        public async Task DriverRatingZero_MeansNotRated()
        {
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new() { Store(_sub1.Id, 4, driver: 0) });
            Assert.Null((await _context.SubOrderRatings.SingleAsync()).DriverRating);
        }

        [Fact]
        public async Task AnotherCustomer_CannotRate()
        {
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                Service().AddStoreRatingsAsync(_order.Id, Guid.NewGuid(), new() { Store(_sub1.Id, 4) }));
        }

        // ===== تقييم السائق: مرة واحدة لكل سائق =====
        private static DriverRatingInputDto Drv(Guid id, int stars) => new() { DriverId = id, Rating = stars };

        [Fact]
        public async Task SameDriverForTwoStores_RatedOnce_AndAverageUpdated()
        {
            await Service().AddStoreRatingsAsync(_order.Id, _customer, new(), new() { Drv(_driver.Id, 4) });

            Assert.Equal(1, await _context.OrderDriverRatings.CountAsync());
            Assert.Equal(4m, (await _context.Drivers.AsNoTracking().SingleAsync()).Rating);
            var status = await Service().GetRatingStatusAsync(_order.Id, _customer);
            Assert.Equal(new[] { _driver.Id }, status.RatedDriverIds);
            Assert.Empty(status.RatedSubOrderIds);

            // مرة ثانية مرفوضة من مسار المتاجر، ومتجاهَلة مع تقييم التجربة
            await Assert.ThrowsAsync<Exception>(() => Service().AddStoreRatingsAsync(_order.Id, _customer, new(), new() { Drv(_driver.Id, 1) }));
            await Service().CreateRatingAsync(_order.Id, _customer, new CreateOrderRatingDto { DeliveryRating = 5, DriverRatings = { Drv(_driver.Id, 1) } });
            Assert.Equal(1, await _context.OrderDriverRatings.CountAsync());
            Assert.Equal(4m, (await _context.Drivers.AsNoTracking().SingleAsync()).Rating);
        }

        [Fact]
        public async Task DriverNotInOrder_IsRejected()
        {
            await Assert.ThrowsAsync<Exception>(() => Service().AddStoreRatingsAsync(_order.Id, _customer, new(), new() { Drv(Guid.NewGuid(), 5) }));
            Assert.Empty(_context.OrderDriverRatings);
        }

        [Fact]
        public async Task NothingToRate_IsRejected()
        {
            await Assert.ThrowsAsync<Exception>(() => Service().AddStoreRatingsAsync(_order.Id, _customer, new(), new()));
        }
    }
}
