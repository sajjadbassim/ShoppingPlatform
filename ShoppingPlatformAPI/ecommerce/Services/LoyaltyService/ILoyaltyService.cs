using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Loyalty;

namespace ecommerce.Services
{
    public interface ILoyaltyService
    {
        // ===================================
        // حساب المستخدم
        // ===================================
        Task<LoyaltyAccountDto> GetAccountAsync(Guid userId);
        Task<LoyaltyAccountDto> GetOrCreateAccountAsync(Guid userId);

        // ===================================
        // السجل
        // ===================================
        Task<LoyaltyTransactionPagedDto> GetTransactionsAsync(Guid userId, PaginationParams pagination);

        // ===================================
        // كسب النقاط (يُستدعى من OrderService عند التسليم)
        // ===================================
        Task EarnPointsAsync(Guid userId, Guid orderId, Guid subOrderId, decimal orderAmount);

        // كسب نقاط كتابة تقييم — مرة واحدة لكل منتج، ويعيد عدد النقاط الممنوحة (0 إن لم تُمنح)
        Task<int> EarnReviewPointsAsync(Guid userId, Guid productId);

        // ===================================
        // استرداد النقاط
        // ===================================
        Task<LoyaltyEstimateDto> GetEstimateAsync(Guid userId, decimal orderAmount);
        Task<RedeemPointsResultDto> RedeemPointsAsync(Guid userId, RedeemPointsDto dto);
        Task CancelRedemptionAsync(Guid orderId); // عند إلغاء الطلب — تُعاد النقاط
        Task RefundUnusedPointsAsync(Guid orderId); // سقط جزء ولم يبقَ جزء مفتوح يحمل خصم النقاط — يُعاد للزبون
        Task<ReturnPointsReversal> ReverseReturnPointsAsync(Guid returnId); // عند قبول إرجاع — قيد عكسي لنقاط القطع المُرجعة

        // ادعُ صديقاً: رمز المستخدم وإحصاءاته، ومن صاحب الرمز (عند التسجيل)، والمكافأة عند أول طلب مُسلَّم للمدعو
        Task<ReferralInfoDto> GetReferralAsync(Guid userId);
        Task<Guid?> ResolveReferrerAsync(string? code);
        Task<int> RewardReferralAsync(Guid inviteeId);

        // ===================================
        // Admin
        // ===================================
        Task<LoyaltyAccountDto> AdminAdjustPointsAsync(AdminAdjustPointsDto dto);
        Task<LoyaltySettingsDto> GetSettingsAsync();
        Task<LoyaltySettingsDto> UpdateSettingsAsync(UpdateLoyaltySettingsDto dto);
    }

    // نقاط القطع المُرجعة: ما خُصم من الرصيد، وما لم يُخصم لأن الزبون صرفه (Shortfall) وقيمته بالدينار
    // — القيمة تُخصم من مبلغ الاسترجاع حتى لا يربح الزبون خصماً على قطعة أرجعها
    public record ReturnPointsReversal(int Deducted, int Shortfall, decimal ShortfallValue)
    {
        public static readonly ReturnPointsReversal None = new(0, 0, 0);
    }
}
