using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface IProductRepository
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<Product> GetByIdAsync(Guid id);
        Task<Product> GetByIdWithDetailsAsync(Guid id);
        Task<IEnumerable<Product>> GetAllAsync();
        Task<IEnumerable<Product>> GetByVendorAsync(Guid vendorId);
        Task<IEnumerable<Product>> GetByCategoryAsync(Guid categoryId);
        Task<Product> CreateAsync(Product product);
        Task<Product> UpdateAsync(Product product);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> ExistsAsync(Guid id);
        Task<bool> UpdateStockAsync(Guid id, int quantity);

        // ===================================
        // البحث والفلترة
        // ===================================
        Task<IEnumerable<Product>> SearchAsync(string searchTerm);

        Task<IEnumerable<Product>> GetFilteredAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            int skip = 0,
            int take = 20);

        Task<int> GetCountAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null);

        Task<PagedResult<Product>> GetPagedAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20);

        // ===================================
        // ✅ جديد: بحث متقدم مع كل الفلاتر
        // ===================================
        Task<PagedResult<Product>> GetAdvancedFilteredAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string? searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            decimal? minRating = null,
            bool? hasDiscount = null,
            string sortBy = "created_at",
            string sortOrder = "desc",
            int pageNumber = 1,
            int pageSize = 20);

        // ===================================
        // ✅ جديد: بحث موحد
        // ===================================
        Task<UnifiedSearchResult> UnifiedSearchAsync(string searchTerm, int maxResults = 5);
    }
}