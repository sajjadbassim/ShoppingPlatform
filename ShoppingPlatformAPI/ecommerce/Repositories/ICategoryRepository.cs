using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface ICategoryRepository
    {
        Task<Category> GetByIdAsync(Guid id);
        Task<IEnumerable<Category>> GetAllAsync(bool onlyActive = true);

        // عدد المنتجات لكل فئة مع فئاتها الفرعية (بكل المستويات)
        Task<Dictionary<Guid, int>> GetProductCountsAsync();
        Task<IEnumerable<Category>> GetByParentIdAsync(Guid? parentId, bool onlyActive = true);
        Task<Category> GetByNameAsync(string name);
        Task<Category> GetByArbicNameAsync(string name);

        Task<Category> CreateAsync(Category category);
        Task<Category> UpdateAsync(Category category);
        Task<bool> DeleteAsync(Guid id);

        Task<bool> ExistsAsync(Guid id);
        Task<bool> ExistsByNameAsync(string name);


        Task<PagedResult<Category>> GetPagedAsync(
          Guid? parentId,
          bool onlyActive,
          int pageNumber,
          int pageSize);
    }
}
