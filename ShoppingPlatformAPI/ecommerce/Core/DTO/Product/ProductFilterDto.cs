using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Product
{
    public class ProductFilterDto
    {
        // ===================================
        // فلاتر الأساسية (موجودة مسبقاً)
        // ===================================
        public Guid? VendorId { get; set; }
        public Guid? CategoryId { get; set; }
        public string? SearchTerm { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public bool? IsAvailable { get; set; }
        public bool? IsActive { get; set; }

        // ===================================
        // ✅ جديد: فلترة بالتقييم
        // ===================================
        public decimal? MinRating { get; set; }  // مثل: 4 = 4⭐ فأعلى

        // ===================================
        // ✅ جديد: فلترة بالعروض
        // ===================================
        public bool? HasDiscount { get; set; }   // true = منتجات عليها خصم فقط

        // ===================================
        // Pagination
        // ===================================
        [Range(1, int.MaxValue, ErrorMessage = "رقم الصفحة يجب أن يكون أكبر من 0")]
        public int PageNumber { get; set; } = 1;

        [Range(1, 100, ErrorMessage = "حجم الصفحة يجب أن يكون بين 1 و 100")]
        public int PageSize { get; set; } = 20;

        // ===================================
        // ✅ محدّث: خيارات الترتيب
        // ===================================
        // created_at | price | name | rating | sales
        public string SortBy { get; set; } = "created_at";
        public string SortOrder { get; set; } = "desc"; // asc | desc
    }
}