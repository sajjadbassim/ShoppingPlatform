using ecommerce.Core.DTO.Product;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Extensions;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class ProductRepository : IProductRepository
    {
        private readonly AppDbContext _context;

        public ProductRepository(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // GetByIdAsync
        // ===================================
        public async Task<Product> GetByIdAsync(Guid id)
        {
            return await _context.Products.FindAsync(id);
        }

        // ===================================
        // GetByIdWithDetailsAsync
        // ===================================
        public async Task<Product> GetByIdWithDetailsAsync(Guid id)
        {
            return await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        // ===================================
        // GetAllAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetAllAsync()
        {
            return await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p => p.IsActive)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetByVendorAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetByVendorAsync(Guid vendorId)
        {
            return await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p => p.VendorId == vendorId && p.IsActive)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetByCategoryAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetByCategoryAsync(Guid categoryId)
        {
            return await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p => p.CategoryId == categoryId && p.IsActive)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // SearchAsync
        // ===================================
        public async Task<IEnumerable<Product>> SearchAsync(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return await GetAllAsync();

            searchTerm = searchTerm.Trim().ToLower();

            return await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p => p.IsActive &&
                    ((p.Name != null && p.Name.ToLower().Contains(searchTerm)) ||
                     (p.NameAr != null && p.NameAr.Contains(searchTerm)) ||
                     (p.Description != null && p.Description.ToLower().Contains(searchTerm))))
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetFilteredAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetFilteredAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            int skip = 0,
            int take = 20)
        {
            var query = _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .AsQueryable();

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            if (categoryId.HasValue && categoryId.Value != Guid.Empty)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.Trim().ToLower();
                query = query.Where(p =>
                    (p.Name != null && p.Name.ToLower().Contains(searchTerm)) ||
                    (p.NameAr != null && p.NameAr.Contains(searchTerm)) ||
                    (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                    (p.Sku != null && p.Sku.ToLower().Contains(searchTerm)) ||
                    (p.Vendor != null && p.Vendor.Name != null && p.Vendor.Name.ToLower().Contains(searchTerm)) ||
                    (p.Vendor != null && p.Vendor.NameAr != null && p.Vendor.NameAr.Contains(searchTerm)) ||
                    (p.Category != null && p.Category.Name != null && p.Category.Name.ToLower().Contains(searchTerm)) ||
                    (p.Category != null && p.Category.NameAr != null && p.Category.NameAr.Contains(searchTerm)));
            }

            if (minPrice.HasValue && minPrice.Value > 0)
                query = query.Where(p => p.Price >= minPrice.Value);

            if (maxPrice.HasValue && maxPrice.Value > 0)
                query = query.Where(p => p.Price <= maxPrice.Value);

            if (isAvailable.HasValue)
                query = query.Where(p => p.IsAvailable == isAvailable.Value);

            if (isActive.HasValue)
                query = query.Where(p => p.IsActive == isActive.Value);
            else
                query = query.Where(p => p.IsActive);

            return await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip(skip)
                .Take(take)
                .ToListAsync();
        }

        // ===================================
        // GetCountAsync
        // ===================================
        public async Task<int> GetCountAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null)
        {
            var query = _context.Products.AsQueryable();

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            if (categoryId.HasValue && categoryId.Value != Guid.Empty)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.Trim().ToLower();
                query = query.Where(p =>
                    (p.Name != null && p.Name.ToLower().Contains(searchTerm)) ||
                    (p.NameAr != null && p.NameAr.Contains(searchTerm)) ||
                    (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                    (p.Sku != null && p.Sku.ToLower().Contains(searchTerm)) ||
                    (p.Vendor.Name != null && p.Vendor.Name.ToLower().Contains(searchTerm)) ||
                    (p.Vendor.NameAr != null && p.Vendor.NameAr.Contains(searchTerm)) ||
                    (p.Category.Name != null && p.Category.Name.ToLower().Contains(searchTerm)) ||
                    (p.Category.NameAr != null && p.Category.NameAr.Contains(searchTerm)));
            }

            if (minPrice.HasValue && minPrice.Value > 0)
                query = query.Where(p => p.Price >= minPrice.Value);

            if (maxPrice.HasValue && maxPrice.Value > 0)
                query = query.Where(p => p.Price <= maxPrice.Value);

            if (isAvailable.HasValue)
                query = query.Where(p => p.IsAvailable == isAvailable.Value);

            if (isActive.HasValue)
                query = query.Where(p => p.IsActive == isActive.Value);
            else
                query = query.Where(p => p.IsActive);

            return await query.CountAsync();
        }

        // ===================================
        // GetPagedAsync
        // ===================================
        public async Task<PagedResult<Product>> GetPagedAsync(
            Guid? vendorId = null,
            Guid? categoryId = null,
            string searchTerm = null,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            bool? isAvailable = null,
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var query = _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .AsNoTracking()
                .AsQueryable();

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            if (categoryId.HasValue && categoryId.Value != Guid.Empty)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                searchTerm = searchTerm.Trim().ToLower();
                query = query.Where(p =>
                    (p.Name != null && p.Name.ToLower().Contains(searchTerm)) ||
                    (p.NameAr != null && p.NameAr.Contains(searchTerm)) ||
                    (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                    (p.Sku != null && p.Sku.ToLower().Contains(searchTerm)));
            }

            if (minPrice.HasValue && minPrice.Value > 0)
                query = query.Where(p => p.Price >= minPrice.Value);

            if (maxPrice.HasValue && maxPrice.Value > 0)
                query = query.Where(p => p.Price <= maxPrice.Value);

            if (isAvailable.HasValue)
                query = query.Where(p => p.IsAvailable == isAvailable.Value);

            if (isActive.HasValue)
                query = query.Where(p => p.IsActive == isActive.Value);
            else
                query = query.Where(p => p.IsActive);

            query = query.OrderByDescending(p => p.CreatedAt);

            return await query.ToPagedListAsync(pageNumber, pageSize);
        }

        // ===================================
        // ✅ جديد: GetAdvancedFilteredAsync
        // ===================================
        public async Task<PagedResult<Product>> GetAdvancedFilteredAsync(
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
            int pageSize = 20)
        {
            // ✅ ضمان قيم صحيحة
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            var query = _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Reviews)
                .AsQueryable();

            // الفلاتر الأساسية
            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            if (categoryId.HasValue && categoryId.Value != Guid.Empty)
                query = query.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var term = searchTerm.Trim().ToLower();
                query = query.Where(p =>
                    (p.Name != null && p.Name.ToLower().Contains(term)) ||
                    (p.NameAr != null && p.NameAr.Contains(term)) ||
                    (p.Description != null && p.Description.ToLower().Contains(term)) ||
                    (p.Sku != null && p.Sku.ToLower().Contains(term)) ||
                    (p.Vendor != null && p.Vendor.Name != null && p.Vendor.Name.ToLower().Contains(term)) ||
                    (p.Vendor != null && p.Vendor.NameAr != null && p.Vendor.NameAr.Contains(term)) ||
                    (p.Category != null && p.Category.Name != null && p.Category.Name.ToLower().Contains(term)) ||
                    (p.Category != null && p.Category.NameAr != null && p.Category.NameAr.Contains(term)));
            }

            if (minPrice.HasValue && minPrice.Value > 0)
                query = query.Where(p => p.Price >= minPrice.Value);

            if (maxPrice.HasValue && maxPrice.Value > 0)
                query = query.Where(p => p.Price <= maxPrice.Value);

            if (isAvailable.HasValue)
                query = query.Where(p => p.IsAvailable == isAvailable.Value);

            if (isActive.HasValue)
                query = query.Where(p => p.IsActive == isActive.Value);
            else
                query = query.Where(p => p.IsActive);

            // ✅ فلترة بالتقييم
            if (minRating.HasValue)
                query = query.Where(p =>
                    p.Reviews.Any(r => r.IsApproved) &&
                    p.Reviews.Where(r => r.IsApproved).Average(r => (double)r.Rating) >= (double)minRating.Value);

            // ✅ فلترة بالعروض
            if (hasDiscount == true)
                query = query.Where(p => p.OriginalPrice != null && p.OriginalPrice > p.Price);

            // ✅ الترتيب المتقدم — مع ThenBy ثابت لضمان استقرار الترتيب مع Skip/Take
            query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
            {
                ("price", "asc") => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
                ("price", "desc") => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
                ("name", "asc") => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
                ("name", "desc") => query.OrderByDescending(p => p.Name).ThenBy(p => p.Id),
                ("rating", _) => query.OrderByDescending(p =>
                                              p.Reviews.Where(r => r.IsApproved).Average(r => (double?)r.Rating) ?? 0)
                                              .ThenBy(p => p.Id),
                ("sales", _) => query.OrderByDescending(p =>
                                              p.SubOrderItems.Sum(i => (int?)i.Quantity) ?? 0)
                                              .ThenBy(p => p.Id),
                ("created_at", "asc") => query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id),
                _ => query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
            };

            return await query.ToPagedListAsync(pageNumber, pageSize);
        }

        // ===================================
        // ✅ جديد: UnifiedSearchAsync
        // ===================================
        public async Task<UnifiedSearchResult> UnifiedSearchAsync(string searchTerm, int maxResults = 5)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return new UnifiedSearchResult { SearchTerm = searchTerm };

            var term = searchTerm.Trim().ToLower();

            // بحث في المنتجات
            var products = await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.Reviews)
                .Where(p =>
                    p.IsActive && p.IsAvailable &&
                    ((p.Name != null && p.Name.ToLower().Contains(term)) ||
                     (p.NameAr != null && p.NameAr.Contains(term)) ||
                     (p.Description != null && p.Description.ToLower().Contains(term))))
                .OrderByDescending(p => p.SubOrderItems.Sum(i => (int?)i.Quantity) ?? 0)
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();

            // بحث في المتاجر
            var vendors = await _context.Vendors
                .Include(v => v.Products)
                .Where(v =>
                    v.IsActive &&
                    ((v.Name != null && v.Name.ToLower().Contains(term)) ||
                     (v.NameAr != null && v.NameAr.Contains(term))))
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();

            // بحث في التصنيفات
            var categories = await _context.Categories
                .Include(c => c.Products)
                .Where(c =>
                    c.IsActive &&
                    ((c.Name != null && c.Name.ToLower().Contains(term)) ||
                     (c.NameAr != null && c.NameAr.Contains(term))))
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();

            // تجميع النتائج
            var productResults = products.Select(p =>
            {
                var approvedReviews = p.Reviews?.Where(r => r.IsApproved).ToList() ?? new();
                var primaryImage = p.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl;
                var basePrice = p.OriginalPrice ?? p.Price;
                var hasDiscount = p.OriginalPrice.HasValue && p.OriginalPrice > p.Price;
                decimal? discPct = hasDiscount
                    ? Math.Round((basePrice - p.Price) / basePrice * 100, 1)
                    : null;

                return new ProductSearchResult
                {
                    Id = p.Id,
                    Name = p.Name,
                    NameAr = p.NameAr,
                    Price = p.Price,
                    OriginalPrice = p.OriginalPrice,
                    HasDiscount = hasDiscount,
                    DiscountPercentage = discPct,
                    PrimaryImageUrl = primaryImage,
                    VendorName = p.Vendor?.Name ?? string.Empty,
                    CategoryName = p.Category?.Name ?? string.Empty,
                    AverageRating = approvedReviews.Any()
                        ? Math.Round((decimal)approvedReviews.Average(r => r.Rating), 1)
                        : null,
                    ReviewCount = approvedReviews.Count,
                    IsAvailable = p.IsAvailable
                };
            }).ToList();

            var vendorResults = vendors.Select(v => new VendorSearchResult
            {
                Id = v.Id,
                Name = v.Name,
                NameAr = v.NameAr,
                LogoUrl = v.LogoUrl,
                ProductCount = v.Products?.Count(p => p.IsActive) ?? 0
            }).ToList();

            var categoryResults = categories.Select(c => new CategorySearchResult
            {
                Id = c.Id,
                Name = c.Name,
                NameAr = c.NameAr,
                IconUrl = c.IconUrl,
                ProductCount = c.Products?.Count(p => p.IsActive) ?? 0
            }).ToList();

            return new UnifiedSearchResult
            {
                SearchTerm = searchTerm,
                TotalResults = productResults.Count + vendorResults.Count + categoryResults.Count,
                Products = productResults,
                Vendors = vendorResults,
                Categories = categoryResults
            };
        }

        // ===================================
        // CreateAsync
        // ===================================
        public async Task<Product> CreateAsync(Product product)
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.Products.AddAsync(product);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(product.Id);
        }

        // ===================================
        // UpdateAsync
        // ===================================
        public async Task<Product> UpdateAsync(Product product)
        {
            product.UpdatedAt = DateTime.UtcNow;

            _context.Products.Update(product);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(product.Id);
        }

        // ===================================
        // DeleteAsync
        // ===================================
        public async Task<bool> DeleteAsync(Guid id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
                return false;

            product.IsActive = false;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // ExistsAsync
        // ===================================
        public async Task<bool> ExistsAsync(Guid id)
        {
            return await _context.Products.AnyAsync(p => p.Id == id);
        }

        // ===================================
        // UpdateStockAsync
        // ===================================
        public async Task<bool> UpdateStockAsync(Guid id, int quantity)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
                return false;

            product.StockQuantity = quantity;
            product.IsAvailable = quantity > 0;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }
    }
}