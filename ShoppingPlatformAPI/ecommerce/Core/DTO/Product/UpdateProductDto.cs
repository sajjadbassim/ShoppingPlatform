using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Product
{
    // تحديث جزئي: الحقول غير المُرسلة تبقى كما هي
    public class UpdateProductDto
    {
        public Guid? CategoryId { get; set; }

        [MaxLength(255)]
        public string? Name { get; set; }

        [MaxLength(255)]
        public string? NameAr { get; set; }

        public string? Description { get; set; }

        //public string? ImageUrl { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "السعر يجب أن يكون أكبر من أو يساوي 0")]
        public decimal? Price { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "السعر الأصلي يجب أن يكون أكبر من أو يساوي 0")]
        public decimal? OriginalPrice { get; set; }

        [MaxLength(100)]
        public string? Sku { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "الكمية يجب أن تكون أكبر من أو تساوي 0")]
        public int? StockQuantity { get; set; }

        public bool? IsAvailable { get; set; }

        public bool? IsActive { get; set; }

        public List<IFormFile>? NewImages { get; set; }

        // الحقول الفارغة لا تُرسل في النموذج، لذا الإزالة تحتاج علماً صريحاً
        public bool ClearOriginalPrice { get; set; }

        public bool ClearCategory { get; set; }


    }
}
