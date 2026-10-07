using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // طلبات التاجر: القبول الجزئي، ملاحظة الزبون، الإرجاعات والكميات الخاصة لكل قطعة
    public class VendorOrderFeaturesTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<IInventoryService> _inventory = new();
        private readonly Mock<INotificationService> _notify = new();
        private readonly Vendor _store;
        private readonly Order _order;
        private readonly SubOrder _sub;
        private readonly SubOrderItem _shirt;
        private readonly SubOrderItem _shoes;

        public VendorOrderFeaturesTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _store = new Vendor { Name = "s", NameAr = "s", OwnerId = Guid.NewGuid(), IsActive = true };
            var customer = new User { Phone = "0770", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x" };
            var address = new Address { UserId = customer.Id, StreetAddress = "1", City = "بغداد", Phone = "0770" };
            _order = new Order
            {
                OrderNumber = "ORD-1", CustomerId = customer.Id, AddressId = address.Id, Status = OrderStatus.PENDING_CONFIRMATION,
                Subtotal = 40000, DeliveryFees = 3000, TotalAmount = 43000, CustomerNotes = "  اتصل قبل الوصول  "
            };
            _sub = new SubOrder { OrderId = _order.Id, VendorId = _store.Id, SubOrderNumber = "ORD-1-V1", Status = SubOrderStatus.PendingConfirmation, Subtotal = 40000, DeliveryFee = 3000 };
            _shirt = new SubOrderItem { SubOrderId = _sub.Id, ProductId = Guid.NewGuid(), ProductName = "قميص", Quantity = 2, UnitPrice = 10000, Subtotal = 20000 };
            _shoes = new SubOrderItem { SubOrderId = _sub.Id, ProductId = Guid.NewGuid(), ProductName = "حذاء", Quantity = 1, UnitPrice = 20000, Subtotal = 20000 };
            _context.AddRange(_store, customer, address, _order, _sub, _shirt, _shoes);
            _context.SaveChanges();
            _inventory.Setup(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<StockChange>());
        }

        public void Dispose() => _context.Dispose();

        private VendorDashboardService Service() => new(_context, _inventory.Object, _notify.Object);

        [Fact]
        public async Task PartialAccept_RemovesMissingPieces_RestocksAndRecalculatesTotals()
        {
            var result = await Service().ConfirmOrderAsync(_store.Id, _sub.Id, Guid.NewGuid(),
                new[] { new UnavailableItemDto { ItemId = _shirt.Id, Quantity = 1 } });

            Assert.Equal(SubOrderStatus.Confirmed, result.Status);
            var shirt = result.Items.Single(i => i.Id == _shirt.Id);
            Assert.Equal(1, shirt.Quantity);
            Assert.Equal(1, shirt.UnavailableQuantity);
            Assert.Equal(30000, result.Subtotal);

            var order = await _context.Orders.AsNoTracking().SingleAsync();
            Assert.Equal(30000, order.Subtotal);
            Assert.Equal(33000, order.TotalAmount);
            _inventory.Verify(i => i.RestockAsync(It.Is<IEnumerable<StockLineQuantity>>(l =>
                l.Single().ProductId == _shirt.ProductId && l.Single().Quantity == 1), It.IsAny<CancellationToken>()), Times.Once);
            _notify.Verify(n => n.NotifyCustomerAsync(_order.CustomerId, It.Is<string>(m => m.Contains("غير متوفرة") && m.Contains("33,000")), It.IsAny<object?>()), Times.Once);
        }

        [Fact]
        public async Task PartialAccept_AllPiecesMissing_MustRejectInstead()
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().ConfirmOrderAsync(_store.Id, _sub.Id, Guid.NewGuid(), new[]
            {
                new UnavailableItemDto { ItemId = _shirt.Id, Quantity = 2 },
                new UnavailableItemDto { ItemId = _shoes.Id, Quantity = 1 },
            }));
        }

        [Fact]
        public async Task PartialAccept_MoreThanOrdered_IsRejected() =>
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().ConfirmOrderAsync(_store.Id, _sub.Id, Guid.NewGuid(),
                new[] { new UnavailableItemDto { ItemId = _shirt.Id, Quantity = 3 } }));

        [Fact]
        public async Task FullAccept_ChangesNothingInTotals()
        {
            await Service().ConfirmOrderAsync(_store.Id, _sub.Id, Guid.NewGuid());

            Assert.Equal(43000, (await _context.Orders.AsNoTracking().SingleAsync()).TotalAmount);
            _inventory.Verify(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task OrderDetails_IncludeNotesAndReturnsOfThisStoreOnly()
        {
            var myProduct = new Product { Id = _shirt.ProductId, VendorId = _store.Id, Name = "قميص", NameAr = "قميص", Price = 1 };
            var otherProduct = new Product { VendorId = Guid.NewGuid(), Name = "x", NameAr = "x", Price = 1 };
            var approved = new Return { OrderId = _order.Id, ReturnNumber = "RET-1", Status = ReturnStatus.APPROVED, Reason = "defective", CustomerId = _order.CustomerId };
            var otherStore = new Return { OrderId = _order.Id, ReturnNumber = "RET-2", Status = ReturnStatus.APPROVED, Reason = "other", CustomerId = _order.CustomerId };
            _context.AddRange(myProduct, otherProduct, approved, otherStore,
                new ReturnItem { ReturnId = approved.Id, ProductId = myProduct.Id, Quantity = 1, ProductName = "قميص" },
                new ReturnItem { ReturnId = otherStore.Id, ProductId = otherProduct.Id, Quantity = 1, ProductName = "x" });
            _shirt.RefusedQuantity = 1;
            await _context.SaveChangesAsync();

            var dto = await Service().GetOrderByIdAsync(_store.Id, _sub.Id);

            Assert.Equal("اتصل قبل الوصول", dto.CustomerNotes);
            Assert.Equal("RET-1", Assert.Single(dto.Returns).ReturnNumber);
            var shirt = dto.Items.Single(i => i.Id == _shirt.Id);
            Assert.Equal(1, shirt.ReturnedQuantity);
            Assert.Equal(1, shirt.RefusedQuantity);
        }
    }
}
