using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Hubs;
using ecommerce.Services.DriverTrackingService;
using ecommerce.Services.OpsReportService;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class OpsTrackingAndReportTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Mock<IClientProxy> _opsClients = new();
        private readonly FakeTime _time = new(new DateTimeOffset(2026, 9, 30, 9, 0, 0, TimeSpan.Zero));

        public void Dispose() => _context.Dispose();

        private DriverTrackingService Tracking()
        {
            var clients = new Mock<IHubClients>();
            clients.Setup(c => c.Group("OpsTeam")).Returns(_opsClients.Object);
            var hub = new Mock<IHubContext<OpsHub>>();
            hub.Setup(h => h.Clients).Returns(clients.Object);
            return new DriverTrackingService(_context, hub.Object, _time);
        }

        private Driver AddDriver(string status = DriverStatus.Active)
        {
            var d = new Driver { FullName = "باسل", Phone = "0770", VehicleType = "motorcycle", Status = status };
            _context.Drivers.Add(d);
            _context.SaveChanges();
            return d;
        }

        // ===================================
        // رابط السائق وموقعه
        // ===================================
        [Fact]
        public async Task Link_StoresOnlyHash_AndNewLinkRevokesOld()
        {
            var driver = AddDriver();
            var first = await Tracking().CreateLinkAsync(driver.Id);
            var second = await Tracking().CreateLinkAsync(driver.Id);

            Assert.NotEqual(first.Token, driver.LocationTokenHash);
            Assert.Equal(DriverTrackingService.HashToken(second.Token), driver.LocationTokenHash);
            await Assert.ThrowsAsync<NotFoundException>(() => Tracking().GetByTokenAsync(first.Token));
            Assert.Equal("باسل", (await Tracking().GetByTokenAsync(second.Token)).DriverName);
        }

        [Fact]
        public async Task Location_IsSaved_AndBroadcastToOps()
        {
            var driver = AddDriver();
            var link = await Tracking().CreateLinkAsync(driver.Id);

            await Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = 32.5128, Longitude = 45.8182, Accuracy = 12 });

            Assert.Equal(32.5128, driver.LastLatitude);
            Assert.Equal(_time.GetUtcNow().UtcDateTime, driver.LastLocationAt);
            _opsClients.Verify(c => c.SendCoreAsync("DriverLocation", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Location_TooFrequent_IsIgnored()
        {
            var driver = AddDriver();
            var link = await Tracking().CreateLinkAsync(driver.Id);
            await Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = 32.5, Longitude = 45.8 });

            await Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = 33, Longitude = 46 });

            Assert.Equal(32.5, driver.LastLatitude);
            _opsClients.Verify(c => c.SendCoreAsync("DriverLocation", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(0, 0)]
        [InlineData(91, 45)]
        [InlineData(32, 181)]
        public async Task Location_Invalid_IsRejected(double lat, double lng)
        {
            var driver = AddDriver();
            var link = await Tracking().CreateLinkAsync(driver.Id);
            await Assert.ThrowsAsync<BusinessRuleException>(() =>
                Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = lat, Longitude = lng }));
        }

        [Fact]
        public async Task SuspendedDriver_CannotShareLocation()
        {
            var driver = AddDriver(status: "suspended");
            var link = await Tracking().CreateLinkAsync(driver.Id);
            await Assert.ThrowsAsync<ForbiddenException>(() =>
                Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = 32.5, Longitude = 45.8 }));
        }

        [Fact]
        public async Task Revoke_InvalidatesLink_AndClearsLocation()
        {
            var driver = AddDriver();
            var link = await Tracking().CreateLinkAsync(driver.Id);
            await Tracking().UpdateLocationAsync(link.Token, new DriverLocationUpdateDto { Latitude = 32.5, Longitude = 45.8 });

            await Tracking().RevokeLinkAsync(driver.Id);

            Assert.Null(driver.LastLatitude);
            Assert.Null(driver.LocationTokenHash);
            await Assert.ThrowsAsync<NotFoundException>(() => Tracking().GetByTokenAsync(link.Token));
        }

        // ===================================
        // التقارير
        // ===================================
        private SubOrder AddSub(DateTime createdUtc, string status, decimal subtotal, Vendor vendor, Guid? orderId = null,
            string? reason = null, DateTime? confirmedAt = null)
        {
            var order = orderId ?? Guid.NewGuid();
            if (orderId == null) _context.Orders.Add(new Order { Id = order, OrderNumber = "ORD-" + order.ToString()[..4], CreatedAt = createdUtc });
            var sub = new SubOrder
            {
                OrderId = order, VendorId = vendor.Id, Vendor = vendor, SubOrderNumber = "S", Status = status,
                Subtotal = subtotal, DeliveryFee = 5000, CreatedAt = createdUtc, CancellationReason = reason, ConfirmedAt = confirmedAt,
            };
            _context.SubOrders.Add(sub);
            _context.SaveChanges();
            return sub;
        }

        [Fact]
        public async Task Report_UsesIraqDays_AndComputesRates()
        {
            var vendor = new Vendor { Name = "Store", NameAr = "متجر" };
            _context.Vendors.Add(vendor);
            // 22:30 UTC يوم 28 = 01:30 فجر 29 بتوقيت العراق ⇒ يُحسب يوم 29
            var lateNight = new DateTime(2026, 9, 28, 22, 30, 0, DateTimeKind.Utc);
            AddSub(lateNight, OrderStatus.DELIVERED, 100000, vendor, confirmedAt: lateNight.AddMinutes(10));
            AddSub(new DateTime(2026, 9, 29, 10, 0, 0, DateTimeKind.Utc), OrderStatus.CANCELLED, 50000, vendor, reason: "نفد المخزون");
            // خارج الفترة (يوم 28 بتوقيت العراق) ⇒ الفترة السابقة
            AddSub(new DateTime(2026, 9, 28, 10, 0, 0, DateTimeKind.Utc), OrderStatus.DELIVERED, 70000, vendor);

            var report = await new OpsReportService(_context).GetReportAsync(new DateOnly(2026, 9, 29), new DateOnly(2026, 9, 29));

            Assert.Equal(2, report.Summary.Orders);
            Assert.Equal(1, report.Summary.Delivered);
            Assert.Equal(0.5, report.Summary.CancellationRate);
            Assert.Equal(105000, report.Summary.Revenue);          // منتجات + توصيل للمُسلّم فقط
            Assert.Equal(10, report.Summary.AvgConfirmMinutes);
            Assert.Equal(1, report.Hourly[1]);                     // الساعة 1 فجراً بتوقيت العراق
            Assert.Equal(1, report.PreviousSummary.Orders);
            Assert.Equal("نفد المخزون", Assert.Single(report.CancellationReasons).Reason);
            Assert.Equal("متجر", Assert.Single(report.Vendors).Name);
            Assert.Single(report.Daily);
        }

        [Fact]
        public async Task Report_RejectsInvalidRange()
        {
            var service = new OpsReportService(_context);
            await Assert.ThrowsAsync<BusinessRuleException>(() => service.GetReportAsync(new DateOnly(2026, 9, 30), new DateOnly(2026, 9, 1)));
            await Assert.ThrowsAsync<BusinessRuleException>(() => service.GetReportAsync(new DateOnly(2024, 1, 1), new DateOnly(2026, 1, 1)));
        }

        private sealed class FakeTime : TimeProvider
        {
            private DateTimeOffset _now;
            public FakeTime(DateTimeOffset now) => _now = now;
            public override DateTimeOffset GetUtcNow() => _now;
        }
    }
}
