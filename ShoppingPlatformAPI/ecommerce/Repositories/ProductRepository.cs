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
            var query = await ApplyVisibilityAsync(_context.Products, isActive: null);

            return await query
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetByVendorAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetByVendorAsync(Guid vendorId, bool includeInactiveVendor = false, bool includeHidden = false)
        {
            var vendorProducts = _context.Products.Where(p => p.VendorId == vendorId);

            // includeHidden (لوحة البائع): الظاهر والمخفي معاً — دون المحذوف
            var query = includeHidden
                ? vendorProducts.Where(p => !p.IsDeleted)
                : await ApplyVisibilityAsync(vendorProducts, isActive: null, publicOnly: !includeInactiveVendor);

            return await query
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        // ===================================
        // GetByCategoryAsync
        // ===================================
        public async Task<IEnumerable<Product>> GetByCategoryAsync(Guid categoryId)
        {
            var query = await ApplyCategoryFilterAsync(_context.Products, categoryId);
            query = await ApplyVisibilityAsync(query, isActive: null);

            return await query
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
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
            var query = await ApplyVisibilityAsync(_context.Products, isActive: null);

            return await query
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p =>
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

            query = await ApplyCategoryFilterAsync(query, categoryId);

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

            query = ApplyAvailabilityFilter(query, isAvailable);

            query = await ApplyVisibilityAsync(query, isActive);

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
            bool? isActive = null,
            bool publicOnly = true)
        {
            var query = _context.Products.AsQueryable();

            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            query = await ApplyCategoryFilterAsync(query, categoryId);

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

            query = ApplyAvailabilityFilter(query, isAvailable);

            query = await ApplyVisibilityAsync(query, isActive, publicOnly);

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

            query = await ApplyCategoryFilterAsync(query, categoryId);

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

            query = ApplyAvailabilityFilter(query, isAvailable);

            query = await ApplyVisibilityAsync(query, isActive);

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

            var query = await BuildAdvancedQueryAsync(
                vendorId, categoryId, searchTerm, minPrice, maxPrice, isAvailable, isActive,
                minRating, hasDiscount, sortBy, sortOrder);

            return await query
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .ToPagedListAsync(pageNumber, pageSize);
        }

        // كل الفلاتر عدا السعر والخصم، بنفس الترتيب — للتسعير بالعروض في الذاكرة
        public async Task<List<ProductPriceInfo>> GetAdvancedFilterCandidatesAsync(
            Guid? vendorId, Guid? categoryId, string? searchTerm, bool? isAvailable, bool? isActive,
            decimal? minRating, string sortBy, string sortOrder)
        {
            var query = await BuildAdvancedQueryAsync(
                vendorId, categoryId, searchTerm, null, null, isAvailable, isActive,
                minRating, null, sortBy, sortOrder);

            return await query
                .Select(p => new ProductPriceInfo(p.Id, p.Price, p.OriginalPrice, p.CategoryId, p.VendorId))
                .ToListAsync();
        }

        public async Task<List<Product>> GetByIdsWithDetailsAsync(IReadOnlyCollection<Guid> ids)
        {
            var products = await _context.Products
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p => ids.Contains(p.Id))
                .ToListAsync();

            // بنفس ترتيب المعرّفات المطلوبة
            var order = ids.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
            return products.OrderBy(p => order[p.Id]).ToList();
        }

        private async Task<IQueryable<Product>> BuildAdvancedQueryAsync(
            Guid? vendorId, Guid? categoryId, string? searchTerm, decimal? minPrice, decimal? maxPrice,
            bool? isAvailable, bool? isActive, decimal? minRating, bool? hasDiscount, string sortBy, string sortOrder)
        {
            var query = _context.Products.AsQueryable();

            // الفلاتر الأساسية
            if (vendorId.HasValue && vendorId.Value != Guid.Empty)
                query = query.Where(p => p.VendorId == vendorId.Value);

            query = await ApplyCategoryFilterAsync(query, categoryId);

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

            query = ApplyAvailabilityFilter(query, isAvailable);

            query = await ApplyVisibilityAsync(query, isActive);

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

            return query;
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
            var visibleProducts = await ApplyVisibilityAsync(_context.Products, isActive: null);
            var products = await visibleProducts
                .Include(p => p.Vendor)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Where(p =>
                    p.IsAvailable &&
                    ((p.Name != null && p.Name.ToLower().Contains(term)) ||
                     (p.NameAr != null && p.NameAr.Contains(term)) ||
                     (p.Description != null && p.Description.ToLower().Contains(term))))
                .OrderByDescending(p => p.SubOrderItems.Sum(i => (int?)i.Quantity) ?? 0)
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();

            // بحث في المتاجر
            // إسقاط مباشر بدل تحميل كل منتجات المتجر لعدّها
            var vendorResults = await _context.Vendors
                .Where(v =>
                    v.IsActive &&
                    ((v.Name != null && v.Name.ToLower().Contains(term)) ||
                     (v.NameAr != null && v.NameAr.Contains(term))))
                .Take(maxResults)
                .Select(v => new VendorSearchResult
                {
                    Id = v.Id,
                    Name = v.Name,
                    NameAr = v.NameAr,
                    LogoUrl = v.LogoUrl,
                    ProductCount = v.Products.Count(p => p.IsActive)
                })
                .ToListAsync();

            // بحث في التصنيفات
            // الفئات الظاهرة فقط، والعدد يشمل الفئات الفرعية (نفس عدّ صفحة الفئات)
            var hiddenCategoryIds = (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).ToList();
            var categories = await _context.Categories
                .Where(c =>
                    !hiddenCategoryIds.Contains(c.Id) &&
                    ((c.Name != null && c.Name.ToLower().Contains(term)) ||
                     (c.NameAr != null && c.NameAr.Contains(term))))
                .Take(maxResults)
                .AsNoTracking()
                .ToListAsync();
            var categoryCounts = categories.Any()
                ? await new CategoryRepository(_context).GetProductCountsAsync()
                : new Dictionary<Guid, int>();

            // تقييمات المنتجات المعروضة فقط (بدل تحميل كل المراجعات)
            var productIds = products.Select(p => p.Id).ToList();
            var ratings = await _context.Reviews
                .Where(r => productIds.Contains(r.ProductId) && r.IsApproved)
                .GroupBy(r => r.ProductId)
                .Select(g => new { ProductId = g.Key, Average = g.Average(r => (double)r.Rating), Count = g.Count() })
                .ToDictionaryAsync(x => x.ProductId);

            // تجميع النتائج
            var productResults = products.Select(p =>
            {
                ratings.TryGetValue(p.Id, out var rating);
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
                    VendorId = p.VendorId,
                    CategoryId = p.CategoryId,
                    VendorName = p.Vendor?.Name ?? string.Empty,
                    CategoryName = p.Category?.Name ?? string.Empty,
                    AverageRating = rating != null ? Math.Round((decimal)rating.Average, 1) : null,
                    ReviewCount = rating?.Count ?? 0,
                    IsAvailable = p.IsAvailable
                };
            }).ToList();

            var categoryResults = categories.Select(c => new CategorySearchResult
            {
                Id = c.Id,
                Name = c.Name,
                NameAr = c.NameAr,
                IconUrl = c.IconUrl,
                ProductCount = categoryCounts.GetValueOrDefault(c.Id)
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
            if (product == null || product.IsDeleted)
                return false;

            // حذف ناعم: يبقى السجل لأجل الطلبات القديمة، ويُخفى من كل مكان (IsActive = false أيضاً
            // حتى تبقى كل فلاتر الظهور الحالية تستبعده)
            product.IsDeleted = true;
            product.DeletedAt = DateTime.UtcNow;
            product.IsActive = false;
            product.UpdatedAt = DateTime.UtcNow;

            // لا يبقى منتج محذوف معلّقاً في سلال الزبائن أو قوائم أمنياتهم
            _context.CartItems.RemoveRange(await _context.CartItems.Where(c => c.ProductId == id).ToListAsync());
            _context.Wishlists.RemoveRange(await _context.Wishlists.Where(w => w.ProductId == id).ToListAsync());

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
        public async Task<bool> UpdateStockAsync(Guid id, int quantity, bool isAvailable)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
                return false;

            product.StockQuantity = quantity;
            product.IsAvailable = isAvailable;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        // ===================================
        // Private: فلترة الفئة مع كل فئاتها الفرعية (أي عمق)
        // ===================================
        private async Task<IQueryable<Product>> ApplyCategoryFilterAsync(IQueryable<Product> query, Guid? categoryId)
        {
            if (!categoryId.HasValue || categoryId.Value == Guid.Empty)
                return query;

            var categoryIds = await CategoryVisibility.GetWithDescendantsAsync(_context, categoryId.Value);
            return query.Where(p => p.CategoryId != null && categoryIds.Contains(p.CategoryId.Value));
        }

        // ===================================
        // ظهور المنتج للعامة: مفعّل، من متجر مفعّل، وفئته (وأسلافها) غير معطّلة
        // ===================================
        public async Task<bool> IsPubliclyVisibleAsync(Guid productId)
        {
            var product = await _context.Products
                .AsNoTracking()
                .Where(p => p.Id == productId)
                .Select(p => new { p.IsActive, p.IsDeleted, VendorActive = p.Vendor.IsActive, p.CategoryId })
                .FirstOrDefaultAsync();

            if (product == null || product.IsDeleted || !product.IsActive || !product.VendorActive)
                return false;

            return !product.CategoryId.HasValue ||
                   !(await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).Contains(product.CategoryId.Value);
        }

        // "متوفر": بلا متغيرات → متوفر وبمخزون؛ بمتغيرات → يوجد متغير متوفر وبمخزون
        private IQueryable<Product> ApplyAvailabilityFilter(IQueryable<Product> query, bool? isAvailable)
        {
            if (!isAvailable.HasValue)
                return query;

            var variants = _context.ProductVariants;
            return isAvailable.Value
                ? query.Where(p =>
                    (!variants.Any(v => v.ProductId == p.Id) && p.IsAvailable && p.StockQuantity > 0) ||
                    variants.Any(v => v.ProductId == p.Id && v.IsAvailable && v.StockQuantity > 0))
                : query.Where(p => !(
                    (!variants.Any(v => v.ProductId == p.Id) && p.IsAvailable && p.StockQuantity > 0) ||
                    variants.Any(v => v.ProductId == p.Id && v.IsAvailable && v.StockQuantity > 0)));
        }

        // publicOnly = false لصاحب المتجر والإدارة: لا يُشترط تفعيل المتجر أو الفئة
        private async Task<IQueryable<Product>> ApplyVisibilityAsync(IQueryable<Product> query, bool? isActive, bool publicOnly = true)
        {
            // المحذوف لا يظهر لأحد — ولا للإدارة عبر isActive = false
            query = query.Where(p => !p.IsDeleted);

            query = isActive.HasValue
                ? query.Where(p => p.IsActive == isActive.Value)
                : query.Where(p => p.IsActive);

            if (!publicOnly)
                return query;

            query = query.Where(p => p.Vendor.IsActive);

            var hiddenCategoryIds = (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).ToList();
            return hiddenCategoryIds.Count == 0
                ? query
                : query.Where(p => p.CategoryId == null || !hiddenCategoryIds.Contains(p.CategoryId.Value));
        }
    }
}