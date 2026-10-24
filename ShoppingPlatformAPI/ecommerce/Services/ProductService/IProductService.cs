using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Product;

namespace ecommerce.Services.ProductService.ProductService
{
    public interface IProductService
    {
        // ===================================
        // CRUD الأساسي
        // ===================================
        Task<ProductDto> GetByIdAsync(Guid id);
        Task<bool> IsPubliclyVisibleAsync(Guid id);
        Task<IEnumerable<ProductDto>> GetAllAsync();
        Task<IEnumerable<ProductDto>> GetByVendorAsync(Guid vendorId, bool includeInactiveVendor = false, bool includeHidden = false);
        Task<IEnumerable<ProductDto>> GetByCategoryAsync(Guid categoryId);
        Task<ProductDto> CreateAsync(CreateProductDto dto);
        Task<ProductDto> UpdateAsync(Guid id, UpdateProductDto dto);
        Task<ProductDto> DuplicateAsync(Guid id);
        Task<bool> DeleteAsync(Guid id);
        Task<bool> UpdateStockAsync(Guid id, int quantity);

        // ===================================
        // الصور
        // ===================================
        Task<ProductImageDto> AddImageAsync(Guid productId, IFormFile image);
        Task<bool> DeleteImageAsync(Guid imageId);
        Task<bool> SetPrimaryImageAsync(Guid imageId, Guid productId);

        // ===================================
        // البحث والفلترة
        // ===================================
        Task<IEnumerable<ProductDto>> SearchAsync(string searchTerm);
        Task<(IEnumerable<ProductDto> Products, int TotalCount)> GetFilteredAsync(ProductFilterDto filter);
        Task<PagedResponse<ProductDto>> GetProductsPagedAsync(
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
        // ✅ جديد: بحث متقدم + بحث موحد
        // ===================================
        Task<PagedResponse<ProductDto>> GetAdvancedFilteredAsync(ProductFilterDto filter);
        Task<UnifiedSearchResult> UnifiedSearchAsync(string searchTerm, int maxResults = 5, string? scope = null);
        Task<List<SearchSuggestionDto>> SuggestAsync(string term, int limit = 8, string? scope = null);
        Task<List<ProductDto>> GetBuyAgainAsync(Guid userId, string? scope = null, int max = 20);
    }
}