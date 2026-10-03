using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Repositories
{
    // ظهور الفئات للعامة: تعطيل فئة يُخفيها مع كل فئاتها الفرعية ومنتجاتها
    public static class CategoryVisibility
    {
        public record CategoryNode(Guid Id, Guid? ParentId, bool IsActive);

        // شجرة الفئات كاملة (خفيفة) — تُحمَّل مرة وتُستخدم لكل الحسابات التالية
        public static Task<List<CategoryNode>> LoadTreeAsync(AppDbContext context) =>
            context.Categories
                .AsNoTracking()
                .Select(c => new CategoryNode(c.Id, c.ParentId, c.IsActive))
                .ToListAsync();

        // الفئات المخفية: المعطّلة نفسها أو التي أحد أسلافها معطّل
        public static async Task<HashSet<Guid>> GetHiddenCategoryIdsAsync(AppDbContext context) =>
            ComputeHidden(await LoadTreeAsync(context));

        // الفئة مع كل فئاتها الفرعية بأي عمق — لفلترة المنتجات بفئة رئيسية
        public static async Task<List<Guid>> GetWithDescendantsAsync(AppDbContext context, Guid categoryId) =>
            Descendants(await LoadTreeAsync(context), categoryId);

        public static HashSet<Guid> ComputeHidden(IReadOnlyCollection<CategoryNode> all)
        {
            var byId = all.ToDictionary(c => c.Id);
            var hidden = new HashSet<Guid>();

            foreach (var category in all)
            {
                var current = category;
                var guard = 0; // حماية من حلقة قديمة في البيانات
                while (current != null && guard++ < 50)
                {
                    if (!current.IsActive)
                    {
                        hidden.Add(category.Id);
                        break;
                    }

                    current = current.ParentId.HasValue && byId.TryGetValue(current.ParentId.Value, out var parent)
                        ? parent
                        : null;
                }
            }

            return hidden;
        }

        public static List<Guid> Descendants(IReadOnlyCollection<CategoryNode> all, Guid categoryId)
        {
            var childrenOf = all.Where(c => c.ParentId.HasValue).ToLookup(c => c.ParentId!.Value, c => c.Id);

            // HashSet يمنع الدوران اللانهائي لو وُجدت حلقة في شجرة الفئات
            var result = new HashSet<Guid> { categoryId };
            var queue = new Queue<Guid>();
            queue.Enqueue(categoryId);

            while (queue.Count > 0)
                foreach (var childId in childrenOf[queue.Dequeue()])
                    if (result.Add(childId))
                        queue.Enqueue(childId);

            return result.ToList();
        }
    }
}
