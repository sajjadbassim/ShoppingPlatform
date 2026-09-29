using ecommerce.Core.DTO.CouponDto;

namespace ecommerce.Services
{
    public interface ICouponService
    {
        // ===================================
        // للعميل
        // ===================================
        Task<CouponValidationResultDto> ValidateAsync(Guid userId, ValidateCouponDto dto);

        // ===================================
        // Admin
        // ===================================
        Task<CouponDto> GetByIdAsync(Guid id);
        Task<IEnumerable<CouponDto>> GetAllAsync();
        Task<(IEnumerable<CouponDto> Coupons, int TotalCount)> GetPagedAsync(
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20);
        Task<CouponDto> CreateAsync(CreateCouponDto dto);
        Task<CouponDto> UpdateAsync(Guid id, UpdateCouponDto dto);
        Task<bool> DeleteAsync(Guid id);
    }
}
