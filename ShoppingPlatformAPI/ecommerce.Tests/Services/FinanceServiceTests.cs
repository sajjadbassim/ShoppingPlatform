using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.FinanceService;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ecommerce.Tests.Services
{
    // دفتر حساب المتجر: المبيعات، العمولة، الخصومات، المرتجعات، والدفعات
    public class FinanceServiceTests : IDisposable
    {
        private readonly AppDbContext _context = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options);
        private readonly Vendor _vendor = new() { Name = "Shop", NameAr = "المتجر" };
        private readonly Vendor _other = new() { Name = "Other", NameAr = "متجر آخر" };
        private readonly Product _shirt, _shoes;

        public FinanceServiceTests()
        {
            _shirt = new Product { VendorId = _vendor.Id, Name = "Shirt" };
            _shoes = new Product { VendorId = _vendor.Id, Name = "Shoes" };
            _context.AddRange(_vendor, _other, _shirt, _shoes,
                new DeliverySettings { DefaultCommissionType = CommissionType.Percentage, DefaultCommissionValue = 10 });
            _context.SaveChanges();
        }

        public void Dispose() => _context.Dispose();
        private FinanceService Service() => new(_context);

        // طلب فيه قميصان (15,000) وحذاء (25,000) = 55,000 + أجرة 5,000
        private SubOrder Delivered(Vendor vendor, int refusedShirts = 0, string? coupon = null, decimal discount = 0,
            string? feePayer = null, string status = "DELIVERED")
        {
            var order = new Order { OrderNumber = $"ORD-{Guid.NewGuid():N}"[..10], CouponCode = coupon, DiscountAmount = discount, RefusalFeePayer = feePayer };
            var sub = new SubOrder { OrderId = order.Id, Order = order, VendorId = vendor.Id, Status = status, DeliveryFee = 5_000, Subtotal = 55_000, SubOrderNumber = "S" };
            sub.Items = new List<SubOrderItem>
            {
                new() { SubOrderId = sub.Id, ProductId = _shirt.Id, UnitPrice = 15_000, Quantity = 2, RefusedQuantity = refusedShirts },
                new() { SubOrderId = sub.Id, ProductId = _shoes.Id, UnitPrice = 25_000, Quantity = 1 },
            };
            _context.AddRange(order, sub);
            _context.SaveChanges();
            return sub;
        }

        private decimal Sum(string type) => _context.VendorLedgerEntries.Where(e => e.Type == type).Sum(e => e.Amount);

        [Fact]
        public async Task Delivery_RecordsSaleAndPercentageCommission_Once()
        {
            var sub = Delivered(_vendor);
            await Service().EnsureSubOrderEntriesAsync(sub.Id);
            await Service().EnsureSubOrderEntriesAsync(sub.Id);   // مرة ثانية: لا تكرار

            Assert.Equal(55_000, Sum(LedgerType.Sale));
            Assert.Equal(-5_500, Sum(LedgerType.Commission));     // 10%
            Assert.Equal(2, await _context.VendorLedgerEntries.CountAsync());
            Assert.Equal(49_500, (await Service().GetBalancesAsync()).Single(b => b.VendorId == _vendor.Id).Balance);
        }

        [Fact]
        public async Task RefusedItems_AreNotSales()
        {
            var sub = Delivered(_vendor, refusedShirts: 1);
            await Service().EnsureSubOrderEntriesAsync(sub.Id);
            Assert.Equal(40_000, Sum(LedgerType.Sale));
            Assert.Equal(-4_000, Sum(LedgerType.Commission));
        }

        [Fact]
        public async Task FixedCommission_PerOrder_AndRateIsFrozenAtDelivery()
        {
            await Service().SetVendorCommissionAsync(_vendor.Id, new CommissionDto { Type = CommissionType.Fixed, Value = 2_000 });
            var sub = Delivered(_vendor);
            await Service().EnsureSubOrderEntriesAsync(sub.Id);
            Assert.Equal(-2_000, Sum(LedgerType.Commission));

            // تغيير العمولة لاحقاً لا يغيّر طلباً سُجّل
            await Service().SetVendorCommissionAsync(_vendor.Id, new CommissionDto { Type = CommissionType.Percentage, Value = 50 });
            await Service().EnsureSubOrderEntriesAsync(sub.Id);
            Assert.Equal(-2_000, Sum(LedgerType.Commission));
        }

        [Fact]
        public async Task VendorCoupon_ChargedToVendor_PlatformCouponNot()
        {
            _context.Coupons.AddRange(
                new Coupon { Code = "SHOP10", VendorId = _vendor.Id },
                new Coupon { Code = "ALL10", VendorId = null });
            _context.SaveChanges();

            await Service().EnsureSubOrderEntriesAsync(Delivered(_vendor, coupon: "SHOP10", discount: 5_000).Id);
            await Service().EnsureSubOrderEntriesAsync(Delivered(_vendor, coupon: "ALL10", discount: 7_000).Id);

            Assert.Equal(-5_000, Sum(LedgerType.VendorCoupon));
        }

        [Fact]
        public async Task RefusalFee_OnVendor_ForPartialAndFullRefusal()
        {
            await Service().EnsureSubOrderEntriesAsync(Delivered(_vendor, refusedShirts: 1, feePayer: RefusalFeePayer.Vendor).Id);
            var failed = Delivered(_vendor, feePayer: RefusalFeePayer.Vendor, status: OrderStatus.DELIVERY_FAILED);
            failed.FailureReason = DeliveryFailureReason.CustomerRefused; _context.SaveChanges();
            await Service().EnsureSubOrderEntriesAsync(failed.Id);
            // الأجرة على الزبون أو المنصة: لا شيء على المتجر
            await Service().EnsureSubOrderEntriesAsync(Delivered(_vendor, refusedShirts: 1, feePayer: RefusalFeePayer.Customer).Id);

            Assert.Equal(-10_000, Sum(LedgerType.RefusalFee));
        }

        [Fact]
        public async Task ApprovedReturn_Deducted_WithCommissionRefund_DoorRefusalIgnored()
        {
            var sub = Delivered(_vendor);
            await Service().EnsureSubOrderEntriesAsync(sub.Id);

            var ret = new Return { OrderId = sub.OrderId, ReturnNumber = "RET-1", Status = ReturnStatus.APPROVED,
                Items = { new ReturnItem { ProductId = _shoes.Id, Quantity = 1, UnitPrice = 25_000 } } };
            var door = new Return { OrderId = sub.OrderId, ReturnNumber = "RET-2", Status = ReturnStatus.APPROVED, IsDoorRefusal = true,
                Items = { new ReturnItem { ProductId = _shirt.Id, Quantity = 1, UnitPrice = 15_000 } } };
            _context.AddRange(ret, door); _context.SaveChanges();

            await Service().EnsureReturnEntriesAsync(ret.Id);
            await Service().EnsureReturnEntriesAsync(ret.Id);
            await Service().EnsureReturnEntriesAsync(door.Id);

            Assert.Equal(-25_000, Sum(LedgerType.Return));
            Assert.Equal(2_500, Sum(LedgerType.ReturnCommission));   // 10% من 25,000
            Assert.Equal(55_000 - 5_500 - 25_000 + 2_500, (await Service().GetBalancesAsync()).Single(b => b.VendorId == _vendor.Id).Balance);
        }

        [Fact]
        public async Task Payout_ReducesBalance_AndStatementRunsBalance()
        {
            await Service().EnsureSubOrderEntriesAsync(Delivered(_vendor).Id);
            await Service().RecordPayoutAsync(_vendor.Id, 30_000, "زين كاش 123", null, Guid.NewGuid());
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().RecordPayoutAsync(_vendor.Id, 0, null, null, Guid.NewGuid()));
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().RecordAdjustmentAsync(_vendor.Id, 1_000, " ", Guid.NewGuid()));

            var st = await Service().GetStatementAsync(_vendor.Id);
            Assert.Equal(19_500, st.Summary.Balance);
            Assert.Equal(30_000, st.Summary.Payouts);
            Assert.Equal(19_500, st.Entries.First().RunningBalance);   // الأحدث أولاً
            Assert.Equal(0, (await Service().GetBalancesAsync()).Single(b => b.VendorId == _other.Id).Balance);
        }

        [Fact]
        public async Task Backfill_CoversPastOrders_AndIsRepeatable()
        {
            Delivered(_vendor); Delivered(_other);
            Delivered(_vendor, status: OrderStatus.OUT_FOR_DELIVERY);   // لم يُسلَّم: لا شيء
            await Service().BackfillAsync();
            await Service().BackfillAsync();
            Assert.Equal(110_000, Sum(LedgerType.Sale));
        }

        [Theory]
        [InlineData("PERCENTAGE", 120)]
        [InlineData("FIXED", -1)]
        [InlineData("OTHER", 5)]
        public async Task InvalidCommission_Rejected(string type, decimal value) =>
            await Assert.ThrowsAsync<BusinessRuleException>(() => Service().SetDefaultCommissionAsync(new CommissionDto { Type = type, Value = value }, Guid.NewGuid()));
    }
}
