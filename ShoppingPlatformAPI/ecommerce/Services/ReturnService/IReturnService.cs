using ecommerce.Core.DTO.Return;

namespace ecommerce.Services
{
    public interface IReturnService
    {
        // ===================================
        // العميل
        // ===================================
        Task<ReturnResponseDto> GetByIdAsync(Guid id);
        // للعرض عبر الـ API: الزبون يرى طلباته فقط، والعمليات/الإدارة ترى الكل
        Task<ReturnResponseDto> GetForViewerAsync(Guid id, Guid viewerId, bool isStaff);
        Task<IEnumerable<ReturnResponseDto>> GetMyReturnsAsync(Guid customerId);
        Task<ReturnResponseDto> CreateAsync(Guid customerId, CreateReturnDto dto);

        // ===================================
        // Admin / Ops
        // ===================================
        Task<(IEnumerable<ReturnResponseDto> Returns, int TotalCount)> GetPagedAsync(
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20);

        Task<ReturnResponseDto> ReviewAsync(Guid returnId, Guid reviewedBy, ReviewReturnDto dto);
        Task<ReturnResponseDto> MarkRefundedAsync(Guid returnId, Guid refundedBy);
        Task<ReturnResponseDto> SetPickupFeePayerAsync(Guid returnId, string payer, string? reason, Guid userId);
    }
}