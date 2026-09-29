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
            // تحقق من تكرار الاسم
            if (await _categoryRepository.ExistsByNameAsync(dto.Name))
                throw new Exception("اسم التصنيف موجود مسبقاً");

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
                Name = dto.Name,
                NameAr = dto.NameAr,
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
            return categories.Select(MapToDto);
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

            // تحقق من ParentId إن أُرسل
            if (dto.ParentId.HasValue)
            {
                if (dto.ParentId.Value == id)
                    throw new Exception("لا يمكن جعل التصنيف أباً لنفسه");

                var parent = await _categoryRepository.GetByIdAsync(dto.ParentId.Value);
                if (parent == null)
                    throw new Exception("التصنيف الأب غير موجود");

                category.ParentId = dto.ParentId.Value;
            }

            // ✅ رفع أيقونة جديدة إذا وجدت
            if (dto.NewIcon != null)
            {
                try
                {
                    // حذف الأيقونة القديمة
                    if (!string.IsNullOrWhiteSpace(category.IconUrl))
                        await _fileService.DeleteImageAsync(category.IconUrl);

                    // رفع الأيقونة الجديدة
                    category.IconUrl = await _fileService.SaveImageAsync(dto.NewIcon, "categories");
                }
                catch (Exception ex)
                {
                    throw new Exception($"فشل تحديث الأيقونة: {ex.Message}");
                }
            }

            if (!string.IsNullOrWhiteSpace(dto.Name))
                category.Name = dto.Name;

            if (!string.IsNullOrWhiteSpace(dto.NameAr))
                category.NameAr = dto.NameAr;

            if (dto.Description != null)
                category.Description = dto.Description;

            if (dto.DisplayOrder.HasValue)
                category.DisplayOrder = dto.DisplayOrder.Value;

            if (dto.IsActive.HasValue)
                category.IsActive = dto.IsActive.Value;

            var updated = await _categoryRepository.UpdateAsync(category);
            return MapToDto(updated);
        }
        // DeleteAsync المحدث - مع حذف الأيقونة

        public async Task<bool?> DeleteAsync(Guid id)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                return null; // غير موجود

            category.IsActive = !category.IsActive;
            await _categoryRepository.UpdateAsync(category);

            return category.IsActive; // ✅ ترجع الحالة الجديدة
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

            // حذف الأيقونة القديمة
            if (!string.IsNullOrWhiteSpace(category.IconUrl))
                await _fileService.DeleteImageAsync(category.IconUrl);

            // رفع الأيقونة الجديدة
            category.IconUrl = await _fileService.SaveImageAsync(icon, "categories");

            var updated = await _categoryRepository.UpdateAsync(category);
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
