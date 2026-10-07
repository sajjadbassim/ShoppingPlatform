using ecommerce.Core.Constants;
using ecommerce.Core.DTO.CouponDto;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Repositories;
using ecommerce.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using LoyaltyServiceImpl = ecommerce.Services.LoyaltyService.LoyaltyService;

namespace ecommerce.Tests.Services
{
    // قواعد صلاحية الكوبون وحساب الخصم
    public class CouponValidationTests
    {
        private readonly Mock<ICouponRepository> _repository = new();
        private readonly Guid _userId = Guid.NewGuid();
        private readonly Coupon _coupon = new()
        {
            Code = "SAVE", DiscountType = DiscountType.PERCENTAGE, DiscountValue = 20, IsActive = true, UserUsageLimit = 1
        };

        public CouponValidationTests()
        {
            _repository.Setup(r => r.GetByCodeAsync("SAVE")).ReturnsAsync(_coupon);
        }

        private Task<CouponValidationResultDto> Validate(decimal amount = 100000) =>
            new CouponService(_repository.Object).ValidateAsync(_userId, new ValidateCouponDto { Code = "SAVE", OrderAmount = amount });

        [Fact]
        public async Task Percentage_IsCappedByMaxDiscount()
        {
            _coupon.MaxDiscountAmount = 5000;

            var result = await Validate(100000);

            Assert.True(result.IsValid);
            Assert.Equal(5000, result.DiscountAmount);
            Assert.Equal(95000, result.FinalAmount);
        }

        [Fact]
        public async Task Fixed_NeverExceedsOrderAmount()
        {
            _coupon.DiscountType = DiscountType.FIXED;
            _coupon.DiscountValue = 15000;

            var result = await Validate(10000);

            Assert.Equal(10000, result.DiscountAmount);
            Assert.Equal(0, result.FinalAmount);
        }

        [Fact]
        public async Task UnknownCode_IsInvalid() =>
            Assert.False((await new CouponService(_repository.Object)
                .ValidateAsync(_userId, new ValidateCouponDto { Code = "NOPE", OrderAmount = 1000 })).IsValid);

        [Fact]
        public async Task Inactive_IsInvalid()
        {
            _coupon.IsActive = false;
            Assert.False((await Validate()).IsValid);
        }

        [Fact]
        public async Task Expired_IsInvalid()
        {
            _coupon.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            Assert.False((await Validate()).IsValid);
        }

        [Fact]
        public async Task NotStartedYet_IsInvalid()
        {
            _coupon.StartsAt = DateTime.UtcNow.AddHours(1);
            Assert.False((await Validate()).IsValid);
        }

        [Fact]
        public async Task GlobalLimitReached_IsInvalid()
        {
            _coupon.UsageLimit = 3;
            _coupon.UsageCount = 3;
            Assert.False((await Validate()).IsValid);
        }

        [Fact]
        public async Task UserLimitReached_IsInvalid()
        {
            _repository.Setup(r => r.GetUserUsageCountAsync(_coupon.Id, _userId)).ReturnsAsync(1);
            Assert.False((await Validate()).IsValid);
        }

        [Fact]
        public async Task BelowMinimumOrder_IsInvalid()
        {
            _coupon.MinOrderAmount = 50000;
            Assert.False((await Validate(49999)).IsValid);
        }
    }

    // نقاط الولاء عند التسليم: كل متجر في الطلب يمنح نقاطه مرة واحدة
    public class LoyaltyEarnTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly LoyaltyServiceImpl _service;
        private readonly Guid _customer = Guid.NewGuid();
        private readonly Guid _order = Guid.NewGuid();

        public LoyaltyEarnTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
            _context.LoyaltySettings.Add(new LoyaltySettings { IsActive = true, PointsPerCurrencyUnit = 0.01m, PointsExpiryDays = 0 });
            _context.SaveChanges();
            _service = new LoyaltyServiceImpl(_context);
        }

        public void Dispose() => _context.Dispose();

        private Task<LoyaltyAccount> Account() => _context.LoyaltyAccounts.AsNoTracking().SingleAsync(a => a.UserId == _customer);

        [Fact]
        public async Task MultiStoreOrder_EarnsForEverySubOrder()
        {
            await _service.EarnPointsAsync(_customer, _order, Guid.NewGuid(), 20000);
            await _service.EarnPointsAsync(_customer, _order, Guid.NewGuid(), 30000);

            Assert.Equal(500, (await Account()).Balance);   // 200 + 300
        }

        [Fact]
        public async Task SameSubOrderDeliveredTwice_EarnsOnce()
        {
            var subOrder = Guid.NewGuid();

            await _service.EarnPointsAsync(_customer, _order, subOrder, 20000);
            await _service.EarnPointsAsync(_customer, _order, subOrder, 20000);

            Assert.Equal(200, (await Account()).Balance);
            Assert.Single(await _context.LoyaltyTransactions.ToListAsync());
        }

        [Fact]
        public async Task LegacyOrderLevelEarning_IsNotRepeatedPerSubOrder()
        {
            // سجل قديم بلا مفتاح: الطلب كله كسب نقاطه بالطريقة السابقة
            var account = new LoyaltyAccount { UserId = _customer, Balance = 100, TotalEarned = 100 };
            _context.LoyaltyAccounts.Add(account);
            _context.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                AccountId = account.Id, Type = LoyaltyTransactionType.Earned, Points = 100, OrderId = _order, Description = "old"
            });
            await _context.SaveChangesAsync();

            await _service.EarnPointsAsync(_customer, _order, Guid.NewGuid(), 20000);

            Assert.Equal(100, (await Account()).Balance);
        }
    }

    // أرقام الطلبات اليومية تكمل بعد آخر رقم موجود (مسار InMemory؛ مسار SQL Server عبر عدّاد MERGE)
    public class DailyNumberGeneratorTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task ContinuesAfterLastNumberOfToday_IgnoringOtherDays()
        {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            _context.Orders.AddRange(
                new Order { OrderNumber = $"ORD-{today}-0007" },
                new Order { OrderNumber = "ORD-20200101-0099" });
            await _context.SaveChangesAsync();

            var next = await DailyNumberGenerator.NextAsync(_context, "ORD", _context.Orders.Select(o => o.OrderNumber));

            Assert.Equal($"ORD-{today}-0008", next);
        }
    }
}
