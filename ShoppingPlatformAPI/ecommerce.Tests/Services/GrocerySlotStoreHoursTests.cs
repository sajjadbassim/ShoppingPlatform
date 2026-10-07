using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.DeliverySlotService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.LoyaltyService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ecommerce.Tests.Services
{
    // مواعيد السوبرماركت مع أوقات عمل المتجر: الطلب بموعد لاحق لا يُرفض لأن المتجر مغلق الآن،
    // والمواعيد المعروضة لا تقع خارج أوقات عمل المتجر
    public class GrocerySlotStoreHoursTests : IDisposable
    {
        // الثلاثاء 6 أكتوبر 22:30 بتوقيت بغداد — بعد إغلاق المتجر (9:00–22:00، والجمعة مغلق)
        private static readonly DateTime Now = new(2026, 10, 6, 19, 30, 0, DateTimeKind.Utc);
        private const string Hours = """
            [{"day":0,"open":"09:00","close":"22:00"},{"day":1,"open":"09:00","close":"22:00"},{"day":2,"open":"09:00","close":"22:00"},
             {"day":3,"open":"09:00","close":"22:00"},{"day":4,"open":"09:00","close":"22:00"},{"day":5,"closed":true},{"day":6,"open":"09:00","close":"22:00"}]
            """;

        private readonly AppDbContext _context;
        private readonly FixedTime _time = new(Now);
        private readonly Vendor _mart;
        private readonly Vendor _electronicsStore;
        private readonly Category _grocery;
        private readonly Category _electronics;
        private readonly User _customer;
        private readonly Address _address;

        public GrocerySlotStoreHoursTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false))
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);
            _mart = new Vendor { Name = "mart", NameAr = "ماركت", OwnerId = Guid.NewGuid(), IsActive = true, WorkingHours = StoreHours.Normalize(Hours) };
            _electronicsStore = new Vendor { Name = "tech", NameAr = "إلكترونيات", OwnerId = Guid.NewGuid(), IsActive = true, WorkingHours = StoreHours.Normalize(Hours) };
            _grocery = new Category { Name = "Grocery", NameAr = "سوبرماركت", IsGrocery = true };
            _electronics = new Category { Name = "Electronics", NameAr = "إلكترونيات" };
            _customer = new User { Phone = "07701234567", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _address = new Address { UserId = _customer.Id, StreetAddress = "1", City = "الكوت", Phone = "0770" };
            _context.AddRange(_mart, _electronicsStore, _grocery, _electronics, _customer, _address);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private Product AddProduct(Vendor store, Category category, string name = "حليب")
        {
            var product = new Product { VendorId = store.Id, Vendor = store, CategoryId = category.Id, Name = name, NameAr = name, Price = 5000, StockQuantity = 10, IsAvailable = true, IsActive = true };
            _context.Products.Add(product);
            _context.SaveChanges();
            return product;
        }

        private OrderService Checkout(params Product[] products)
        {
            var cart = new Cart { UserId = _customer.Id, Items = products.Select(p => new CartItem { ProductId = p.Id, Product = p, Quantity = 1 }).ToList() };
            var carts = new Mock<ICartRepository>();
            carts.Setup(r => r.GetByUserIdAsync(_customer.Id)).ReturnsAsync(cart);
            var users = new Mock<IUserRepository>();
            users.Setup(r => r.GetByIdAsync(_customer.Id)).ReturnsAsync(_customer);
            var addresses = new Mock<IAddressRepository>();
            addresses.Setup(r => r.GetByIdAsync(_address.Id)).ReturnsAsync(_address);
            var promotions = new Mock<IPromotionRepository>();
            promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>());
            var inventory = new Mock<IInventoryService>();
            inventory.Setup(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<StockChange>());
            var coupons = new Mock<ICouponRepository>();
            return new OrderService(new OrderRepository(_context), new SubOrderRepository(_context), carts.Object, users.Object,
                addresses.Object, new OrderStatusLogRepository(_context), new Mock<INotificationService>().Object, _context, new CouponService(coupons.Object),
                coupons.Object, new Mock<ILoyaltyService>().Object, new PromotionService(promotions.Object, _context), inventory.Object,
                NullLogger<OrderService>.Instance, new DeliverySlotService(_context, _time), _time);
        }

        // بداية فترة بتوقيت بغداد ← UTC
        private static DateTime Baghdad(int day, int hour) => new DateTime(2026, 10, day, hour, 0, 0, DateTimeKind.Utc).AddHours(-3);

        private Task<OrderResponseDto> Order(OrderService service, DateTime? slot) =>
            service.CreateOrderFromCartAsync(_customer.Id, new CreateOrderDto { AddressId = _address.Id, CustomerNotes = "", DeliverySlotStart = slot });

        [Fact]
        public async Task Slots_FollowStoreHours()
        {
            var service = new DeliverySlotService(_context, _time);
            var all = (await service.GetSlotsAsync()).Slots;
            var forMart = (await service.GetSlotsAsync(new[] { _mart })).Slots;

            // المنصة: 10:00–22:00 فترات ساعتين ليومين — والمتجر يعمل حتى 22:00 فلا تتأثر هذه الأيام
            Assert.Equal(all.Count, forMart.Count);

            // متجر يغلق الساعة 14:00 ← لا تُعرض فترات تبدأ بعدها
            _mart.WorkingHours = StoreHours.Normalize("""[{"day":3,"open":"09:00","close":"14:00"}]""");
            var shortDay = (await service.GetSlotsAsync(new[] { _mart })).Slots;
            Assert.NotEmpty(shortDay);
            Assert.All(shortDay, s => Assert.True(s.Start < Baghdad(7, 14)));
        }

        [Fact]
        public async Task Slots_OnClosedDay_AreHidden_AndRejectedAtCheckout()
        {
            var settings = new DeliverySettings { GrocerySlotDays = 4 };   // حتى الجمعة
            _context.DeliverySettings.Add(settings);
            await _context.SaveChangesAsync();
            var service = new DeliverySlotService(_context, _time);

            var slots = (await service.GetSlotsAsync(new[] { _mart })).Slots;
            Assert.DoesNotContain(slots, s => s.Start.AddHours(3).DayOfWeek == DayOfWeek.Friday);
            await Assert.ThrowsAsync<BusinessRuleException>(() => service.ResolveAsync(Baghdad(9, 10), new[] { _mart }));
        }

        [Fact]
        public async Task ScheduledGroceryOrder_IsAccepted_WhileStoreClosedNow()
        {
            var milk = AddProduct(_mart, _grocery);

            var order = await Order(Checkout(milk), Baghdad(7, 10));

            Assert.Equal(Baghdad(7, 10), order.DeliverySlotStart);
            // مهلة القبول تبدأ من فتح المتجر غداً 9:00 لا من الآن
            var sub = await _context.SubOrders.AsNoTracking().SingleAsync();
            Assert.Equal(Baghdad(7, 9).AddMinutes(5), sub.ConfirmationDeadline);
        }

        [Fact]
        public async Task ImmediateOrderFromClosedNonGroceryStore_IsStillRejected()
        {
            var milk = AddProduct(_mart, _grocery);
            var phone = AddProduct(_electronicsStore, _electronics, "هاتف");

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Order(Checkout(milk, phone), Baghdad(7, 10)));
            Assert.Contains("إلكترونيات", ex.Message);
            Assert.DoesNotContain("ماركت", ex.Message);
        }

        [Fact]
        public async Task PausedGroceryStore_RejectsEvenScheduledOrders()
        {
            _mart.IsAcceptingOrders = false;
            var milk = AddProduct(_mart, _grocery);

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Order(Checkout(milk), Baghdad(7, 10)));
            Assert.Contains("لا يستقبل", ex.Message);
        }

        [Fact]
        public void NextOpening_IsTomorrowMorning_AndNullWhenOpen()
        {
            Assert.Equal(Baghdad(7, 9), StoreHours.NextOpeningUtc(_mart, Now));
            Assert.Null(StoreHours.NextOpeningUtc(_mart, Baghdad(7, 12)));
            Assert.Null(StoreHours.NextOpeningUtc(new Vendor(), Now));   // بلا جدول = مفتوح دائماً
        }

        private sealed class FixedTime : TimeProvider
        {
            private readonly DateTimeOffset _now;
            public FixedTime(DateTime utc) => _now = new DateTimeOffset(utc);
            public override DateTimeOffset GetUtcNow() => _now;
        }
    }
}
