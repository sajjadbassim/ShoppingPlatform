using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InventoryService;
using ecommerce.Services.ReturnTripService;
using ecommerce.Services;
using ecommerce.Repositories;
using ecommerce.Services.FileService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    // تعذّر التسليم / الرفض عند الباب: البضاعة تعود مع السائق لمتجرها (مهمة إرجاع بأجرة صفر)،
    // والمتجر يؤكد الاستلام فيعود المخزون ويُغلق الجزء الفاشل
    public class ReturnTripServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Mock<IInventoryService> _inventory = new();
        private readonly List<StockLineQuantity> _restocked = new();
        private readonly Vendor _v1 = new() { Name = "A" };
        private readonly Vendor _v2 = new() { Name = "B" };
        private readonly Driver _driver = new() { FullName = "D", Phone = "0770", Status = DriverStatus.Active };
        private readonly User _customer = new() { Phone = "0790", FullName = "زبون", Role = UserRoles.Customer };
        private readonly Address _address;

        public ReturnTripServiceTests()
        {
            _address = new Address { UserId = _customer.Id, StreetAddress = "شارع 1", Area = "الكوت", City = "الكوت", Phone = "0790" };
            _context.AddRange(_v1, _v2, _driver, _customer, _address);
            _context.SaveChanges();
            _inventory.Setup(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>()))
                .Callback<IEnumerable<StockLineQuantity>, CancellationToken>((lines, _) => _restocked.AddRange(lines))
                .ReturnsAsync(new List<StockChange>());
        }

        public void Dispose() => _context.Dispose();
        private ReturnTripService Service() => new(_context, _inventory.Object);

        // طلب من متجرين: الأول سُلّم، والثاني تعذّر تسليمه وهو مع السائق
        private (Order order, SubOrder delivered, SubOrder failed) TwoStoreOrder(bool pickedUp = true)
        {
            var order = new Order { OrderNumber = "ORD-1", CustomerId = _customer.Id, AddressId = _address.Id, Status = OrderStatus.DELIVERY_FAILED, Subtotal = 30000, DeliveryFees = 4000, TotalAmount = 34000 };
            var delivered = new SubOrder { OrderId = order.Id, VendorId = _v1.Id, DriverId = _driver.Id, Status = OrderStatus.DELIVERED, Subtotal = 20000, DeliveryFee = 2000, SubOrderNumber = "V1",
                Items = new List<SubOrderItem> { new() { ProductId = Guid.NewGuid(), ProductName = "x", UnitPrice = 20000, Quantity = 1 } } };
            var failed = new SubOrder { OrderId = order.Id, VendorId = _v2.Id, DriverId = _driver.Id, Status = OrderStatus.DELIVERY_FAILED, Subtotal = 10000, DeliveryFee = 2000, SubOrderNumber = "V2",
                PickedUpAt = pickedUp ? DateTime.UtcNow : null,
                Items = new List<SubOrderItem> { new() { ProductId = Guid.NewGuid(), ProductName = "قميص", UnitPrice = 5000, Quantity = 2 } } };
            _context.Orders.Add(order);
            _context.SubOrders.AddRange(delivered, failed);
            _context.SaveChanges();
            return (order, delivered, failed);
        }

        [Fact]
        public async Task Failure_CreatesZeroFeeTripForFailedPartOnly_StoreReceipt_RestocksAndClosesPart()
        {
            var (order, _, failed) = TwoStoreOrder();

            await Service().CreateForFailureAsync(order.Id, _driver.Id, new[] { failed.Id }, DeliveryFailureReason.NoAnswer);

            var trip = await _context.ReturnTrips.Include(t => t.Items).SingleAsync();
            Assert.Equal(_v2.Id, trip.VendorId);
            Assert.Equal(ReturnTripStatus.WithDriver, trip.Status);
            Assert.Equal(0, trip.DeliveryFee);
            Assert.Equal(2, trip.Items.Single().Quantity);
            Assert.Empty(_restocked);   // البضاعة مع السائق — لا مخزون قبل وصولها

            await Service().ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), _v2.Id);

            Assert.Equal(2, _restocked.Single().Quantity);
            var sub = await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == failed.Id);
            Assert.Equal(OrderStatus.CANCELLED, sub.Status);
            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(OrderStatus.DELIVERED, saved.Status);   // ما بقي مسلّم
            Assert.Equal(22000, saved.TotalAmount);               // الزبون لا يدفع ما لم يستلمه

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), _v2.Id));
            Assert.Single(_restocked);   // مرة واحدة فقط
        }

        [Fact]
        public async Task DriverHistory_ListsAllReceivedTrips_AndOpenListExcludesThem()
        {
            var (order, _, failed) = TwoStoreOrder();
            await Service().CreateForFailureAsync(order.Id, _driver.Id, new[] { failed.Id }, DeliveryFailureReason.NoAnswer);
            var trip = await _context.ReturnTrips.SingleAsync();

            Assert.Empty(await Service().GetClosedForDriverAsync(_driver.Id));   // ما زالت مفتوحة
            Assert.Single(await Service().GetOpenForDriverAsync(_driver.Id));

            await Service().ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), _v2.Id);

            Assert.Empty(await Service().GetOpenForDriverAsync(_driver.Id));
            Assert.Equal(trip.Id, (await Service().GetClosedForDriverAsync(_driver.Id)).Single().Id);
            Assert.Empty(await Service().GetClosedForDriverAsync(Guid.NewGuid()));   // سجل سائق آخر
            Assert.Empty(await Service().GetClosedForDriverAsync(_driver.Id, 0));   // السقف
        }

        [Fact]
        public async Task OtherStore_CannotConfirmReceipt()
        {
            var (order, _, failed) = TwoStoreOrder();
            await Service().CreateForFailureAsync(order.Id, _driver.Id, new[] { failed.Id }, DeliveryFailureReason.CustomerRefused);
            var trip = await _context.ReturnTrips.SingleAsync();

            await Assert.ThrowsAsync<NotFoundException>(() => Service().ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), _v1.Id));
            Assert.Equal(1, await Service().CountOpenForDriverAsync(_driver.Id));
        }

        [Fact]
        public async Task FailureBeforePickup_GoodsNeverLeftStore_ClosedImmediately()
        {
            var (order, _, failed) = TwoStoreOrder(pickedUp: false);

            await Service().CreateForFailureAsync(order.Id, _driver.Id, new[] { failed.Id }, DeliveryFailureReason.Other);

            Assert.Equal(0, await Service().CountOpenForDriverAsync(_driver.Id));
            Assert.Single(_restocked);
            Assert.Equal(OrderStatus.CANCELLED, (await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == failed.Id)).Status);
        }

        [Fact]
        public async Task DoorRefusal_ReturnsOnlyRefusedItems_AndMarksReturnRestocked()
        {
            var (order, delivered, _) = TwoStoreOrder();
            var item = delivered.Items.Single();
            item.Quantity = 3; item.RefusedQuantity = 1;
            var refusal = new Return { ReturnNumber = "RET-1", OrderId = order.Id, Status = ReturnStatus.APPROVED, IsDoorRefusal = true, Reason = "defective" };
            _context.Returns.Add(refusal);
            await _context.SaveChangesAsync();

            await Service().CreateForRefusalAsync(order.Id, _driver.Id, refusal.Id, new[] { (item, 1) });
            var trip = await _context.ReturnTrips.Include(t => t.Items).SingleAsync();
            Assert.Equal(1, trip.Items.Single().Quantity);

            await Service().ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), null);   // العمليات نيابة عن المتجر

            Assert.Equal(1, _restocked.Single().Quantity);
            Assert.True((await _context.Returns.AsNoTracking().SingleAsync()).IsRestocked);
            Assert.Equal(OrderStatus.DELIVERED, (await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == delivered.Id)).Status);
        }

        // ===== إرجاع بعد الاستلام: السائق يأخذ القطع من الزبون، ولا خصم ولا ردّ مال قبل أن تصل للمتجر =====
        private Return ApprovedCustomerReturn(SubOrder delivered, string payer = RefusalFeePayer.Vendor)
        {
            var item = delivered.Items.Single();
            _context.Products.Add(new Product { Id = item.ProductId, VendorId = delivered.VendorId, Name = "x" });
            var ret = new Return { ReturnNumber = "RET-9", OrderId = delivered.OrderId, CustomerId = _customer.Id, Status = ReturnStatus.APPROVED,
                Reason = ReturnReason.DEFECTIVE, RefundAmount = 20000, PickupFeePayer = payer, PickupFeeAmount = 2000,
                Items = { new ReturnItem { ProductId = item.ProductId, ProductName = "x", Quantity = 1, UnitPrice = 20000 } } };
            _context.Returns.Add(ret);
            _context.SaveChanges();
            return ret;
        }

        private ReturnTripService ServiceWithFinance() =>
            new(_context, _inventory.Object, finance: new ecommerce.Services.FinanceService.FinanceService(_context));

        [Fact]
        public async Task CustomerReturn_DriverCollects_StoreReceives_ThenRestockAndVendorDeduction()
        {
            _driver.WorkStatus = DriverWorkStatus.Available; _context.SaveChanges();
            var (_, delivered, _) = TwoStoreOrder();
            var ret = ApprovedCustomerReturn(delivered);
            var service = ServiceWithFinance();

            await service.AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid());
            var trip = await _context.ReturnTrips.AsNoTracking().SingleAsync();
            Assert.Equal(ReturnTripStatus.AtCustomer, trip.Status);
            Assert.Equal(2000, trip.DeliveryFee);
            Assert.Equal(1, await service.CountOpenForDriverAsync(_driver.Id));   // لا ينهي دوامه قبلها

            // القطعة ما زالت عند الزبون: لا يؤكد المتجر استلامها
            await Assert.ThrowsAsync<BusinessRuleException>(() => service.ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), null));

            await service.CollectCustomerReturnAsync(_driver.Id, ret.Id);
            Assert.Equal(ReturnTripStatus.WithDriver, (await _context.ReturnTrips.AsNoTracking().SingleAsync()).Status);
            Assert.Null((await _context.Returns.AsNoTracking().SingleAsync()).ItemsReceivedAt);
            Assert.Empty(_context.VendorLedgerEntries);

            await service.ConfirmReceivedAsync(trip.Id, Guid.NewGuid(), _v1.Id);

            Assert.Equal(1, _restocked.Single().Quantity);   // يعود للمخزون دائماً
            Assert.NotNull((await _context.Returns.AsNoTracking().SingleAsync()).ItemsReceivedAt);
            var ledger = await _context.VendorLedgerEntries.AsNoTracking().ToListAsync();
            Assert.Equal(-20000, ledger.Single(e => e.Type == ecommerce.Services.FinanceService.LedgerType.Return).Amount);
            Assert.Equal(-2000, ledger.Single(e => e.Type == ecommerce.Services.FinanceService.LedgerType.ReturnPickupFee).Amount);
        }

        [Fact]
        public async Task CustomerReturn_PickupFailedOrUnassigned_GoesBackToAwaitingDriver()
        {
            _driver.WorkStatus = DriverWorkStatus.Available; _context.SaveChanges();
            var (_, delivered, _) = TwoStoreOrder();
            var ret = ApprovedCustomerReturn(delivered);

            await Service().AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid());
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid()));
            await Service().FailCustomerReturnPickupAsync(_driver.Id, ret.Id, "لا يرد");
            Assert.Empty(_context.ReturnTrips);

            await Service().AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid());
            await Service().UnassignCustomerReturnAsync(ret.Id, Guid.NewGuid());
            Assert.Empty(_context.ReturnTrips);
            Assert.Empty(_restocked);
        }

        [Fact]
        public async Task CustomerReturn_DriverOffline_CannotBeAssigned()
        {
            _driver.WorkStatus = DriverWorkStatus.Offline; _context.SaveChanges();
            var (_, delivered, _) = TwoStoreOrder();
            var ret = ApprovedCustomerReturn(delivered);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid()));
        }

        // ===== استثناء العمليات: من يتحمّل أجرة استلام هذا المرتجع (قبل وصول القطع للمتجر) =====
        private ReturnService Returns() => new(new ReturnRepository(_context), Mock.Of<IFileService>(), _context, Mock.Of<INotificationService>());

        [Fact]
        public async Task PickupFeeOverride_RecalculatesRefundAndOpenTrip_UntilItemsReceived()
        {
            _driver.WorkStatus = DriverWorkStatus.Available; _context.SaveChanges();
            var (_, delivered, _) = TwoStoreOrder();
            var ret = ApprovedCustomerReturn(delivered, RefusalFeePayer.Customer);
            ret.RefundAmount = 18000;   // 20,000 − أجرة الاستلام 2,000 على الزبون
            _context.SaveChanges();
            await Service().AssignCustomerReturnAsync(ret.Id, _driver.Id, Guid.NewGuid());

            await Assert.ThrowsAsync<BusinessRuleException>(() => Returns().SetPickupFeePayerAsync(ret.Id, RefusalFeePayer.Vendor, " ", Guid.NewGuid()));

            // القطعة معيبة: الأجرة على المتجر، ويُردّ للزبون ثمنها كاملاً
            var dto = await Returns().SetPickupFeePayerAsync(ret.Id, RefusalFeePayer.Vendor, "القطعة معيبة", Guid.NewGuid());
            Assert.Equal((RefusalFeePayer.Vendor, 2000m, 20000m), (dto.PickupFeePayer, dto.PickupFeeAmount, dto.RefundAmount));
            Assert.Equal("القطعة معيبة", dto.PickupFeeOverrideReason);

            // على المنصة: لا أجرة على أحد، ومهمة السائق بلا أجرة
            await Returns().SetPickupFeePayerAsync(ret.Id, RefusalFeePayer.None, "تعويض", Guid.NewGuid());
            Assert.Equal(0, (await _context.ReturnTrips.AsNoTracking().SingleAsync()).DeliveryFee);
            var saved = await _context.Returns.AsNoTracking().SingleAsync();
            Assert.Equal((0m, 20000m), (saved.PickupFeeAmount, saved.RefundAmount));

            // وصلت القطع للمتجر: سُجّلت الحسابات فلا تغيير بعدها
            var tracked = await _context.Returns.SingleAsync();
            tracked.ItemsReceivedAt = DateTime.UtcNow;
            _context.SaveChanges();
            await Assert.ThrowsAsync<BusinessRuleException>(() => Returns().SetPickupFeePayerAsync(ret.Id, RefusalFeePayer.Customer, "x", Guid.NewGuid()));
        }
    }
}
