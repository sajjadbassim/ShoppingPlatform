using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services;
using ecommerce.Services.DriverAppService;
using ecommerce.Services.DriverTrackingService;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ecommerce.Tests.Services
{
    public class DriverAppServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Mock<IOpsService> _ops = new();

        private readonly User _driverUser = new() { Phone = "0770", Role = UserRoles.Driver, IsActive = true };
        private readonly Driver _driver;
        private readonly Driver _otherDriver = new() { FullName = "B", Phone = "0771", Status = DriverStatus.Active };
        private readonly Vendor _v1 = new() { Name = "A" };
        private readonly Vendor _v2 = new() { Name = "B" };

        public DriverAppServiceTests()
        {
            _driver = new Driver { FullName = "A", Phone = "0770", Status = DriverStatus.Active, UserId = _driverUser.Id };
            _context.AddRange(_driverUser, _driver, _otherDriver, _v1, _v2);
            _context.SaveChanges();

            // التسليم الفعلي (سجلات/نقاط/حالة الطلب) مسؤولية OpsService — هنا نحاكي أثره فقط
            _ops.Setup(o => o.MarkDeliveredByDriverAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()))
                .Returns<Guid, Guid, Guid>(async (orderId, driverId, _) =>
                {
                    var subs = _context.SubOrders.Where(s => s.OrderId == orderId && s.DriverId == driverId && s.Status == OrderStatus.OUT_FOR_DELIVERY).ToList();
                    subs.ForEach(s => s.Status = OrderStatus.DELIVERED);
                    await _context.SaveChangesAsync();
                    var order = _context.Orders.Single(o => o.Id == orderId);
                    if (_context.SubOrders.Where(s => s.OrderId == orderId).All(s => s.Status == OrderStatus.DELIVERED))
                        order.Status = OrderStatus.DELIVERED;
                    await _context.SaveChangesAsync();
                    return subs;
                });
        }

        // الاستلام من المتجر (OpsService): الجزء المعيَّن «جاهز» يصير «في الطريق»
        private void SetupPickUp() =>
            _ops.Setup(o => o.MarkPickedUpByDriverAsync(It.IsAny<SubOrder>(), It.IsAny<Guid>()))
                .Returns<SubOrder, Guid>(async (s, _) =>
                {
                    s.PickedUpAt = DateTime.UtcNow;
                    s.Status = OrderStatus.OUT_FOR_DELIVERY;
                    await _context.SaveChangesAsync();
                });

        private void SetupFail() =>
            _ops.Setup(o => o.MarkFailedByDriverAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
                .Returns<Guid, Guid, Guid, string, string?>(async (orderId, driverId, _, reason, _) =>
                {
                    var subs = _context.SubOrders.Where(x => x.OrderId == orderId && x.DriverId == driverId).ToList();
                    subs.ForEach(x => { x.Status = OrderStatus.DELIVERY_FAILED; x.FailureReason = reason; });
                    await _context.SaveChangesAsync();
                    return subs;
                });

        private void SetPayer(string payer)
        {
            _context.DeliverySettings.Add(new DeliverySettings { RefusalFeePayer = payer });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();
        private DriverAppService Service() => new(_context, _ops.Object, Mock.Of<IDriverTrackingService>());

        private Order AddOrder(decimal total, params (Vendor vendor, Driver driver, decimal subtotal)[] parts)
        {
            var customer = new User { Phone = Guid.NewGuid().ToString("N")[..10], Role = UserRoles.Customer };
            var address = new Address { UserId = customer.Id, StreetAddress = "شارع 1", City = "بغداد", Phone = "0790" };
            _context.AddRange(customer, address);
            var order = new Order { OrderNumber = $"ORD-{Guid.NewGuid():N}"[..12], CustomerId = customer.Id, AddressId = address.Id, TotalAmount = total, PaymentMethod = PaymentMethods.COD, PaymentStatus = PaymentStatus.Pending, Status = OrderStatus.OUT_FOR_DELIVERY };
            _context.Orders.Add(order);
            foreach (var (vendor, driver, subtotal) in parts)
                _context.SubOrders.Add(new SubOrder { OrderId = order.Id, VendorId = vendor.Id, DriverId = driver.Id, Subtotal = subtotal, Status = OrderStatus.OUT_FOR_DELIVERY, SubOrderNumber = "S", AssignedAt = DateTime.UtcNow, PickedUpAt = DateTime.UtcNow });
            _context.SaveChanges();
            return order;
        }

        [Fact]
        public async Task Orders_ShowOnlyMine_GroupedByOrder()
        {
            var mine = AddOrder(50_000, (_v1, _driver, 20_000), (_v2, _driver, 25_000));
            AddOrder(10_000, (_v1, _otherDriver, 10_000));

            var orders = await Service().GetOrdersAsync(_driverUser.Id, history: false);

            var o = Assert.Single(orders);
            Assert.Equal(mine.Id, o.OrderId);
            Assert.Equal(2, o.Stores.Count);
            Assert.Equal(50_000, o.AmountToCollect); // الطلب كاملاً معه: الإجمالي بعد الخصم
        }

        [Fact]
        public async Task SplitOrder_CollectsOnlyOwnPart()
        {
            AddOrder(50_000, (_v1, _driver, 20_000), (_v2, _otherDriver, 25_000));
            var o = Assert.Single(await Service().GetOrdersAsync(_driverUser.Id, history: false));
            Assert.Equal(20_000, o.AmountToCollect);
        }

        [Fact]
        public async Task SameDriver_SeparateTrips_LastTripCollectsOnlyItsPart()
        {
            // ORD-20261011-0002: ثلاثة متاجر، نفس السائق، ثلاث رحلات — آخر رحلة كانت تطلب إجمالي الطلب مرة ثانية
            var v3 = new Vendor { Name = "C" };
            _context.Vendors.Add(v3);
            var order = AddOrder(90_500, (_v1, _driver, 42_700), (_v2, _driver, 27_100), (v3, _driver, 11_700));
            order.DeliveryFees = 9_000;
            var subs = _context.SubOrders.Where(s => s.OrderId == order.Id).ToList();
            foreach (var s in subs) { s.DeliveryFee = 3_000; s.Status = OrderStatus.READY; s.DriverId = null; }
            _context.SaveChanges();

            var collected = new List<decimal>();
            foreach (var trip in subs)
            {
                trip.DriverId = _driver.Id;
                trip.Status = OrderStatus.OUT_FOR_DELIVERY;
                _context.SaveChanges();
                var o = Assert.Single(await Service().GetOrdersAsync(_driverUser.Id, history: false));
                collected.Add(o.AmountToCollect);
                await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });
            }

            Assert.Equal(new decimal[] { 45_700, 30_100, 14_700 }, collected);
            Assert.Equal(90_500, (await Service().GetProfileAsync(_driverUser.Id)).CashInHand);
            Assert.Equal(PaymentStatus.Paid, (await _context.Orders.AsNoTracking().SingleAsync(x => x.Id == order.Id)).PaymentStatus);
        }

        [Fact]
        public async Task Deliver_Cod_RequiresCashConfirmation_ThenRecordsCashAndPaid()
        {
            var order = AddOrder(30_000, (_v1, _driver, 28_000));

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = false }));
            _ops.Verify(o => o.MarkDeliveredByDriverAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(30_000, saved.CashCollectedAmount);
            Assert.Equal(_driver.Id, saved.CashCollectedByDriverId);
            Assert.Equal(PaymentStatus.Paid, saved.PaymentStatus);
            Assert.Equal(30_000, (await Service().GetProfileAsync(_driverUser.Id)).CashInHand);
        }

        [Fact]
        public async Task Deliver_BeforePickup_IsRejected()
        {
            var order = AddOrder(30_000, (_v1, _driver, 28_000));
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            sub.PickedUpAt = null;
            sub.Status = OrderStatus.READY;   // التعيين يُبقيه «جاهز» حتى الاستلام
            _context.SaveChanges();
            SetupPickUp();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true }));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.NoAnswer }));
            _ops.Verify(o => o.MarkDeliveredByDriverAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);

            await Service().PickUpAsync(_driverUser.Id, sub.Id);
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });
        }

        [Fact]
        public async Task SplitOrder_EachDriverHoldsOnlyTheirOwnCash()
        {
            // 20,000 مع السائق الأول و25,000 مع الثاني — كلٌّ يُحاسَب على ما جمعه هو
            var order = AddOrder(45_000, (_v1, _driver, 20_000), (_v2, _otherDriver, 25_000));
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });

            var otherUser = new User { Phone = "0771", Role = UserRoles.Driver, IsActive = true };
            _context.Users.Add(otherUser);
            _otherDriver.UserId = otherUser.Id;
            _context.SaveChanges();
            await Service().DeliverAsync(otherUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });

            Assert.Equal(20_000, (await Service().GetCashAsync(_driver.Id)).Total);
            Assert.Equal(25_000, (await Service().GetCashAsync(_otherDriver.Id)).Total);
            Assert.Equal(1, (await Service().SettleCashAsync(_driver.Id, Guid.NewGuid(), 20_000)).Orders);
            Assert.Equal(25_000, (await Service().GetCashAsync(_otherDriver.Id)).Total);   // تسوية الأول لا تمسّ نقد الثاني

            // ملخص الأدمن: من سوّى نقده يختفي، ويبقى الآخر بمبلغه
            var custody = Assert.Single(await Service().GetCashCustodyAsync());
            Assert.Equal((_otherDriver.Id, 25_000m, 1), (custody.DriverId, custody.Total, custody.Orders));
        }

        [Fact]
        public async Task SettleCash_RefusesWhenAmountChangedSinceShown()
        {
            var order = AddOrder(20_000, (_v1, _driver, 20_000));
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });

            // عُرض 15,000 ثم قبض السائق غيره: لا تسوية
            await Assert.ThrowsAsync<ConflictException>(() => Service().SettleCashAsync(_driver.Id, Guid.NewGuid(), 15_000));
            Assert.Equal(20_000, (await Service().GetCashAsync(_driver.Id)).Total);

            var (orders, amount) = await Service().SettleCashAsync(_driver.Id, Guid.NewGuid(), 20_000);
            Assert.Equal((1, 20_000m), (orders, amount));
            await Assert.ThrowsAsync<NotFoundException>(() => Service().SettleCashAsync(Guid.NewGuid(), Guid.NewGuid()));
        }

        [Fact]
        public async Task SplitOrder_WithDiscount_PartsAddUpToOrderTotal()
        {
            // كوبون 3,000 لمتجر v1 + نقاط 1,000: مجموع ما يجمعه السائقان = إجمالي الطلب بعد الخصم
            var order = AddOrder(41_000, (_v1, _driver, 20_000), (_v2, _otherDriver, 25_000));
            var tracked = _context.Orders.Single(o => o.Id == order.Id);
            tracked.DiscountAmount = 4_000;
            tracked.PointsDiscountAmount = 1_000;
            tracked.CouponVendorId = _v1.Id;
            _context.SaveChanges();

            var mine = Assert.Single(await Service().GetOrdersAsync(_driverUser.Id, history: false));
            var otherUser = new User { Phone = "0772", Role = UserRoles.Driver, IsActive = true };
            _context.Users.Add(otherUser);
            _otherDriver.UserId = otherUser.Id;
            _context.SaveChanges();
            var theirs = Assert.Single(await Service().GetOrdersAsync(otherUser.Id, history: false));

            Assert.Equal(41_000, mine.AmountToCollect + theirs.AmountToCollect);
            Assert.Equal(20_000 - 3_000 - 444m, mine.AmountToCollect);   // الكوبون كله على متجره + نصيبه من النقاط
        }

        [Fact]
        public async Task SettleCash_ClearsCashInHand()
        {
            var order = AddOrder(30_000, (_v1, _driver, 28_000));
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });

            Assert.Equal(30_000, (await Service().GetCashAsync(_driver.Id)).Total);
            Assert.Equal(1, (await Service().SettleCashAsync(_driver.Id, Guid.NewGuid(), 30_000)).Orders);
            Assert.Equal(0, (await Service().GetCashAsync(_driver.Id)).Total);
            Assert.Equal(0, (await Service().GetProfileAsync(_driverUser.Id)).CashInHand);
        }

        [Fact]
        public async Task CannotTouchAnotherDriversOrder()
        {
            var order = AddOrder(10_000, (_v1, _otherDriver, 10_000));
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);

            await Assert.ThrowsAsync<NotFoundException>(() => Service().PickUpAsync(_driverUser.Id, sub.Id));
            await Assert.ThrowsAsync<NotFoundException>(() => Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true }));
        }

        [Fact]
        public async Task PickUp_SetsTimeOnce()
        {
            var order = AddOrder(10_000, (_v1, _driver, 10_000));
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            sub.PickedUpAt = null;
            sub.Status = OrderStatus.READY;
            _context.SaveChanges();
            SetupPickUp();

            await Service().PickUpAsync(_driverUser.Id, sub.Id);
            var first = (await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == sub.Id)).PickedUpAt;
            await Service().PickUpAsync(_driverUser.Id, sub.Id);

            Assert.NotNull(first);
            Assert.Equal(first, (await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == sub.Id)).PickedUpAt);
        }

        [Fact]
        public async Task SuspendedDriver_IsBlocked()
        {
            _driver.Status = DriverStatus.Suspended;
            _context.SaveChanges();
            await Assert.ThrowsAsync<ForbiddenException>(() => Service().GetProfileAsync(_driverUser.Id));
        }

        [Fact]
        public async Task UserWithoutDriver_IsBlocked()
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => Service().GetOrdersAsync(Guid.NewGuid(), false));
        }

        [Fact]
        public async Task CannotGoOffline_WithOrdersInHand()
        {
            AddOrder(10_000, (_v1, _driver, 10_000));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetWorkStatusAsync(_driverUser.Id, DriverWorkStatus.Offline));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetWorkStatusAsync(_driverUser.Id, DriverWorkStatus.Delivering));
        }

        [Fact]
        public async Task SetAccount_CreatesDriverLogin_AndRejectsTakenPhone()
        {
            var dto = await Service().SetAccountAsync(_otherDriver.Id, "secret1");
            Assert.True(dto.HasAccount);
            var user = await _context.Users.SingleAsync(u => u.Phone == "0771");
            Assert.Equal(UserRoles.Driver, user.Role);
            Assert.True(BCrypt.Net.BCrypt.Verify("secret1", user.PasswordHash));

            var third = new Driver { FullName = "C", Phone = "0770", Status = DriverStatus.Active }; // رقم مستخدم لحساب آخر
            _context.Drivers.Add(third); _context.SaveChanges();
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetAccountAsync(third.Id, "secret1"));
        }

        // ===== الرفض الجزئي عند الباب =====
        private (Order order, SubOrderItem shirt, SubOrderItem shoes) OrderWithItems()
        {
            var order = AddOrder(60_000, (_v1, _driver, 55_000));
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            var shirt = new SubOrderItem { SubOrderId = sub.Id, ProductId = Guid.NewGuid(), ProductName = "Shirt", ProductNameAr = "قميص", UnitPrice = 15_000, Quantity = 2 };
            var shoes = new SubOrderItem { SubOrderId = sub.Id, ProductId = Guid.NewGuid(), ProductName = "Shoes", ProductNameAr = "حذاء", UnitPrice = 25_000, Quantity = 1 };
            _context.AddRange(shirt, shoes);
            _context.SaveChanges();
            return (order, shirt, shoes);
        }

        [Fact]
        public async Task PartialRefusal_ReducesCash_RecordsApprovedReturn()
        {
            var (order, shirt, _) = OrderWithItems();

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusedItems = { new DriverRefusedItemDto { SubOrderItemId = shirt.Id, Quantity = 1 } },
                RefusalReason = ReturnReason.NOT_AS_DESCRIBED,
            });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(45_000, saved.CashCollectedAmount);            // 60,000 − قميص واحد 15,000
            Assert.Equal(1, (await _context.SubOrderItems.AsNoTracking().SingleAsync(i => i.Id == shirt.Id)).RefusedQuantity);

            var ret = await _context.Returns.Include(r => r.Items).SingleAsync(r => r.OrderId == order.Id);
            Assert.Equal(ReturnStatus.APPROVED, ret.Status);
            Assert.Equal(1, Assert.Single(ret.Items).Quantity);
            Assert.Equal(15_000, ret.Items.Single().UnitPrice);
        }

        [Fact]
        public async Task PartialRefusal_OnCouponOrder_RefusedItemTakesItsDiscountShare()
        {
            // ORD-0017/0019 (جولة 2): كوبون 10% على 55,000 = 5,500. رفض الحذاء (25,000) — الخصم يبقى 10% مما احتُفظ به فقط
            var (order, _, shoes) = OrderWithItems();
            var tracked = _context.Orders.Single(o => o.Id == order.Id);
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            tracked.CouponCode = "P10"; tracked.CouponDiscountType = DiscountType.PERCENTAGE; tracked.CouponDiscountValue = 10;
            tracked.CouponOriginalAmount = 5_500; tracked.DiscountAmount = 5_500; tracked.DeliveryFees = 5_000; tracked.TotalAmount = 54_500;
            sub.CouponShare = 5_500; sub.DeliveryFee = 5_000;
            _context.SaveChanges();

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusedItems = { new DriverRefusedItemDto { SubOrderItemId = shoes.Id, Quantity = 1 } },
                RefusalReason = ReturnReason.CHANGED_MIND,
            });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            var savedSub = await _context.SubOrders.AsNoTracking().SingleAsync(s => s.Id == sub.Id);
            Assert.Equal(32_000, saved.CashCollectedAmount);   // قميصان 30,000 − 10% (3,000) + التوصيل 5,000 — لا 29,500
            Assert.Equal(3_000, savedSub.CouponShare);
            Assert.Equal(25_000, savedSub.RefusedAmount);
            Assert.Equal(3_000, saved.DiscountAmount);
            Assert.Equal(32_000, saved.TotalAmount);           // الإجمالي = ما دفعه الزبون (الخيار ج)
            Assert.Equal(30_000, saved.Subtotal);
        }

        [Fact]
        public async Task PartialRefusal_OfExpensiveItem_NeverCollectsZero()
        {
            // ORD-0019: خصم الكوبون أكبر من قيمة ما احتُفظ به — كان السائق يقبض 0 ويُسجَّل الطلب مدفوعاً
            var (order, shirt, shoes) = OrderWithItems();
            var tracked = _context.Orders.Single(o => o.Id == order.Id);
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            tracked.CouponCode = "P10"; tracked.CouponDiscountType = DiscountType.PERCENTAGE; tracked.CouponDiscountValue = 10;
            tracked.CouponOriginalAmount = 5_500; tracked.DiscountAmount = 5_500; tracked.DeliveryFees = 4_000; tracked.TotalAmount = 53_500;
            sub.CouponShare = 5_500; sub.DeliveryFee = 4_000;
            _context.SaveChanges();

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusedItems = { new() { SubOrderItemId = shoes.Id, Quantity = 1 }, new() { SubOrderItemId = shirt.Id, Quantity = 1 } },
                RefusalReason = ReturnReason.CHANGED_MIND,
            });

            // بقي قميص واحد 15,000 − 10% + التوصيل 4,000
            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(17_500, saved.CashCollectedAmount);
            Assert.Equal(17_500, saved.TotalAmount);
        }

        [Fact]
        public async Task FailedPart_StopsCountingImmediately()
        {
            // جزء تعذّر تسليمه لا ينتظر استلام المتجر: إجمالي الطلب = ما قبضه السائق الآخر
            SetupFail();
            var order = AddOrder(45_000, (_v1, _driver, 20_000), (_v2, _otherDriver, 25_000));
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto { CashCollected = true });
            var otherUser = new User { Phone = "0773", Role = UserRoles.Driver, IsActive = true };
            _context.Users.Add(otherUser);
            _otherDriver.UserId = otherUser.Id;
            _context.SaveChanges();

            await Service().FailAsync(otherUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.NoAnswer });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(20_000, saved.TotalAmount);
            Assert.Equal(20_000, saved.CashCollectedAmount);
        }

        [Fact]
        public async Task PartialRefusal_FeeOnStore_TotalExcludesFee()
        {
            // الرفض الجزئي والأجرة على المتجر: الزبون لا يدفعها، والإجمالي يساويه
            _context.DeliverySettings.Add(new DeliverySettings { RefusalFeePayer = RefusalFeePayer.Vendor, PartialRefusalCustomerPays = false });
            var (order, shirt, _) = OrderWithItems();
            var tracked = _context.Orders.Single(o => o.Id == order.Id);
            var sub = _context.SubOrders.Single(s => s.OrderId == order.Id);
            tracked.DeliveryFees = 5_000; tracked.TotalAmount = 60_000; sub.DeliveryFee = 5_000;
            _context.SaveChanges();

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusedItems = { new() { SubOrderItemId = shirt.Id, Quantity = 1 } },
                RefusalReason = ReturnReason.DEFECTIVE,
            });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(40_000, saved.CashCollectedAmount);   // 55,000 − قميص 15,000، بلا الأجرة
            Assert.Equal(40_000, saved.TotalAmount);
            Assert.Equal(0, saved.DeliveryFees);
        }

        [Fact]
        public async Task Refusal_Rules()
        {
            var (order, shirt, shoes) = OrderWithItems();
            Task Deliver(DriverDeliverDto d) => Service().DeliverAsync(_driverUser.Id, order.Id, d);

            // بلا سبب
            await Assert.ThrowsAsync<BusinessRuleException>(() => Deliver(new() { CashCollected = true, RefusedItems = { new() { SubOrderItemId = shirt.Id, Quantity = 1 } } }));
            // أكثر من المطلوب
            await Assert.ThrowsAsync<BusinessRuleException>(() => Deliver(new() { CashCollected = true, RefusalReason = ReturnReason.OTHER, RefusedItems = { new() { SubOrderItemId = shirt.Id, Quantity = 3 } } }));
            // رفض كل شيء ليس تسليماً
            await Assert.ThrowsAsync<BusinessRuleException>(() => Deliver(new() { CashCollected = true, RefusalReason = ReturnReason.OTHER,
                RefusedItems = { new() { SubOrderItemId = shirt.Id, Quantity = 2 }, new() { SubOrderItemId = shoes.Id, Quantity = 1 } } }));
            // قطعة من طلب آخر
            await Assert.ThrowsAsync<BusinessRuleException>(() => Deliver(new() { CashCollected = true, RefusalReason = ReturnReason.OTHER, RefusedItems = { new() { SubOrderItemId = Guid.NewGuid(), Quantity = 1 } } }));

            _ops.Verify(o => o.MarkDeliveredByDriverAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
            Assert.Empty(_context.Returns);
        }

        // ===== تعذّر التسليم + أجرة التوصيل عند الرفض =====
        private Order OrderWithFee(decimal fee)
        {
            var (order, _, _) = OrderWithItems();
            var tracked = _context.Orders.Single(o => o.Id == order.Id);
            tracked.DeliveryFees = fee;
            _context.SaveChanges();
            return tracked;
        }

        [Fact]
        public async Task FullRefusal_CustomerPaysFee_CollectsOnlyFee()
        {
            SetupFail(); SetPayer(RefusalFeePayer.Customer);
            var order = OrderWithFee(4_000);

            await Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.CustomerRefused, FeeCollected = true });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(4_000, saved.CashCollectedAmount);
            Assert.Equal(4_000, saved.RefusalFeeAmount);
            Assert.Equal(RefusalFeePayer.Customer, saved.RefusalFeePayer);
            Assert.NotEqual(PaymentStatus.Paid, saved.PaymentStatus);
        }

        [Theory]
        [InlineData("VENDOR")]
        [InlineData("NONE")]
        public async Task FullRefusal_FeeNotOnCustomer_CollectsNothing(string payer)
        {
            SetupFail(); SetPayer(payer);
            var order = OrderWithFee(4_000);

            await Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.CustomerRefused, FeeCollected = true });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Null(saved.CashCollectedAmount);
            Assert.Equal(payer, saved.RefusalFeePayer);
        }

        [Fact]
        public async Task RefusalFeeOverride_BeatsGlobalSetting_OnlyBeforeRefusal()
        {
            SetupFail(); SetPayer(RefusalFeePayer.Customer);
            var order = OrderWithFee(4_000);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetRefusalFeeOverrideAsync(order.Id, RefusalFeePayer.Vendor, null, Guid.NewGuid()));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetRefusalFeeOverrideAsync(order.Id, "X", "سبب", Guid.NewGuid()));

            // المتجر أرسل قطعة خاطئة: الأجرة عليه لهذا الطلب، والسائق يرى ذلك
            var fee = await Service().SetRefusalFeeOverrideAsync(order.Id, RefusalFeePayer.Vendor, "قطعة خاطئة", Guid.NewGuid());
            Assert.Equal((RefusalFeePayer.Customer, RefusalFeePayer.Vendor), (fee.DefaultFullPayer, fee.OverridePayer));
            var mine = Assert.Single(await Service().GetOrdersAsync(_driverUser.Id, history: false));
            Assert.Equal((RefusalFeePayer.Vendor, RefusalFeePayer.Vendor), (mine.RefusalFeePayer, mine.PartialRefusalFeePayer));

            await Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.CustomerRefused, FeeCollected = true });
            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Null(saved.CashCollectedAmount);
            Assert.Equal(RefusalFeePayer.Vendor, saved.RefusalFeePayer);

            // بعد تسجيل الرفض لا يُغيَّر (المال تحرّك أمام السائق)
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetRefusalFeeOverrideAsync(order.Id, null, null, Guid.NewGuid()));
        }

        [Fact]
        public async Task NoAnswer_NoFeeRecorded_AndReasonRequired()
        {
            SetupFail();
            var order = OrderWithFee(4_000);
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = "bogus" }));

            await Service().FailAsync(_driverUser.Id, order.Id, new DriverFailDto { Reason = DeliveryFailureReason.NoAnswer, FeeCollected = true });
            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Null(saved.CashCollectedAmount);
            Assert.Null(saved.RefusalFeeAmount);
        }

        [Fact]
        public async Task PartialRefusal_VendorPaysFee_FeeRemovedFromAmount()
        {
            SetPayer(RefusalFeePayer.Vendor);
            var order = OrderWithFee(5_000);   // الإجمالي 60,000 يشمل الأجرة
            var shirt = _context.SubOrderItems.First(i => i.ProductName == "Shirt");

            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusalReason = ReturnReason.OTHER,
                RefusedItems = { new DriverRefusedItemDto { SubOrderItemId = shirt.Id, Quantity = 1 } },
            });

            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(40_000, saved.CashCollectedAmount);   // 60,000 − قميص 15,000 − أجرة 5,000
            Assert.Equal(RefusalFeePayer.Vendor, saved.RefusalFeePayer);
        }

        [Fact]
        public async Task Settings_RejectsUnknownPayer()
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().UpdateSettingsAsync(new DeliverySettingsDto { RefusalFeePayer = "X" }, Guid.NewGuid()));
            var saved = await Service().UpdateSettingsAsync(new DeliverySettingsDto { RefusalFeePayer = RefusalFeePayer.None }, Guid.NewGuid());
            Assert.Equal(RefusalFeePayer.None, saved.RefusalFeePayer);
            Assert.Equal(RefusalFeePayer.None, await Service().GetRefusalFeePayerAsync());
        }

        [Fact]
        public async Task PartialOnCustomer_OverridesVendorPayer_ForPartialOnly()
        {
            _context.DeliverySettings.Add(new DeliverySettings { RefusalFeePayer = RefusalFeePayer.Vendor, PartialRefusalCustomerPays = true });
            _context.SaveChanges();
            var order = OrderWithFee(5_000);
            var shirt = _context.SubOrderItems.First(i => i.ProductName == "Shirt");

            // الرفض الجزئي: الأجرة على الزبون رغم أن الإعداد العام «المتجر»
            await Service().DeliverAsync(_driverUser.Id, order.Id, new DriverDeliverDto
            {
                CashCollected = true,
                RefusalReason = ReturnReason.OTHER,
                RefusedItems = { new DriverRefusedItemDto { SubOrderItemId = shirt.Id, Quantity = 1 } },
            });
            var saved = await _context.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);
            Assert.Equal(45_000, saved.CashCollectedAmount);   // 60,000 − قميص 15,000 (الأجرة باقية)
            Assert.Equal(RefusalFeePayer.Customer, saved.RefusalFeePayer);

            // الرفض الكامل يبقى على المتجر
            Assert.Equal(RefusalFeePayer.Vendor, await Service().GetRefusalFeePayerAsync());
            var settings = await Service().GetSettingsAsync();
            Assert.True(settings.PartialRefusalCustomerPays);
        }
    }
}
