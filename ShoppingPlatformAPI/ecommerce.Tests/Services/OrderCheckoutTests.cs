using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ecommerce.Tests.Services
{
    // إتمام الطلب من السلة: الأسعار من الخادم، التقسيم على المتاجر، الكوبون تحت التزامن، والإشعارات بعد الحفظ فقط
    public class OrderCheckoutTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Mock<ICartRepository> _carts = new();
        private readonly Mock<IUserRepository> _users = new();
        private readonly Mock<IAddressRepository> _addresses = new();
        private readonly Mock<INotificationService> _notify = new();
        private readonly Mock<ICouponRepository> _coupons = new();
        private readonly Mock<IPromotionRepository> _promotions = new();
        private readonly Mock<IInventoryService> _inventory = new();

        private readonly User _customer;
        private readonly Address _address;
        private readonly Vendor _storeA;
        private readonly Vendor _storeB;
        private readonly Cart _cart;

        public OrderCheckoutTests()
        {
            // المعاملات غير مدعومة في InMemory — تُتجاهل هنا، والاختبار يتحقق من ترتيب الإشعارات حولها
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false))
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);

            _customer = new User { Phone = "07701234567", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _address = new Address { UserId = _customer.Id, StreetAddress = "شارع 1", City = "بغداد", Phone = "07701234567" };
            _storeA = new Vendor { Name = "A", NameAr = "A", OwnerId = Guid.NewGuid(), IsActive = true, DeliveryFee = 3000 };
            _storeB = new Vendor { Name = "B", NameAr = "B", OwnerId = Guid.NewGuid(), IsActive = true, DeliveryFee = 2000 };

            _cart = new Cart { UserId = _customer.Id, Items = new List<CartItem>() };
            AddToCart(Product(_storeA, "قميص", 10000), 2);
            AddToCart(Product(_storeB, "حذاء", 25000), 1);

            // السلة تأتي من المستودع الوهمي، لكن قراءة الطلب بعد إنشائه تضمّ الزبون والعنوان والمنتجات من القاعدة
            _context.AddRange(_customer, _address);
            _context.AddRange(_cart.Items.Select(i => i.Product));
            _context.SaveChanges();

            _users.Setup(r => r.GetByIdAsync(_customer.Id)).ReturnsAsync(_customer);
            _addresses.Setup(r => r.GetByIdAsync(_address.Id)).ReturnsAsync(_address);
            _carts.Setup(r => r.GetByUserIdAsync(_customer.Id)).ReturnsAsync(_cart);
            _promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>());
            _inventory.Setup(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<StockChange>());
        }

        public void Dispose() => _context.Dispose();

        private Product Product(Vendor store, string name, decimal price) => new()
        {
            VendorId = store.Id, Vendor = store, Name = name, NameAr = name, Price = price,
            StockQuantity = 10, IsActive = true, IsAvailable = true
        };

        private void AddToCart(Product product, int quantity) =>
            _cart.Items.Add(new CartItem { CartId = _cart.Id, ProductId = product.Id, Product = product, Quantity = quantity });

        private OrderService Service() => new(
            new OrderRepository(_context), new SubOrderRepository(_context), _carts.Object, _users.Object,
            _addresses.Object, new OrderStatusLogRepository(_context), _notify.Object, _context,
            new CouponService(_coupons.Object), _coupons.Object, new Mock<ILoyaltyService>().Object,
            new PromotionService(_promotions.Object, _context), _inventory.Object, NullLogger<OrderService>.Instance);

        private Task<OrderResponseDto> Checkout(string? coupon = null) =>
            Service().CreateOrderFromCartAsync(_customer.Id, new CreateOrderDto { AddressId = _address.Id, CustomerNotes = "", CouponCode = coupon });

        private Coupon SetupCoupon(int? usageLimit = null, int userLimit = 1)
        {
            var coupon = new Coupon
            {
                Code = "SAVE10", DiscountType = DiscountType.PERCENTAGE, DiscountValue = 10,
                UsageLimit = usageLimit, UserUsageLimit = userLimit, IsActive = true
            };
            _coupons.Setup(r => r.GetByCodeAsync("SAVE10")).ReturnsAsync(coupon);
            _coupons.Setup(r => r.TryIncrementUsageCountAsync(coupon.Id)).ReturnsAsync(true);
            return coupon;
        }

        [Fact]
        public async Task Checkout_CouponSharesStoredPerStore_AndMessageHasOrderNumber()
        {
            SetupCoupon();
            var order = await Checkout("SAVE10");

            var subs = _context.SubOrders.Where(s => s.OrderId == order.Id).ToList();
            Assert.Equal(4500, subs.Sum(s => s.CouponShare));   // 10% من 45,000 موزّعة على المتجرين
            Assert.Equal(2000, subs.Single(s => s.VendorId == _storeA.Id).CouponShare);
            _notify.Verify(n => n.NotifyCustomerAsync(_customer.Id, It.Is<string>(m => m.Contains(order.OrderNumber)), It.IsAny<object>()), Times.Once);
        }

        [Fact]
        public async Task Tracking_FailedThenCancelled_ShowsOnlyWhatHappened()
        {
            var order = await Checkout();
            var sub = _context.SubOrders.First(s => s.OrderId == order.Id);
            var o = _context.Orders.Single(x => x.Id == order.Id);
            foreach (var st in new[] { OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY })
                _context.OrderStatusLogs.Add(new OrderStatusLog { OrderId = o.Id, OldStatus = "", NewStatus = st });
            // سجل الطلب الرئيسي بنص داخلي، وسجل الجزء بالسبب الفعلي
            _context.OrderStatusLogs.Add(new OrderStatusLog { OrderId = o.Id, OldStatus = "", NewStatus = OrderStatus.DELIVERY_FAILED, Reason = "تحديث تلقائي: 0 مؤكد" });
            _context.OrderStatusLogs.Add(new OrderStatusLog { SubOrderId = sub.Id, OldStatus = "", NewStatus = OrderStatus.DELIVERY_FAILED, Reason = "الزبون لا يرد" });
            _context.OrderStatusLogs.Add(new OrderStatusLog { OrderId = o.Id, OldStatus = "", NewStatus = OrderStatus.CANCELLED });
            o.Status = OrderStatus.CANCELLED;
            _context.SaveChanges();

            var tracking = await Service().GetOrderTrackingAsync(o.Id, _customer.Id);

            var failed = Assert.Single(tracking.Timeline, t => t.Status == OrderStatus.DELIVERY_FAILED);
            Assert.Contains("الزبون لا يرد", failed.Description);
            Assert.DoesNotContain(tracking.Timeline, t => t.Status == OrderStatus.DELIVERED);
            Assert.All(tracking.Timeline, t => Assert.True(t.IsCompleted));
            Assert.Equal(OrderStatus.CANCELLED, tracking.Timeline.Last().Status);
        }

        [Fact]
        public async Task Checkout_SplitsOrderPerStoreWithServerSidePricesAndFees()
        {
            var order = await Checkout();

            Assert.Equal(45000, order.Subtotal);       // 2×10000 + 25000
            Assert.Equal(5000, order.DeliveryFees);    // 3000 + 2000 — رسوم كل متجر
            Assert.Equal(50000, order.TotalAmount);
            Assert.Matches(@"^ORD-\d{8}-0001$", order.OrderNumber);

            var subOrders = await _context.SubOrders.Include(s => s.Items).ToListAsync();
            Assert.Equal(2, subOrders.Count);
            Assert.Equal(20000, subOrders.Single(s => s.VendorId == _storeA.Id).Subtotal);
            Assert.Equal(25000, subOrders.Single(s => s.VendorId == _storeB.Id).Subtotal);
            // تُحذف قطع الطلب فقط (لا السلة كلها): ما أُضيف أثناء الإرسال يبقى
            _carts.Verify(r => r.RemoveItemsAsync(_cart.Id, It.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == _cart.Items.Count)), Times.Once);
            _carts.Verify(r => r.ClearCartAsync(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_ChargesPromotionPrice()
        {
            var shirt = _cart.Items.First().Product;
            _promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>
            {
                new() { Name = "sale", TargetType = PromotionTargetType.PRODUCT, TargetId = shirt.Id,
                        DiscountType = DiscountType.PERCENTAGE, DiscountValue = 50, IsActive = true }
            });

            var order = await Checkout();

            Assert.Equal(35000, order.Subtotal);       // 2×5000 + 25000
            var item = await _context.SubOrderItems.SingleAsync(i => i.ProductId == shirt.Id);
            Assert.Equal(5000, item.UnitPrice);
        }

        [Fact]
        public async Task Checkout_SecondOrderSameDay_GetsNextNumber()
        {
            await Checkout();
            var second = await Checkout();

            Assert.EndsWith("-0002", second.OrderNumber);
        }

        [Fact]
        public async Task Checkout_SendsNotificationsOnlyAfterSaving()
        {
            await Checkout();

            _notify.Verify(n => n.NotifyNewOrderAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Once);
            _notify.Verify(n => n.NotifyNewSubOrderAsync(It.IsAny<Guid>(), It.IsAny<string>(), _storeA.Id), Times.Once);
            _notify.Verify(n => n.NotifyNewSubOrderAsync(It.IsAny<Guid>(), It.IsAny<string>(), _storeB.Id), Times.Once);
            _notify.Verify(n => n.NotifyCustomerAsync(_customer.Id, It.IsAny<string>(), It.IsAny<object?>()), Times.Once);
        }

        [Fact]
        public async Task Checkout_WhenTransactionFails_SendsNoNotifications()
        {
            // آخر خطوة قبل الحفظ تفشل — الطلب يتراجع ولا يجوز أن يصل المتاجر إشعار عنه
            _carts.Setup(r => r.RemoveItemsAsync(_cart.Id, It.IsAny<IReadOnlyCollection<Guid>>())).ThrowsAsync(new InvalidOperationException("db down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Checkout());

            _notify.Verify(n => n.NotifyNewOrderAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
            _notify.Verify(n => n.NotifyNewSubOrderAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
            _notify.Verify(n => n.NotifyCustomerAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<object?>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_WhenNotificationFails_OrderIsStillCreated()
        {
            _notify.Setup(n => n.NotifyNewOrderAsync(It.IsAny<Guid>(), It.IsAny<string>())).ThrowsAsync(new Exception("hub down"));

            var order = await Checkout();

            Assert.NotNull(await _context.Orders.FindAsync(order.Id));
        }

        [Fact]
        public async Task Checkout_WhenStockTakenMeanwhile_ThrowsConflictAndNotifiesNobody()
        {
            _inventory.Setup(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new ConflictException("الكمية لم تعد متوفرة"));

            await Assert.ThrowsAsync<ConflictException>(() => Checkout());
            _notify.Verify(n => n.NotifyNewOrderAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_WithCoupon_AppliesDiscountAndRecordsUsageOnce()
        {
            var coupon = SetupCoupon();

            var order = await Checkout("SAVE10");

            Assert.Equal(4500, order.DiscountAmount);      // 10% من 45000 (قبل التوصيل)
            Assert.Equal(45500, order.TotalAmount);
            _coupons.Verify(r => r.TryIncrementUsageCountAsync(coupon.Id), Times.Once);
            _coupons.Verify(r => r.RecordUsageAsync(It.Is<CouponUsage>(u => u.CouponId == coupon.Id && u.UserId == _customer.Id)), Times.Once);
        }

        [Fact]
        public async Task Checkout_WhenCouponRunsOutAtReservation_ThrowsConflictWithoutRecordingUsage()
        {
            // التحقق المسبق رأى استخداماً متبقياً، لكن طلباً متزامناً حجزه أولاً
            var coupon = SetupCoupon(usageLimit: 5);
            _coupons.Setup(r => r.TryIncrementUsageCountAsync(coupon.Id)).ReturnsAsync(false);

            await Assert.ThrowsAsync<ConflictException>(() => Checkout("SAVE10"));
            _coupons.Verify(r => r.RecordUsageAsync(It.IsAny<CouponUsage>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_WhenSameCustomerUsedCouponConcurrently_ThrowsConflict()
        {
            // أول عدّ (قبل القفل) = 0، العدّ الثاني تحت القفل يرى استخدام الطلب المتزامن
            var coupon = SetupCoupon(userLimit: 1);
            _coupons.SetupSequence(r => r.GetUserUsageCountAsync(coupon.Id, _customer.Id))
                .ReturnsAsync(0)
                .ReturnsAsync(1);

            await Assert.ThrowsAsync<ConflictException>(() => Checkout("SAVE10"));
            _coupons.Verify(r => r.RecordUsageAsync(It.IsAny<CouponUsage>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_BelowStoreMinimum_IsRejected()
        {
            _storeB.MinOrderAmount = 30000;

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Checkout());
            Assert.Contains("الحد الأدنى", ex.Message);
        }

        [Fact]
        public async Task Checkout_WithSomeoneElsesAddress_IsRejected()
        {
            _address.UserId = Guid.NewGuid();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Checkout());
            _inventory.Verify(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_WithEmptyCart_IsRejected()
        {
            _cart.Items.Clear();

            await Assert.ThrowsAsync<BusinessRuleException>(() => Checkout());
        }

        [Fact]
        public async Task Checkout_WhenStorePausedOrders_IsRejectedWithReason()
        {
            _storeB.IsAcceptingOrders = false;

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Checkout());
            Assert.Contains("لا يستقبل طلبات", ex.Message);
            _inventory.Verify(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Checkout_WithInactiveStore_IsRejected()
        {
            _storeA.IsActive = false;

            await Assert.ThrowsAsync<BusinessRuleException>(() => Checkout());
        }
    }
}
