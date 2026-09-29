using ecommerce.Core.DTO.Return;

namespace ecommerce.Services
{
    public interface IReturnRestockService
    {
        // إعادة البضاعة المرتجعة للمخزون — يدوياً بعد استلامها وفحصها، ومرة واحدة فقط
        Task<ReturnResponseDto> RestockAsync(Guid returnId, Guid restockedBy, CancellationToken ct = default);
    }
}
