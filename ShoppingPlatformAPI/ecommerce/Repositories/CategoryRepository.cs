using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Extensions;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    public class CategoryRepository : ICategoryRepository
    {
        private readonly AppDbContext _context;

        public CategoryRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Category> GetByIdAsync(Guid id)
        {
            return await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<Category> GetByNameAsync(string name)
        {
            return await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == name);
        }
        public async Task<Category> GetByArbicNameAsync(string name)
        {
            return await _context.Categories
                .FirstOrDefaultAsync(c => c.NameAr == name);
        }
        public async Task<Dictionary<Guid, int>> GetProductCountsAsync()
        {
            // المنتجات الظاهرة فقط (لا المحذوفة/المعطّلة ولا منتجات المتاجر المعطّلة)
            var direct = await _context.Products
                .Where(p => p.CategoryId != null && p.IsActive && p.Vendor.IsActive)
                .GroupBy(p => p.CategoryId!.Value)
                .Select(g => new { CategoryId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CategoryId, x => x.Count);

            var parentOf = await _context.Categories
                .Select(c => new { c.Id, c.ParentId })
                .ToDictionaryAsync(x => x.Id, x => x.ParentId);

            // كل منتج يُحسب لفئته ولكل أسلافها
            var totals = parentOf.Keys.ToDictionary(id => id, _ => 0);
            foreach (var (categoryId, count) in direct)
            {
                var current = (Guid?)categoryId;
                var guard = 0;
                while (current.HasValue && totals.ContainsKey(current.Value) && guard++ < 20)
                {
                    totals[current.Value] += count;
                    current = parentOf[current.Value];
                }
            }
            return totals;
        }

        public async Task<IEnumerable<Category>> GetAllAsync(bool onlyActive = true)
        {
            var query = _context.Categories.AsQueryable();

            if (onlyActive)
                query = query.Where(c => c.IsActive);

            var categories = await query
                .OrderBy(c => c.DisplayOrder)
                .ThenByDescending(c => c.CreatedAt)
                .ToListAsync();

            if (!onlyActive)
                return categories;

            // فئة مفعّلة لكن أحد أسلافها معطّل → مخفية أيضاً
            var hidden = await CategoryVisibility.GetHiddenCategoryIdsAsync(_context);
            return categories.Where(c => !hidden.Contains(c.Id)).ToList();
        }

        public async Task<IEnumerable<Category>> GetByParentIdAsync(Guid? parentId, bool onlyActive = true)
        {
            var query = _context.Categories.AsQueryable();

            query = parentId == null
                ? query.Where(c => c.ParentId == null)
                : query.Where(c => c.ParentId == parentId);

            if (onlyActive)
            {
                query = query.Where(c => c.IsActive);

                // أبناء فئة مخفية مخفيون كذلك
                if (parentId.HasValue &&
                    (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).Contains(parentId.Value))
                    return new List<Category>();
            }

            return await query
                .OrderBy(c => c.DisplayOrder)
                .ThenByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<Category> CreateAsync(Category category)
        {
            category.CreatedAt = DateTime.UtcNow;
            category.UpdatedAt = DateTime.UtcNow;

            await _context.Categories.AddAsync(category);
            await _context.SaveChangesAsync();

            return category;
        }

        public async Task<Category> UpdateAsync(Category category)
        {
            category.UpdatedAt = DateTime.UtcNow;

            _context.Categories.Update(category);
            await _context.SaveChangesAsync();

            return category;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var category = await GetByIdAsync(id);
            if (category == null)
                return false;

            // Soft delete
            category.IsActive = !category.IsActive;
            category.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ExistsAsync(Guid id)
        {
            return await _context.Categories
                .AnyAsync(c => c.Id == id);
        }

        public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId = null)
        {
            var trimmed = name.Trim();
            return await _context.Categories
                .AnyAsync(c => c.Name == trimmed && c.Id != excludeId);
        }

        public async Task<bool> ExistsByArabicNameAsync(string nameAr, Guid? excludeId = null)
        {
            var trimmed = nameAr.Trim();
            return await _context.Categories
                .AnyAsync(c => c.NameAr == trimmed && c.Id != excludeId);
        }

        public async Task<PagedResult<Category>> GetPagedAsync(
         Guid? parentId,
         bool onlyActive,
         int pageNumber,
         int pageSize)
        {
            var query = _context.Categories
                .AsNoTracking()
                .AsQueryable();

            // فلتر حسب Parent
            if (parentId.HasValue)
                query = query.Where(c => c.ParentId == parentId);
            else
                query = query.Where(c => c.ParentId == null);

            // فلتر النشاط (أبناء فئة مخفية مخفيون كذلك)
            if (onlyActive)
            {
                query = query.Where(c => c.IsActive);

                if (parentId.HasValue &&
                    (await CategoryVisibility.GetHiddenCategoryIdsAsync(_context)).Contains(parentId.Value))
                    query = query.Where(c => false);
            }

            query = query.OrderByDescending(c => c.CreatedAt);

            return await query.ToPagedListAsync(pageNumber, pageSize);
        }
    }


}

