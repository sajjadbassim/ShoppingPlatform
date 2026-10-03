using ecommerce.Core.Constants;
using ecommerce.Core.Models;
using ecommerce.Services;

namespace ecommerce.Tests.Services
{
    // اختبارات تسعير العروض الموحّد (عرض المنتجات = السلة = الطلب)
    public class PromotionPricingTests
    {
        private static readonly Guid ProductId = Guid.NewGuid();
        private static readonly Guid CategoryId = Guid.NewGuid();
        private static readonly Guid VendorId = Guid.NewGuid();

        private static Promotion Promo(string targetType, Guid? targetId, decimal value,
            string discountType = DiscountType.PERCENTAGE, DateTime? createdAt = null, decimal? max = null) => new()
        {
            Name = $"{targetType}-{value}",
            TargetType = targetType,
            TargetId = targetId,
            DiscountType = discountType,
            DiscountValue = value,
            MaxDiscountAmount = max,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };

        [Fact]
        public void CalculateDiscount_Percentage_AppliesToGivenPrice()
        {
            // منتج سعره 80 (أصلي 100) وعرض 10% → يُدفع 72، لا 90
            var (final, discount) = PromotionPricing.CalculateDiscount(80m, Promo(PromotionTargetType.ALL, null, 10));

            Assert.Equal(72m, final);
            Assert.Equal(8m, discount);
        }

        [Fact]
        public void CalculateDiscount_Percentage_RespectsMaxDiscount()
        {
            var (final, discount) = PromotionPricing.CalculateDiscount(
                1000m, Promo(PromotionTargetType.ALL, null, 50, max: 100));

            Assert.Equal(900m, final);
            Assert.Equal(100m, discount);
        }

        [Fact]
        public void CalculateDiscount_Fixed_NeverGoesBelowZero()
        {
            var (final, discount) = PromotionPricing.CalculateDiscount(
                30m, Promo(PromotionTargetType.ALL, null, 50, DiscountType.FIXED));

            Assert.Equal(0m, final);
            Assert.Equal(30m, discount);
        }

        [Fact]
        public void SelectBest_FollowsTargetPriority()
        {
            var promotions = new[]
            {
                Promo(PromotionTargetType.ALL, null, 5),
                Promo(PromotionTargetType.VENDOR, VendorId, 10),
                Promo(PromotionTargetType.CATEGORY, CategoryId, 15),
                Promo(PromotionTargetType.PRODUCT, ProductId, 20)
            };

            Assert.Equal(PromotionTargetType.PRODUCT,
                PromotionPricing.SelectBest(promotions, ProductId, CategoryId, VendorId)!.TargetType);
            Assert.Equal(PromotionTargetType.CATEGORY,
                PromotionPricing.SelectBest(promotions, Guid.NewGuid(), CategoryId, VendorId)!.TargetType);
            Assert.Equal(PromotionTargetType.VENDOR,
                PromotionPricing.SelectBest(promotions, Guid.NewGuid(), null, VendorId)!.TargetType);
            Assert.Equal(PromotionTargetType.ALL,
                PromotionPricing.SelectBest(promotions, Guid.NewGuid(), null, Guid.NewGuid())!.TargetType);
        }

        [Fact]
        public void SelectBest_SameType_PicksNewestRegardlessOfInputOrder()
        {
            var older = Promo(PromotionTargetType.VENDOR, VendorId, 10, createdAt: DateTime.UtcNow.AddDays(-2));
            var newer = Promo(PromotionTargetType.VENDOR, VendorId, 30, createdAt: DateTime.UtcNow);

            Assert.Same(newer, PromotionPricing.SelectBest(new[] { older, newer }, ProductId, null, VendorId));
            Assert.Same(newer, PromotionPricing.SelectBest(new[] { newer, older }, ProductId, null, VendorId));
        }

        [Fact]
        public void SelectBest_IgnoresPromotionsForOtherTargets()
        {
            var promotions = new[]
            {
                Promo(PromotionTargetType.PRODUCT, Guid.NewGuid(), 50),
                Promo(PromotionTargetType.CATEGORY, Guid.NewGuid(), 50)
            };

            Assert.Null(PromotionPricing.SelectBest(promotions, ProductId, CategoryId, VendorId));
        }
    }
}
