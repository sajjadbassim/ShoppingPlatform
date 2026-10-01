using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class NotificationLinkServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

        private readonly Guid _customer = Guid.NewGuid();
        private readonly Guid _vendorOwner = Guid.NewGuid();
        private readonly Guid _otherVendorOwner = Guid.NewGuid();
        private readonly Order _order;
        private readonly SubOrder _mySub;
        private readonly SubOrder _otherSub;

        public NotificationLinkServiceTests()
        {
            var myStore = new Vendor { Name = "A", OwnerId = _vendorOwner };
            var otherStore = new Vendor { Name = "B", OwnerId = _otherVendorOwner };
            _order = new Order { OrderNumber = "ORD-1", CustomerId = _customer };
            _mySub = new SubOrder { OrderId = _order.Id, VendorId = myStore.Id, SubOrderNumber = "ORD-1-V1" };
            _otherSub = new SubOrder { OrderId = _order.Id, VendorId = otherStore.Id, SubOrderNumber = "ORD-1-V2" };
            _context.AddRange(myStore, otherStore, _order, _mySub, _otherSub);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private Guid Notify(Guid userId, string data)
        {
            var n = new Notification { UserId = userId, Type = "order_status", Message = "m", Data = data };
            _context.Notifications.Add(n);
            _context.SaveChanges();
            return n.Id;
        }

        private Task<string?> Link(Guid id, Guid userId, string role) =>
            new NotificationLinkService(_context).GetLinkAsync(id, userId, role);

        [Fact]
        public async Task Customer_OpensOwnOrder()
        {
            var id = Notify(_customer, $"{{\"orderId\":\"{_order.Id}\",\"status\":\"DELIVERED\"}}");
            Assert.Equal("/orders/ORD-1", await Link(id, _customer, "CUSTOMER"));
        }

        [Fact]
        public async Task OldNotification_WithSubOrderOnly_ResolvesToOrder()
        {
            var ops = Guid.NewGuid();
            var id = Notify(ops, $"{{\"subOrderId\":\"{_mySub.Id}\",\"newStatus\":\"DELIVERED\"}}");
            Assert.Equal($"/operations/orders?order={_order.Id}", await Link(id, ops, "OPS"));
        }

        [Fact]
        public async Task Admin_GetsAdminOrderPage_AndReturnsPage()
        {
            var admin = Guid.NewGuid();
            Assert.Equal($"/admin/orders/{_order.Id}", await Link(Notify(admin, $"{{\"orderId\":\"{_order.Id}\"}}"), admin, "ADMIN"));
            Assert.Equal("/admin/returns", await Link(Notify(admin, $"{{\"returnId\":\"{Guid.NewGuid()}\"}}"), admin, "ADMIN"));
        }

        [Fact]
        public async Task Vendor_OpensOnlyOwnStoresSubOrder()
        {
            // إشعار بالطلب الرئيسي: يُفتح الطلب الفرعي الخاص بمتجر البائع وليس متجراً آخر
            var id = Notify(_vendorOwner, $"{{\"orderId\":\"{_order.Id}\"}}");
            Assert.Equal($"/vendor/orders?order={_mySub.Id}", await Link(id, _vendorOwner, "VENDOR"));

            // طلب فرعي لمتجر آخر: لا يُفتح، يذهب لقائمة الطلبات فقط
            var foreign = Notify(_vendorOwner, $"{{\"subOrderId\":\"{_otherSub.Id}\"}}");
            Assert.Equal("/vendor/orders", await Link(foreign, _vendorOwner, "VENDOR"));
        }

        [Fact]
        public async Task SomeoneElsesNotification_HasNoLink()
        {
            var id = Notify(_customer, $"{{\"orderId\":\"{_order.Id}\"}}");
            Assert.Null(await Link(id, Guid.NewGuid(), "CUSTOMER"));
        }

        [Fact]
        public async Task Customer_CannotOpenAnotherCustomersOrder()
        {
            var stranger = Guid.NewGuid();
            var id = Notify(stranger, $"{{\"orderId\":\"{_order.Id}\"}}");
            Assert.Null(await Link(id, stranger, "CUSTOMER"));
        }

        [Fact]
        public async Task GeneralNotification_WithoutData_HasNoLink()
        {
            var id = Notify(_customer, "");
            Assert.Null(await Link(id, _customer, "CUSTOMER"));
        }
    }
}
