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
        Task EarnPointsAsync(Guid userId, Guid orderId, decimal orderAmount);

        // كسب نقاط كتابة تقييم — مرة واحدة لكل منتج، ويعيد عدد النقاط الممنوحة (0 إن لم تُمنح)
        Task<int> EarnReviewPointsAsync(Guid userId, Guid productId);

        // ===================================
        // استرداد النقاط
        // ===================================
        Task<LoyaltyEstimateDto> GetEstimateAsync(Guid userId, decimal orderAmount);
        Task<RedeemPointsResultDto> RedeemPointsAsync(Guid userId, RedeemPointsDto dto);
        Task CancelRedemptionAsync(Guid orderId); // عند إلغاء الطلب — تُعاد النقاط

        // ===================================
        // Admin
        // ===================================
        Task<LoyaltyAccountDto> AdminAdjustPointsAsync(AdminAdjustPointsDto dto);
        Task<LoyaltySettingsDto> GetSettingsAsync();
        Task<LoyaltySettingsDto> UpdateSettingsAsync(UpdateLoyaltySettingsDto dto);
    }
}