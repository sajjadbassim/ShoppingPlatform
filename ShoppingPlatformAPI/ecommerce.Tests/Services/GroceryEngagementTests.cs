using System.Text.Json;
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.HomePage;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Order;
using ecommerce.Core.DTO.Product;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.DeliverySlotService;
using ecommerce.Services.EngagementService;
using ecommerce.Services.FileService;
using ecommerce.Services.HomeService;
using ecommerce.Services.InventoryService;
using ecommerce.Services.LoyaltyService;
using ecommerce.Services.NotificationService;
using ecommerce.Services.ProductService.ProductService;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ecommerce.Tests.Services
{
    // ميزات السوبرماركت والتفاعل: مواعيد التوصيل، تفضيل الاستبدال، البيع بالوزن، اشترِ مجدداً،
    // أعلمني عند التوفر، تذكير السلة، العروض المحدودة، وادعُ صديقاً
    public class GroceryEngagementTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly FakeTime _time = new(new DateTime(2026, 10, 6, 9, 30, 0, DateTimeKind.Utc)); // 12:30 بغداد
        private readonly Mock<INotificationService> _notify = new();
        private readonly Vendor _store;
        private readonly Category _grocery;
        private readonly Category _electronics;
        private readonly User _customer;

        public GroceryEngagementTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false))
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);
            _store = new Vendor { Name = "mart", NameAr = "ماركت", OwnerId = Guid.NewGuid(), IsActive = true, DeliveryFee = 2000 };
            _grocery = new Category { Name = "Grocery", NameAr = "سوبرماركت", IsGrocery = true };
            _electronics = new Category { Name = "Electronics", NameAr = "إلكترونيات" };
            _customer = new User { Phone = "07701234567", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true };
            _context.AddRange(_store, _grocery, _electronics, _customer);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private Product AddProduct(string name, Category? category, decimal price = 1000, int stock = 10, decimal? weightStep = null)
        {
            var product = new Product
            {
                VendorId = _store.Id, Vendor = _store, CategoryId = category?.Id, Name = name, NameAr = name, Price = price,
                StockQuantity = stock, IsAvailable = stock > 0, IsActive = true, WeightStepKg = weightStep
            };
            _context.Products.Add(product);
            _context.SaveChanges();
            return product;
        }

        // ===================================
        // مواعيد التوصيل
        // ===================================
        [Fact]
        public void Slots_StartAfterLeadTime_InBaghdadTime()
        {
            var slots = DeliverySlotService.Generate(new DeliverySettings(), _time.GetUtcNow().UtcDateTime);

            // الآن 12:30 بغداد + ساعة مهلة → أول فترة 14:00؛ اليوم 4 فترات (14، 16، 18، 20) وغداً 6
            Assert.Equal(10, slots.Count);
            Assert.Equal(new DateTime(2026, 10, 6, 11, 0, 0, DateTimeKind.Utc), slots[0].Start);
            Assert.Equal("اليوم", slots[0].DayLabel);
            Assert.Equal("2:00 م – 4:00 م", slots[0].TimeLabel);
            Assert.Equal("غداً", slots[4].DayLabel);
            Assert.Equal("10:00 ص – 12:00 م", slots[4].TimeLabel);
        }

        [Fact]
        public async Task Slots_ResolveRejectsMissingOrStaleSlot_AndSettingsAreValidated()
        {
            var service = new DeliverySlotService(_context, _time);

            await Assert.ThrowsAsync<BusinessRuleException>(() => service.ResolveAsync(null));
            await Assert.ThrowsAsync<BusinessRuleException>(() => service.ResolveAsync(new DateTime(2026, 10, 6, 7, 0, 0, DateTimeKind.Utc)));
            var slot = await service.ResolveAsync(new DateTime(2026, 10, 6, 11, 0, 0, DateTimeKind.Utc));
            Assert.Equal(new DateTime(2026, 10, 6, 13, 0, 0, DateTimeKind.Utc), slot!.End);

            await Assert.ThrowsAsync<BusinessRuleException>(() => service.SaveSettingsAsync(
                new GrocerySlotSettingsDto { Enabled = true, StartHour = 20, EndHour = 10, SlotMinutes = 60, Days = 2 }, Guid.NewGuid()));
            await service.SaveSettingsAsync(new GrocerySlotSettingsDto { Enabled = false, StartHour = 9, EndHour = 21, SlotMinutes = 60, LeadMinutes = 30, Days = 1 }, Guid.NewGuid());
            Assert.Null(await service.ResolveAsync(null)); // معطّلة = بلا موعد
        }

        // ===================================
        // الدفع: موعد + تفضيل الاستبدال + وزن الوحدة
        // ===================================
        private OrderService Checkout(Cart cart, Address address)
        {
            var carts = new Mock<ICartRepository>();
            carts.Setup(r => r.GetByUserIdAsync(_customer.Id)).ReturnsAsync(cart);
            var users = new Mock<IUserRepository>();
            users.Setup(r => r.GetByIdAsync(_customer.Id)).ReturnsAsync(_customer);
            var addresses = new Mock<IAddressRepository>();
            addresses.Setup(r => r.GetByIdAsync(address.Id)).ReturnsAsync(address);
            var promotions = new Mock<IPromotionRepository>();
            promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>());
            var inventory = new Mock<IInventoryService>();
            inventory.Setup(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<StockChange>());
            var coupons = new Mock<ICouponRepository>();
            return new OrderService(new OrderRepository(_context), new SubOrderRepository(_context), carts.Object, users.Object,
                addresses.Object, new OrderStatusLogRepository(_context), _notify.Object, _context, new CouponService(coupons.Object),
                coupons.Object, new Mock<ILoyaltyService>().Object, new PromotionService(promotions.Object, _context), inventory.Object,
                NullLogger<OrderService>.Instance, new DeliverySlotService(_context, _time));
        }

        [Fact]
        public async Task Checkout_WithGroceryItems_RequiresSlot_AndStoresPreferenceAndWeight()
        {
            var tomatoes = AddProduct("طماطم", _grocery, price: 750, weightStep: 0.5m);
            var address = new Address { UserId = _customer.Id, Latitude = 32.5051m, Longitude = 45.8243m, StreetAddress = "1", City = "الكوت", Phone = "0770" };
            _context.Add(address);
            _context.SaveChanges();
            var cart = new Cart { UserId = _customer.Id, Items = new List<CartItem> { new() { ProductId = tomatoes.Id, Product = tomatoes, Quantity = 3 } } };
            var service = Checkout(cart, address);

            var noSlot = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateOrderFromCartAsync(_customer.Id,
                new CreateOrderDto { AddressId = address.Id, CustomerNotes = "" }));
            Assert.Contains("موعد", noSlot.Message);

            var slotStart = new DateTime(2026, 10, 6, 13, 0, 0, DateTimeKind.Utc);
            var order = await service.CreateOrderFromCartAsync(_customer.Id, new CreateOrderDto
            {
                AddressId = address.Id, CustomerNotes = "", DeliverySlotStart = slotStart, SubstitutionPreference = "similar"
            });

            Assert.Equal(slotStart, order.DeliverySlotStart);
            Assert.Equal(slotStart.AddHours(2), order.DeliverySlotEnd);
            Assert.Equal(SubstitutionPreference.Similar, order.SubstitutionPreference);
            var item = await _context.SubOrderItems.SingleAsync();
            Assert.Equal(0.5m, item.WeightStepKg);
            Assert.Equal(2250, item.Subtotal); // 3 وحدات × 750 (= 1.5 كغم بسعر 1500/كغم)
        }

        [Fact]
        public async Task Checkout_WithoutGroceryItems_NeedsNoSlot()
        {
            var phone = AddProduct("هاتف", _electronics, price: 100000);
            var address = new Address { UserId = _customer.Id, Latitude = 32.5051m, Longitude = 45.8243m, StreetAddress = "1", City = "الكوت", Phone = "0770" };
            _context.Add(address);
            _context.SaveChanges();
            var cart = new Cart { UserId = _customer.Id, Items = new List<CartItem> { new() { ProductId = phone.Id, Product = phone, Quantity = 1 } } };

            var order = await Checkout(cart, address).CreateOrderFromCartAsync(_customer.Id, new CreateOrderDto { AddressId = address.Id, CustomerNotes = "" });

            Assert.Null(order.DeliverySlotStart);
            Assert.Null(order.SubstitutionPreference);
        }

        // ===================================
        // الاستبدال عند القبول الجزئي
        // ===================================
        private (SubOrder Sub, SubOrderItem Milk) SeedPendingOrder(string preference)
        {
            var milkProduct = AddProduct("حليب كامل", _grocery, price: 5000);
            var address = new Address { UserId = _customer.Id, Latitude = 32.5051m, Longitude = 45.8243m, StreetAddress = "1", City = "الكوت", Phone = "0770" };
            _context.Add(address);
            var order = new Order
            {
                OrderNumber = "ORD-9", CustomerId = _customer.Id, AddressId = address.Id, Status = OrderStatus.PENDING_CONFIRMATION,
                Subtotal = 10000, DeliveryFees = 2000, TotalAmount = 12000, CustomerNotes = "", SubstitutionPreference = preference
            };
            var sub = new SubOrder { OrderId = order.Id, VendorId = _store.Id, SubOrderNumber = "ORD-9-V1", Status = SubOrderStatus.PendingConfirmation, Subtotal = 10000, DeliveryFee = 2000 };
            var milk = new SubOrderItem { SubOrderId = sub.Id, ProductId = milkProduct.Id, ProductName = "milk", ProductNameAr = "حليب كامل", Quantity = 2, UnitPrice = 5000, Subtotal = 10000 };
            _context.AddRange(order, sub, milk);
            _context.SaveChanges();
            return (sub, milk);
        }

        private VendorDashboardService Vendor(Mock<IInventoryService> inventory) => new(_context, inventory.Object, _notify.Object);

        private static Mock<IInventoryService> Inventory()
        {
            var inventory = new Mock<IInventoryService>();
            inventory.Setup(i => i.RestockAsync(It.IsAny<IEnumerable<StockLineQuantity>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<StockChange>());
            inventory.Setup(i => i.ReserveAsync(It.IsAny<IEnumerable<StockLine>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<StockChange>());
            return inventory;
        }

        [Fact]
        public async Task PartialAccept_WithSimilarPreference_AddsReplacementAtNoExtraCost()
        {
            var (sub, milk) = SeedPendingOrder(SubstitutionPreference.Similar);
            var pricier = AddProduct("حليب قليل الدسم", _grocery, price: 6000);
            var inventory = Inventory();

            var result = await Vendor(inventory).ConfirmOrderAsync(_store.Id, sub.Id, Guid.NewGuid(), new[]
            {
                new UnavailableItemDto { ItemId = milk.Id, Quantity = 1, ReplacementProductId = pricier.Id }
            });

            var replacement = result.Items.Single(i => i.ReplacesItemId == milk.Id);
            Assert.Equal(pricier.Id, replacement.ProductId);
            Assert.Equal(5000, replacement.UnitPrice);        // الأقل بين 6000 و5000
            Assert.Equal(1, replacement.Quantity);
            Assert.Equal(10000, result.Subtotal);             // 5000 المتبقي + 5000 البديل
            inventory.Verify(i => i.ReserveAsync(It.Is<IEnumerable<StockLine>>(l => l.Single().ProductId == pricier.Id && l.Single().Quantity == 1),
                It.IsAny<CancellationToken>()), Times.Once);
            _notify.Verify(n => n.NotifyCustomerOrderNoticeAsync(_customer.Id, It.Is<string>(m => m.Contains("استُبدل")), It.IsAny<object?>()), Times.Once);
        }

        [Fact]
        public async Task PartialAccept_ReplacementRejected_WhenCustomerChoseRemove()
        {
            var (sub, milk) = SeedPendingOrder(SubstitutionPreference.Remove);
            var other = AddProduct("حليب آخر", _grocery);

            var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => Vendor(Inventory()).ConfirmOrderAsync(_store.Id, sub.Id, Guid.NewGuid(), new[]
            {
                new UnavailableItemDto { ItemId = milk.Id, Quantity = 1, ReplacementProductId = other.Id }
            }));
            Assert.Contains("حذف", ex.Message);
        }

        // ===================================
        // البيع بالوزن + اشترِ مجدداً
        // ===================================
        private ProductService Products()
        {
            var promotions = new Mock<IPromotionRepository>();
            promotions.Setup(p => p.GetActivePromotionsAsync()).ReturnsAsync(new List<Promotion>());
            return new ProductService(new ProductRepository(_context), new Mock<IVendorRepository>().Object,
                new ProductImageRepository(_context), new Mock<IFileService>().Object, _context, promotions.Object,
                new Mock<IInventoryService>().Object);
        }

        [Fact]
        public async Task WeightStep_OnlyAllowedValues()
        {
            var dto = new CreateProductDto { VendorId = _store.Id, Name = "x", NameAr = "x", Description = "x", Price = 1000, WeightStepKg = 0.3m };
            await Assert.ThrowsAsync<BusinessRuleException>(() => Products().CreateAsync(dto));

            dto.WeightStepKg = 0.25m;
            Assert.Equal(0.25m, (await Products().CreateAsync(dto)).WeightStepKg);
        }

        [Fact]
        public async Task BuyAgain_MostOrderedFirst_InStockOnly_AndScoped()
        {
            var milk = AddProduct("حليب", _grocery);
            var bread = AddProduct("خبز", _grocery);
            var soldOut = AddProduct("بيض", _grocery, stock: 0);
            var phone = AddProduct("هاتف", _electronics);
            var order = new Order { OrderNumber = "ORD-1", CustomerId = _customer.Id, AddressId = Guid.NewGuid(), Status = OrderStatus.DELIVERED, CustomerNotes = "" };
            var cancelled = new Order { OrderNumber = "ORD-2", CustomerId = _customer.Id, AddressId = Guid.NewGuid(), Status = OrderStatus.CANCELLED, CustomerNotes = "" };
            var sub = new SubOrder { OrderId = order.Id, VendorId = _store.Id, SubOrderNumber = "ORD-1-V1", Status = SubOrderStatus.Delivered };
            var cancelledSub = new SubOrder { OrderId = cancelled.Id, VendorId = _store.Id, SubOrderNumber = "ORD-2-V1", Status = SubOrderStatus.Cancelled };
            SubOrderItem Line(SubOrder s, Product p) => new() { SubOrderId = s.Id, ProductId = p.Id, ProductName = p.Name, Quantity = 1, UnitPrice = 1, Subtotal = 1 };
            _context.AddRange(order, cancelled, sub, cancelledSub,
                Line(sub, bread), Line(sub, milk), Line(sub, milk), Line(sub, soldOut), Line(sub, phone),
                Line(cancelledSub, bread), Line(cancelledSub, bread), Line(cancelledSub, bread));
            await _context.SaveChangesAsync();

            var grocery = await Products().GetBuyAgainAsync(_customer.Id, ShopScope.Grocery);
            var all = await Products().GetBuyAgainAsync(_customer.Id);

            Assert.Equal(new[] { milk.Id, bread.Id }, grocery.Select(p => p.Id)); // الطلب الملغي لا يُحسب، والنافد لا يظهر
            Assert.Contains(all, p => p.Id == phone.Id);
        }

        // ===================================
        // أعلمني عند التوفر + تذكير السلة
        // ===================================
        private CustomerEngagementService Engagement() => new(_context, _notify.Object, NullLogger<CustomerEngagementService>.Instance, _time);

        [Fact]
        public async Task StockAlert_OnlyForOutOfStock_NotifiesOnceWhenRestocked()
        {
            var product = AddProduct("بيض", _grocery, stock: 0);
            var inStock = AddProduct("حليب", _grocery);
            var service = Engagement();

            await Assert.ThrowsAsync<BusinessRuleException>(() => service.SubscribeStockAlertAsync(_customer.Id, inStock.Id, null));
            Assert.True((await service.SubscribeStockAlertAsync(_customer.Id, product.Id, null)).Subscribed);
            await service.SubscribeStockAlertAsync(_customer.Id, product.Id, null); // مكرر لا يُنشئ سجلاً ثانياً
            Assert.Equal(1, await _context.StockAlerts.CountAsync());

            Assert.Equal(0, await service.ProcessStockAlertsAsync()); // ما زال نافداً

            product.StockQuantity = 5;
            product.IsAvailable = true;
            await _context.SaveChangesAsync();
            Assert.Equal(1, await service.ProcessStockAlertsAsync());
            Assert.Equal(0, await service.ProcessStockAlertsAsync());

            _notify.Verify(n => n.NotifyCustomerReminderAsync(_customer.Id, It.Is<string>(m => m.Contains("متوفر الآن")),
                It.Is<object?>(d => JsonSerializer.Serialize(d, (JsonSerializerOptions?)null).Contains($"/products/{product.Id}"))), Times.Once);
            Assert.False((await service.GetStockAlertAsync(_customer.Id, product.Id, null)).Subscribed);
        }

        [Fact]
        public async Task CartReminder_AfterIdleHours_OncePerCartChange()
        {
            var product = AddProduct("حليب", _grocery);
            var now = _time.GetUtcNow().UtcDateTime;
            var cart = new Cart { UserId = _customer.Id, CreatedAt = now.AddHours(-5), UpdatedAt = now.AddHours(-5) };
            var item = new CartItem { CartId = cart.Id, ProductId = product.Id, Quantity = 2, CreatedAt = now.AddHours(-5), UpdatedAt = now.AddHours(-4) };
            _context.AddRange(cart, item);
            await _context.SaveChangesAsync();
            var service = Engagement();
            Assert.Equal(1, await service.ProcessCartRemindersAsync());
            Assert.Equal(0, await service.ProcessCartRemindersAsync()); // لم تتغير السلة

            // تعديل جديد (بعد التذكير) ثم خمول جديد → تذكير جديد
            _time.Advance(TimeSpan.FromMinutes(10));
            item.UpdatedAt = _time.GetUtcNow().UtcDateTime;
            await _context.SaveChangesAsync();
            Assert.Equal(0, await service.ProcessCartRemindersAsync()); // لم تمر 3 ساعات بعد
            _time.Advance(TimeSpan.FromHours(3));
            Assert.Equal(1, await service.ProcessCartRemindersAsync());

            _notify.Verify(n => n.NotifyCustomerReminderAsync(_customer.Id, It.Is<string>(m => m.Contains("سلتك")), It.IsAny<object?>()), Times.Exactly(2));
        }

        // ===================================
        // العروض المحدودة
        // ===================================
        [Fact]
        public async Task FlashDeals_RequireFutureEnd_AndHideAfterExpiry()
        {
            var phone = AddProduct("هاتف", _electronics);
            var home = new HomeService(_context, new Mock<IFileService>().Object);

            await Assert.ThrowsAsync<BusinessRuleException>(() => home.CreateSectionAsync(new CreateHomeSectionDto { Type = "flash_deals", Title = "flash" }));
            var created = await home.CreateSectionAsync(new CreateHomeSectionDto
            {
                Type = "flash_deals", Title = "flash", EndsAt = DateTime.UtcNow.AddHours(5), ProductIds = new List<Guid> { phone.Id }
            });
            Assert.NotNull(created.EndsAt);
            var page = await home.GetHomePageAsync();
            Assert.Single(page.Sections, s => s.Id == created.Id && s.Data != null);

            var section = await _context.HomeSections.SingleAsync(s => s.Id == created.Id);
            section.EndsAt = DateTime.UtcNow.AddMinutes(-1);
            await _context.SaveChangesAsync();
            Assert.DoesNotContain((await home.GetHomePageAsync()).Sections, s => s.Id == created.Id);
        }

        // ===================================
        // ادعُ صديقاً
        // ===================================
        [Fact]
        public async Task Referral_CodeCreatedOnce_RewardsBothSidesOnce()
        {
            var loyalty = new LoyaltyService(_context, _notify.Object);
            var info = await loyalty.GetReferralAsync(_customer.Id);
            Assert.Matches("^[A-Z2-9]{7}$", info.Code);
            Assert.Equal(info.Code, (await loyalty.GetReferralAsync(_customer.Id)).Code);
            Assert.Equal(200, info.RewardPoints);

            var friend = new User
            {
                Phone = "07709999999", FullName = "صديق", Role = UserRoles.Customer, PasswordHash = "x", IsActive = true,
                ReferredByUserId = await loyalty.ResolveReferrerAsync(info.Code.ToLower())
            };
            _context.Add(friend);
            await _context.SaveChangesAsync();
            Assert.Equal(_customer.Id, friend.ReferredByUserId);
            Assert.Null(await loyalty.ResolveReferrerAsync("NOPE123"));

            Assert.Equal(200, await loyalty.RewardReferralAsync(friend.Id));
            Assert.Equal(0, await loyalty.RewardReferralAsync(friend.Id)); // مرة واحدة فقط

            var balances = await _context.LoyaltyAccounts.ToDictionaryAsync(a => a.UserId, a => a.Balance);
            Assert.Equal(200, balances[_customer.Id]);
            Assert.Equal(200, balances[friend.Id]);
            var stats = await loyalty.GetReferralAsync(_customer.Id);
            Assert.Equal(1, stats.InvitedCount);
            Assert.Equal(1, stats.RewardedCount);
        }

        // ===================================
        // وجهة إشعار التذكير
        // ===================================
        [Fact]
        public async Task ReminderNotification_OpensItsInternalLink_ForCustomersOnly()
        {
            var internalLink = new Notification { UserId = _customer.Id, Type = "GENERAL", Message = "m", Data = "{\"link\":\"/cart\"}" };
            var external = new Notification { UserId = _customer.Id, Type = "GENERAL", Message = "m", Data = "{\"link\":\"//evil.example\"}" };
            _context.AddRange(internalLink, external);
            await _context.SaveChangesAsync();
            var links = new NotificationLinkService(_context);

            Assert.Equal("/cart", await links.GetLinkAsync(internalLink.Id, _customer.Id, "CUSTOMER"));
            Assert.Null(await links.GetLinkAsync(external.Id, _customer.Id, "CUSTOMER"));
        }

        private sealed class FakeTime : TimeProvider
        {
            private DateTimeOffset _now;
            public FakeTime(DateTime utc) => _now = new DateTimeOffset(utc);
            public override DateTimeOffset GetUtcNow() => _now;
            public void Advance(TimeSpan by) => _now = _now.Add(by);
        }
    }
}
