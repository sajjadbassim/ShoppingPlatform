using ecommerce.Core.Constants;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using ecommerce.Services.FinanceService;
using ecommerce.Services.InventoryService;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ecommerce.Tests.Services
{
    // كوبونات المتجر وعروضه، قائمة التقييمات، والتقارير بفترة مخصصة
    public class VendorMarketingTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly Vendor _store;
        private readonly Vendor _other;
        private readonly Product _mine;
        private readonly Product _theirs;
        private readonly Guid _user = Guid.NewGuid();

        public VendorMarketingTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _store = new Vendor { Name = "Mine", NameAr = "متجري", OwnerId = Guid.NewGuid(), IsActive = true };
            _other = new Vendor { Name = "Other", NameAr = "آخر", OwnerId = Guid.NewGuid(), IsActive = true };
            _mine = new Product { VendorId = _store.Id, Name = "a", NameAr = "قميص", Price = 10000 };
            _theirs = new Product { VendorId = _other.Id, Name = "b", NameAr = "حذاء", Price = 10000 };
            _context.AddRange(_store, _other, _mine, _theirs);
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();

        private CouponService Coupons() => new(new CouponRepository(_context));
        private VendorMarketingService Marketing() => new(_context, Coupons());

        // ===== الكوبون يُحسب على حصة متجره فقط =====
        private async Task<Coupon> StoreCoupon(decimal minOrder = 0)
        {
            var c = new Coupon { Code = "MINE10", DiscountType = DiscountType.PERCENTAGE, DiscountValue = 10, VendorId = _store.Id, IsActive = true, MinOrderAmount = minOrder };
            _context.Coupons.Add(c);
            await _context.SaveChangesAsync();
            return c;
        }

        [Fact]
        public async Task StoreCoupon_DiscountsOnlyThatStoresShare()
        {
            await StoreCoupon();
            var result = await Coupons().ValidateAsync(_user, new ValidateCouponDto { Code = "MINE10", OrderAmount = 100000 },
                new Dictionary<Guid, decimal> { [_store.Id] = 20000, [_other.Id] = 80000 });

            Assert.True(result.IsValid);
            Assert.Equal(2000, result.DiscountAmount);   // 10% من 20000 لا من 100000
        }

        [Fact]
        public async Task StoreCoupon_WithoutThatStoresProducts_IsInvalid()
        {
            await StoreCoupon();
            var result = await Coupons().ValidateAsync(_user, new ValidateCouponDto { Code = "MINE10", OrderAmount = 50000 },
                new Dictionary<Guid, decimal> { [_other.Id] = 50000 });

            Assert.False(result.IsValid);
            Assert.Contains("متجري", result.ErrorMessage);
        }

        [Fact]
        public async Task StoreCoupon_MinimumAppliesToStoreShare()
        {
            await StoreCoupon(minOrder: 30000);
            var result = await Coupons().ValidateAsync(_user, new ValidateCouponDto { Code = "MINE10", OrderAmount = 100000 },
                new Dictionary<Guid, decimal> { [_store.Id] = 20000, [_other.Id] = 80000 });

            Assert.False(result.IsValid);
        }

        // ===== عروض التاجر =====
        [Fact]
        public async Task Promotion_OnOwnProduct_IsCreated_OnOthersProduct_IsRejected()
        {
            var created = await Marketing().CreatePromotionAsync(_store.Id, new SaveVendorPromotionDto
            { Name = "تخفيض", TargetType = PromotionTargetType.PRODUCT, ProductId = _mine.Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 20 });
            Assert.True(created.IsOwn);
            Assert.Equal("قميص", created.TargetName);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Marketing().CreatePromotionAsync(_store.Id, new SaveVendorPromotionDto
            { Name = "x", TargetType = PromotionTargetType.PRODUCT, ProductId = _theirs.Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 20 }));
        }

        [Fact]
        public async Task Promotion_StoreWide_TargetsOwnStoreOnly_AndCannotBeCategoryOrAll()
        {
            var created = await Marketing().CreatePromotionAsync(_store.Id, new SaveVendorPromotionDto
            { Name = "كل المتجر", TargetType = PromotionTargetType.VENDOR, DiscountType = DiscountType.FIXED, DiscountValue = 1000 });
            Assert.Equal(_store.Id, created.TargetId);

            await Assert.ThrowsAsync<BusinessRuleException>(() => Marketing().CreatePromotionAsync(_store.Id, new SaveVendorPromotionDto
            { Name = "x", TargetType = PromotionTargetType.ALL, DiscountType = DiscountType.FIXED, DiscountValue = 1000 }));
        }

        [Fact]
        public async Task PlatformPromotion_IsListedReadOnly_AndCannotBeEdited()
        {
            var platform = new Promotion { Name = "منصة", TargetType = PromotionTargetType.PRODUCT, TargetId = _mine.Id, DiscountType = DiscountType.PERCENTAGE, DiscountValue = 5, IsActive = true };
            _context.Promotions.Add(platform);
            await _context.SaveChangesAsync();

            var listed = Assert.Single(await Marketing().GetPromotionsAsync(_store.Id));
            Assert.False(listed.IsOwn);
            await Assert.ThrowsAsync<NotFoundException>(() => Marketing().DeletePromotionAsync(_store.Id, platform.Id));
        }

        [Fact]
        public async Task StoreCoupons_ForcedToOwnStore_AndUsedCouponIsDeactivatedNotDeleted()
        {
            var coupon = await Marketing().CreateCouponAsync(_store.Id, new CreateCouponDto { Code = "new5", DiscountType = DiscountType.PERCENTAGE, DiscountValue = 5, VendorId = _other.Id });
            Assert.Equal(_store.Id, coupon.VendorId);

            _context.CouponUsages.Add(new CouponUsage { CouponId = coupon.Id, UserId = _user, OrderId = Guid.NewGuid(), DiscountAmount = 100 });
            await _context.SaveChangesAsync();
            _context.ChangeTracker.Clear();   // طلب منفصل كما في الخادم
            await Marketing().DeleteCouponAsync(_store.Id, coupon.Id);

            var stored = await _context.Coupons.AsNoTracking().SingleAsync(c => c.Id == coupon.Id);
            Assert.False(stored.IsActive);
            await Assert.ThrowsAsync<NotFoundException>(() => Marketing().DeleteCouponAsync(_other.Id, coupon.Id));
        }

        // ===== التقييمات في قائمة واحدة =====
        [Fact]
        public async Task ReviewsFeed_FiltersUnanswered()
        {
            var customer = new User { Phone = "0770", FullName = "زبون", Role = UserRoles.Customer, PasswordHash = "x" };
            _context.Users.Add(customer);
            _context.Reviews.AddRange(
                new Review { ProductId = _mine.Id, UserId = customer.Id, Rating = 5, Body = "ممتاز", CreatedAt = DateTime.UtcNow.AddHours(-2) },
                new Review { ProductId = _mine.Id, UserId = customer.Id, Rating = 2, Body = "سيء", VendorReply = "نعتذر", CreatedAt = DateTime.UtcNow.AddHours(-1) },
                new Review { ProductId = _theirs.Id, UserId = customer.Id, Rating = 1, Body = "ليس لي" });
            await _context.SaveChangesAsync();
            var service = new VendorDashboardService(_context, new Mock<IInventoryService>().Object);

            var all = await service.GetReviewsFeedAsync(_store.Id);
            var unanswered = await service.GetReviewsFeedAsync(_store.Id, unanswered: true);

            Assert.Equal(new[] { "سيء", "ممتاز" }, all.Data.Select(r => r.Body));
            Assert.Equal("ممتاز", Assert.Single(unanswered.Data).Body);
            Assert.Equal(1, await service.CountUnansweredReviewsAsync(_store.Id));
        }

        // ===== التقارير: فترة مخصصة ومقارنة بالسابقة =====
        [Fact]
        public async Task SalesStats_CustomRange_ComparesWithPreviousPeriod()
        {
            // أيام بغداد: 10–11 أكتوبر (الفترة) و 8–9 أكتوبر (السابقة)
            DateTime BaghdadNoon(int day) => new DateTime(2026, 10, day, 12, 0, 0).AddHours(-3);
            _context.VendorLedgerEntries.AddRange(
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 10000, SubOrderId = Guid.NewGuid(), CreatedAt = BaghdadNoon(10) },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 20000, SubOrderId = Guid.NewGuid(), CreatedAt = BaghdadNoon(11) },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 15000, SubOrderId = Guid.NewGuid(), CreatedAt = BaghdadNoon(8) },
                new VendorLedgerEntry { VendorId = _store.Id, Type = LedgerType.Sale, Amount = 99000, SubOrderId = Guid.NewGuid(), CreatedAt = BaghdadNoon(12) });
            await _context.SaveChangesAsync();

            var stats = await new VendorDashboardService(_context, new Mock<IInventoryService>().Object)
                .GetSalesStatsAsync(_store.Id, "custom", new DateTime(2026, 10, 10), new DateTime(2026, 10, 11));

            Assert.Equal(30000, stats.TotalRevenue);
            Assert.Equal(2, stats.TotalOrders);
            Assert.Equal(15000, stats.PreviousRevenue);
            Assert.Equal(2, stats.SalesByDay.Count);
        }

        [Fact]
        public async Task SalesStats_CustomRange_Validation() =>
            await Assert.ThrowsAsync<BusinessRuleException>(() => new VendorDashboardService(_context, new Mock<IInventoryService>().Object)
                .GetSalesStatsAsync(_store.Id, "custom", new DateTime(2026, 10, 11), new DateTime(2026, 10, 10)));
    }
}
