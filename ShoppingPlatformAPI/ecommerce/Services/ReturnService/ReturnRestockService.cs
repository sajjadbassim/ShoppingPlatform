using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Core.DTO.Return;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using ecommerce.Repositories;
using ecommerce.Services.InventoryService;

namespace ecommerce.Services
{
    public class ReturnRestockService : IReturnRestockService
    {
        private static readonly string[] RestockableStatuses = { ReturnStatus.APPROVED, ReturnStatus.COMPLETED };

        private readonly IReturnRepository _returnRepository;
        private readonly IInventoryService _inventoryService;
        private readonly IReturnService _returnService;
        private readonly IUnitOfWork _unitOfWork;

        public ReturnRestockService(
            IReturnRepository returnRepository,
            IInventoryService inventoryService,
            IReturnService returnService,
            IUnitOfWork unitOfWork)
        {
            _returnRepository = returnRepository;
            _inventoryService = inventoryService;
            _returnService = returnService;
            _unitOfWork = unitOfWork;
        }

        public async Task<ReturnResponseDto> RestockAsync(Guid returnId, Guid restockedBy, CancellationToken ct = default)
        {
            var returnRequest = await _returnRepository.GetByIdWithItemsAsync(returnId, ct)
                ?? throw new NotFoundException("طلب الإرجاع غير موجود");

            if (!RestockableStatuses.Contains(returnRequest.Status))
                throw new BusinessRuleException("لا يمكن تحديث المخزون إلا لطلب إرجاع مقبول");

            if (returnRequest.IsRestocked)
                throw new ConflictException("تم تحديث المخزون لهذا الإرجاع مسبقاً");

            var lines = returnRequest.Items
                .GroupBy(i => new { i.ProductId, i.VariantId })
                .Select(g => new StockLineQuantity(g.Key.ProductId, g.Key.VariantId, g.Sum(i => i.Quantity)))
                .ToList();

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                // التعليم الذري أولاً: إذا ضُغط الزر مرتين في نفس اللحظة تنجح مرة واحدة فقط
                if (!await _returnRepository.TryMarkRestockedAsync(returnId, restockedBy, ct))
                    throw new ConflictException("تم تحديث المخزون لهذا الإرجاع مسبقاً");

                await _inventoryService.RestockAsync(lines, ct);
            }, ct);

            return await _returnService.GetByIdAsync(returnId);
        }
    }
}
