using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Product
{
    public class CreateProductDto
    {
        [Required(ErrorMessage = "المتجر مطلوب")]
        public Guid VendorId { get; set; }

        public Guid? CategoryId { get; set; }

        [Required(ErrorMessage = "اسم المنتج مطلوب")]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(255)]
        public string NameAr { get; set; }

        public string Description { get; set; }

        //public string? ImageUrl { get; set; }

        [Required(ErrorMessage = "السعر مطلوب")]
        [Range(0, double.MaxValue, ErrorMessage = "السعر يجب أن يكون أكبر من أو يساوي 0")]
        public decimal Price { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "السعر الأصلي يجب أن يكون أكبر من أو يساوي 0")]
        public decimal? OriginalPrice { get; set; }

        [MaxLength(100)]
        public string? Sku { get; set; }

        [Range(0, int.MaxValue, ErrorMessage = "الكمية يجب أن تكون أكبر من أو تساوي 0")]
        public int StockQuantity { get; set; } = 0;

        public bool IsAvailable { get; set; } = true;

        public bool IsActive { get; set; } = true;

        public List<IFormFile> Images { get; set; }


    }
}
