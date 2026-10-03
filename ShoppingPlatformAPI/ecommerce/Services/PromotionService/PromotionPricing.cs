using ecommerce.Core.Constants;
using ecommerce.Core.Models;

namespace ecommerce.Services
{
    // منطق تسعير العروض الموحّد — يستخدمه عرض المنتجات والسلة والطلب
    // حتى يكون السعر المعروض هو نفسه السعر المدفوع.
    public static class PromotionPricing
    {
        private static readonly string[] PriorityOrder =
        {
            PromotionTargetType.PRODUCT,
            PromotionTargetType.CATEGORY,
            PromotionTargetType.VENDOR,
            PromotionTargetType.ALL
        };

        // الأولوية: product > category > vendor > all
        // عند تعدد العروض من نفس النوع: الأحدث إنشاءً (ثم Id لضمان نتيجة ثابتة)
        public static Promotion? SelectBest(
            IEnumerable<Promotion> activePromotions, Guid productId, Guid? categoryId, Guid vendorId)
        {
            var candidates = activePromotions.Where(p =>
                    (p.TargetType == PromotionTargetType.PRODUCT && p.TargetId == productId) ||
                    (p.TargetType == PromotionTargetType.CATEGORY && categoryId.HasValue && p.TargetId == categoryId) ||
                    (p.TargetType == PromotionTargetType.VENDOR && p.TargetId == vendorId) ||
                    p.TargetType == PromotionTargetType.ALL)
                .ToList();

            foreach (var targetType in PriorityOrder)
            {
                var match = candidates
                    .Where(p => p.TargetType == targetType)
                    .OrderByDescending(p => p.CreatedAt)
                    .ThenBy(p => p.Id)
                    .FirstOrDefault();

                if (match != null)
                    return match;
            }

            return null;
        }

        // الخصم يُطبَّق على سعر البيع الحالي (Product.Price) — وهو ما تحسبه السلة والطلب
        public static (decimal FinalPrice, decimal DiscountAmount) CalculateDiscount(decimal price, Promotion promotion)
        {
            decimal discountAmount;

            if (promotion.DiscountType == DiscountType.PERCENTAGE)
            {
                discountAmount = price * (promotion.DiscountValue / 100);

                if (promotion.MaxDiscountAmount.HasValue)
                    discountAmount = Math.Min(discountAmount, promotion.MaxDiscountAmount.Value);
            }
            else // FIXED
            {
                discountAmount = Math.Min(promotion.DiscountValue, price);
            }

            discountAmount = Math.Round(discountAmount, 2);
            var finalPrice = Math.Round(price - discountAmount, 2);

            return (finalPrice, discountAmount);
        }
    }
}
