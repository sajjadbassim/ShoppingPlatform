using ecommerce.Core.DTO.Category;
using ecommerce.Core.DTO.Common;

namespace ecommerce.Services
{
    public interface ICategoryService
    {
        Task<CategoryResponseDto> CreateAsync(CategoryCreateDto dto);
        Task<CategoryResponseDto> GetByIdAsync(Guid id);
        Task<IEnumerable<CategoryResponseDto>> GetAllAsync(bool onlyActive = true);
        Task<IEnumerable<CategoryResponseDto>> GetByParentIdAsync(Guid? parentId, bool onlyActive = true);
        Task<CategoryResponseDto> GetByNameAsync(string name);
        Task<CategoryResponseDto> GetByArbicNameAsync(string name);
        Task<CategoryResponseDto> UpdateAsync(Guid id, CategoryUpdateDto dto);
        // تعطيل الفئة (حذف ناعم) — false إن لم توجد
        Task<bool> DeleteAsync(Guid id);

        Task<PagedResponse<CategoryResponseDto>> GetPagedAsync(
            PaginationParams pagination,
            Guid? parentId = null,
            bool onlyActive = true);


        // Icon Methods 
        Task<CategoryResponseDto> UpdateIconAsync(Guid id, IFormFile icon);
        Task<bool> DeleteIconAsync(Guid id);
    }
}
