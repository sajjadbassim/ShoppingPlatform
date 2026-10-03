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
        // includeInactiveVendor: لصاحب المتجر والإدارة — يرون منتجات متجرهم حتى قبل تفعيله
        // includeHidden: لوحة البائع — تشمل المنتجات المخفية (لا المحذوفة)
        Task<IEnumerable<Product>> GetByVendorAsync(Guid vendorId, bool includeInactiveVendor = false, bool includeHidden = false);
        Task<IEnumerable<Product>> GetByCategoryAsync(Guid categoryId);
        Task<Product> CreateAsync(Product product);
        Task<Product> UpdateAsync(Product product);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> ExistsAsync(Guid id);
        Task<bool> UpdateStockAsync(Guid id, int quantity, bool isAvailable);
        Task<bool> IsPubliclyVisibleAsync(Guid productId);

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
            bool? isActive = null,
            bool publicOnly = true);

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

        // للفلترة/الترتيب بالسعر بعد العروض (يُحسب في الذاكرة)
        Task<List<ProductPriceInfo>> GetAdvancedFilterCandidatesAsync(
            Guid? vendorId, Guid? categoryId, string? searchTerm, bool? isAvailable, bool? isActive,
            decimal? minRating, string sortBy, string sortOrder);
        Task<List<Product>> GetByIdsWithDetailsAsync(IReadOnlyCollection<Guid> ids);
    }
}