using ecommerce.Core.DTO.Category;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.FileService;

namespace ecommerce.Services
{
    public class CategoryService : ICategoryService
    {
        private readonly ICategoryRepository _categoryRepository;
        private readonly IFileService _fileService;
        public CategoryService(ICategoryRepository categoryRepository, IFileService fileService)
        {
            _categoryRepository = categoryRepository;
            _fileService = fileService;

        }

        //  CreateAsync المحدث - مع رفع الأيقونة
        public async Task<CategoryResponseDto> CreateAsync(CategoryCreateDto dto)
        {
            // تحقق من تكرار الاسم (الإنجليزي والعربي)
            await EnsureNamesUniqueAsync(dto.Name, dto.NameAr, excludeId: null);

            // تحقق من ParentId إذا كان موجود
            if (dto.ParentId.HasValue)
            {
                var parent = await _categoryRepository.GetByIdAsync(dto.ParentId.Value);
                if (parent == null)
                    throw new Exception("التصنيف الأب غير موجود");
            }

            string iconUrl = "";

            //  رفع الأيقونة إذا وجدت
            if (dto.Icon != null)
            {
                try
                {
                    iconUrl = await _fileService.SaveImageAsync(dto.Icon, "categories");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل رفع الأيقونة: {ex.Message}");
                }
            }

            var category = new Category
            {
                Name = dto.Name.Trim(),
                NameAr = dto.NameAr?.Trim(),
                Description = dto.Description,
                IconUrl = iconUrl, // ✅ حفظ مسار الأيقونة
                ParentId = dto.ParentId,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive
            };

            var created = await _categoryRepository.CreateAsync(category);
            return MapToDto(created);
        }
        public async Task<CategoryResponseDto> GetByIdAsync(Guid id)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                throw new Exception("التصنيف غير موجود");

            return MapToDto(category);
        }

        public async Task<IEnumerable<CategoryResponseDto>> GetAllAsync(bool onlyActive = true)
        {
            var categories = await _categoryRepository.GetAllAsync(onlyActive);
            var counts = await _categoryRepository.GetProductCountsAsync();
            return categories.Select(c =>
            {
                var dto = MapToDto(c);
                dto.ProductsCount = counts.GetValueOrDefault(c.Id);
                return dto;
            });
        }

        public async Task<IEnumerable<CategoryResponseDto>> GetByParentIdAsync(Guid? parentId, bool onlyActive = true)
        {
            if (parentId.HasValue)
            {
                var parent = await _categoryRepository.GetByIdAsync(parentId.Value);
                if (parent == null)
                    throw new Exception("التصنيف الأب غير موجود");
            }

            var categories = await _categoryRepository.GetByParentIdAsync(parentId, onlyActive);
            return categories.Select(MapToDto);
        }
        public async Task<CategoryResponseDto> GetByNameAsync(string name)
        {
            var category = await _categoryRepository.GetByNameAsync(name);
            if (category == null)
                throw new Exception("التصنيف غير موجود");

            return MapToDto(category);
        }
        public async Task<CategoryResponseDto> GetByArbicNameAsync(string name)
        {
            var category = await _categoryRepository.GetByArbicNameAsync(name);
            if (category == null)
                throw new Exception("التصنيف غير موجود");

            return MapToDto(category);
        }

        // ✅ UpdateAsync المحدث - مع رفع أيقونة جديدة
        public async Task<CategoryResponseDto> UpdateAsync(Guid id, CategoryUpdateDto dto)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                throw new Exception("التصنيف غير موجود");

            string? oldIconToDelete = null;

            // نقل الفئة: لتصبح رئيسية، أو تحت أب جديد (مع منع الحلقات)
            if (dto.MakeRoot)
            {
                category.ParentId = null;
            }
            else if (dto.ParentId.HasValue && dto.ParentId.Value != category.ParentId)
            {
                if (dto.ParentId.Value == id)
                    throw new Exception("لا يمكن جعل التصنيف أباً لنفسه");

                var parent = await _categoryRepository.GetByIdAsync(dto.ParentId.Value);
                if (parent == null)
                    throw new Exception("التصنيف الأب غير موجود");

                if (await IsDescendantAsync(parent, id))
                    throw new Exception("لا يمكن نقل التصنيف تحت أحد تصنيفاته الفرعية");

                category.ParentId = dto.ParentId.Value;
            }

            // الاسم الجديد يجب ألا يتكرر مع فئة أخرى
            await EnsureNamesUniqueAsync(
                string.IsNullOrWhiteSpace(dto.Name) || dto.Name.Trim() == category.Name ? null : dto.Name,
                string.IsNullOrWhiteSpace(dto.NameAr) || dto.NameAr.Trim() == category.NameAr ? null : dto.NameAr,
                excludeId: id);

            // ✅ رفع أيقونة جديدة إذا وجدت
            if (dto.NewIcon != null)
            {
                try
                {
                    // رفع الجديدة أولاً — القديمة تُحذف بعد نجاح الحفظ (انظر أسفل)
                    oldIconToDelete = category.IconUrl;
                    category.IconUrl = await _fileService.SaveImageAsync(dto.NewIcon, "categories");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل تحديث الأيقونة: {ex.Message}");
                }
            }

            if (!string.IsNullOrWhiteSpace(dto.Name))
                category.Name = dto.Name.Trim();

            if (!string.IsNullOrWhiteSpace(dto.NameAr))
                category.NameAr = dto.NameAr.Trim();

            if (dto.Description != null)
                category.Description = dto.Description;

            if (dto.DisplayOrder.HasValue)
                category.DisplayOrder = dto.DisplayOrder.Value;

            if (dto.IsActive.HasValue)
                category.IsActive = dto.IsActive.Value;

            var updated = await _categoryRepository.UpdateAsync(category);

            if (!string.IsNullOrWhiteSpace(oldIconToDelete))
                await _fileService.DeleteImageAsync(oldIconToDelete);

            return MapToDto(updated);
        }
        // DeleteAsync المحدث - مع حذف الأيقونة

        // DELETE = تعطيل فقط (عملية ثابتة النتيجة) — التفعيل يتم عبر التعديل IsActive = true
        public async Task<bool> DeleteAsync(Guid id)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                return false;

            if (category.IsActive)
            {
                category.IsActive = false;
                await _categoryRepository.UpdateAsync(category);
            }

            return true;
        }

        private async Task EnsureNamesUniqueAsync(string? name, string? nameAr, Guid? excludeId)
        {
            if (!string.IsNullOrWhiteSpace(name) && await _categoryRepository.ExistsByNameAsync(name, excludeId))
                throw new Exception("اسم التصنيف موجود مسبقاً");

            if (!string.IsNullOrWhiteSpace(nameAr) && await _categoryRepository.ExistsByArabicNameAsync(nameAr, excludeId))
                throw new Exception("الاسم العربي للتصنيف موجود مسبقاً");
        }

        // هل الفئة المرشّحة أباً هي categoryId نفسها أو إحدى فئاته الفرعية؟ (الصعود من الأب الجديد للأعلى)
        private async Task<bool> IsDescendantAsync(Category candidateParent, Guid categoryId)
        {
            var current = candidateParent;
            var guard = 0;
            while (current != null && guard++ < 50)
            {
                if (current.Id == categoryId)
                    return true;

                current = current.ParentId.HasValue
                    ? await _categoryRepository.GetByIdAsync(current.ParentId.Value)
                    : null;
            }
            return false;
        }
        // Helper method للتحويل من Model إلى DTO
        private CategoryResponseDto MapToDto(Category category)
        {
            return new CategoryResponseDto
            {
                Id = category.Id,
                Name = category.Name,
                NameAr = category.NameAr,
                Description = category.Description,
                IconUrl = category.IconUrl,
                ParentId = category.ParentId,
                DisplayOrder = category.DisplayOrder,
                IsActive = category.IsActive,
                CreatedAt = category.CreatedAt
            };
        }


        public async Task<PagedResponse<CategoryResponseDto>> GetPagedAsync(
            PaginationParams pagination,
            Guid? parentId = null,
            bool onlyActive = true)
        {
            var pagedCategories = await _categoryRepository.GetPagedAsync(
                parentId,
                onlyActive,
                pagination.PageNumber,
                pagination.PageSize
            );

            var dtoList = pagedCategories.Items.Select(MapToDto).ToList();

            return new PagedResponse<CategoryResponseDto>(
                dtoList,
                pagedCategories.TotalCount,
                pagedCategories.PageNumber,
                pagedCategories.PageSize
            );
        }

        // ✅ تحديث الأيقونة فقط
        public async Task<CategoryResponseDto> UpdateIconAsync(Guid id, IFormFile icon)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                throw new Exception("التصنيف غير موجود");

            if (icon == null)
                throw new Exception("الأيقونة مطلوبة");

            // رفع الجديدة وحفظها أولاً، ثم حذف القديمة — فشل الرفع لا يترك رابطاً لملف محذوف
            var oldIcon = category.IconUrl;
            category.IconUrl = await _fileService.SaveImageAsync(icon, "categories");

            var updated = await _categoryRepository.UpdateAsync(category);

            if (!string.IsNullOrWhiteSpace(oldIcon))
                await _fileService.DeleteImageAsync(oldIcon);

            return MapToDto(updated);
        }
        // ✅ حذف الأيقونة
        public async Task<bool> DeleteIconAsync(Guid id)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                return false;

            if (string.IsNullOrWhiteSpace(category.IconUrl))
                return false;

            // حذف الأيقونة من السيرفر
            await _fileService.DeleteImageAsync(category.IconUrl);

            // إزالة المسار من قاعدة البيانات
            category.IconUrl = null;
            await _categoryRepository.UpdateAsync(category);

            return true;
        }

 
    }
}
