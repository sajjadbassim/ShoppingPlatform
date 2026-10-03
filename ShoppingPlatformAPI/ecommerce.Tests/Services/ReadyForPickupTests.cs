using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    // «جاهز للاستلام»: المتجر يحضّر ثم يعلن الجاهزية، والطلب الرئيسي يجهز حين تجهز كل متاجره
    public class ReadyForPickupTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Mock<INotificationService> _notify = new();
        private readonly Order _order;
        private readonly SubOrder _a, _b;
        private readonly Guid _vendorA = Guid.NewGuid(), _vendorB = Guid.NewGuid(), _user = Guid.NewGuid();

        public ReadyForPickupTests()
        {
            var customer = new User { Phone = "07701234567", FullName = "زبون", Email = "", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            var address = new Address { UserId = customer.Id, Label = "بيت", StreetAddress = "1", Area = "x", City = "بغداد", Phone = "07701234567" };
            _context.Users.Add(customer);
            _context.Addresses.Add(address);
            _order = new Order { OrderNumber = "ORD-1", CustomerId = customer.Id, AddressId = address.Id, Status = OrderStatus.CONFIRMED, PaymentMethod = "COD", PaymentStatus = "PENDING" };
            _a = new SubOrder { OrderId = _order.Id, VendorId = _vendorA, SubOrderNumber = "ORD-1-V1", Status = OrderStatus.CONFIRMED };
            _b = new SubOrder { OrderId = _order.Id, VendorId = _vendorB, SubOrderNumber = "ORD-1-V2", Status = OrderStatus.CONFIRMED };
            _context.Orders.Add(_order);
            _context.SubOrders.AddRange(_a, _b);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private VendorDashboardService Service() => new(_context, Mock.Of<IInventoryService>(), _notify.Object);

        private async Task<string> OrderStatusAsync() => (await _context.Orders.AsNoTracking().FirstAsync(o => o.Id == _order.Id)).Status;

        [Fact]
        public async Task Order_IsReady_OnlyWhenEveryStoreIsReady()
        {
            await Service().StartPreparingAsync(_vendorA, _a.Id, _user);
            Assert.Equal(OrderStatus.PREPARING, await OrderStatusAsync());

            await Service().MarkReadyAsync(_vendorA, _a.Id, _user);
            Assert.Equal(OrderStatus.PREPARING, await OrderStatusAsync());       // المتجر الثاني لم يجهز

            await Service().StartPreparingAsync(_vendorB, _b.Id, _user);
            await Service().MarkReadyAsync(_vendorB, _b.Id, _user);
            Assert.Equal(OrderStatus.READY, await OrderStatusAsync());

            // العمليات تُبلَّغ بكل «جاهز»، والزبون بتحوّل طلبه إلى «جاهز للاستلام»
            _notify.Verify(n => n.NotifySubOrderStatusChangedAsync(It.IsAny<Guid>(), It.IsAny<string>(), _order.Id, OrderStatus.READY, true), Times.Exactly(2));
            _notify.Verify(n => n.NotifyCustomerOrderStatusAsync(_order.CustomerId, _order.Id, "ORD-1", OrderStatus.READY), Times.Once);
            Assert.True(await _context.OrderStatusLogs.AnyAsync(l => l.OrderId == _order.Id && l.NewStatus == OrderStatus.READY));
        }

        [Fact]
        public async Task CannotSkipPreparing_NorTouchAnotherStoresOrder()
        {
            await Assert.ThrowsAsync<Exception>(() => Service().MarkReadyAsync(_vendorA, _a.Id, _user));
            await Assert.ThrowsAsync<Exception>(() => Service().StartPreparingAsync(_vendorB, _a.Id, _user));
            Assert.Equal(OrderStatus.CONFIRMED, (await _context.SubOrders.AsNoTracking().FirstAsync(s => s.Id == _a.Id)).Status);
        }

        [Fact]
        public async Task DoubleTap_IsHarmless()
        {
            await Service().StartPreparingAsync(_vendorA, _a.Id, _user);
            await Service().StartPreparingAsync(_vendorA, _a.Id, _user);
            Assert.Equal(1, await _context.OrderStatusLogs.CountAsync(l => l.SubOrderId == _a.Id && l.NewStatus == OrderStatus.PREPARING));
        }

        [Fact]
        public void PartialCancel_CustomerPaysOnlyForRemainingStores()
        {
            var order = new Order { Subtotal = 30000, DeliveryFees = 5000, DiscountAmount = 2000, TotalAmount = 33000 };
            var subs = new[]
            {
                new SubOrder { Subtotal = 20000, DeliveryFee = 3000, Status = OrderStatus.READY },
                new SubOrder { Subtotal = 10000, DeliveryFee = 2000, Status = OrderStatus.CANCELLED },
            };
            Assert.True(OrderTotals.Recalculate(order, subs));
            Assert.Equal(20000, order.Subtotal);
            Assert.Equal(3000, order.DeliveryFees);
            Assert.Equal(21000, order.TotalAmount);          // الخصم يبقى

            // الإلغاء الكامل يحتفظ بالإجماليات الأصلية للسجل
            var all = new Order { Subtotal = 1, DeliveryFees = 1, TotalAmount = 2 };
            Assert.False(OrderTotals.Recalculate(all, new[] { new SubOrder { Status = OrderStatus.CANCELLED } }));
            Assert.Equal(2, all.TotalAmount);
        }

        [Fact]
        public async Task VendorReject_OfOneStore_RecalculatesTheOrderTotal()
        {
            var o = await _context.Orders.FirstAsync(x => x.Id == _order.Id);
            o.Subtotal = 30000; o.DeliveryFees = 5000; o.TotalAmount = 35000;
            var a = await _context.SubOrders.FirstAsync(x => x.Id == _a.Id);
            a.Subtotal = 20000; a.DeliveryFee = 3000;
            var b = await _context.SubOrders.FirstAsync(x => x.Id == _b.Id);
            b.Subtotal = 10000; b.DeliveryFee = 2000; b.Status = OrderStatus.PENDING_CONFIRMATION;
            await _context.SaveChangesAsync();

            await Service().RejectOrderAsync(_vendorB, _b.Id, _user, "نفد المخزون");
            var after = await _context.Orders.AsNoTracking().FirstAsync(x => x.Id == _order.Id);
            Assert.Equal(23000, after.TotalAmount);
            Assert.Equal(OrderStatus.CONFIRMED, after.Status);
        }

        [Theory]
        [InlineData(new[] { "READY", "READY" }, "READY")]
        [InlineData(new[] { "READY", "PREPARING" }, "PREPARING")]
        [InlineData(new[] { "READY", "CONFIRMED" }, "PREPARING")]
        [InlineData(new[] { "READY", "CANCELLED" }, "READY")]
        [InlineData(new[] { "READY", "DELIVERED" }, "READY")]            // إعادة محاولة متجر بعد تسليم آخر
        [InlineData(new[] { "READY", "OUT_FOR_DELIVERY" }, "OUT_FOR_DELIVERY")]
        [InlineData(new[] { "CONFIRMED", "CONFIRMED" }, "CONFIRMED")]
        [InlineData(new[] { "CONFIRMED", "PENDING_CONFIRMATION" }, "PARTIALLY_CONFIRMED")]
        [InlineData(new[] { "DELIVERED", "DELIVERY_FAILED" }, "DELIVERED")]
        public void Rollup_DerivesTheMainOrderStatus(string[] subs, string expected)
            => Assert.Equal(expected, OrderStatusRollup.Compute(subs));
    }
}
