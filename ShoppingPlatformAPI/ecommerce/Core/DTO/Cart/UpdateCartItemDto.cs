using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Cart
{
    public class UpdateCartItemDto
    {
        [Required(ErrorMessage = "معرف المنتج مطلوب")]
        public Guid ProductId { get; set; }
        public Guid? VariantId { get; set; }
        [Required(ErrorMessage = "الكمية مطلوبة")]
        [Range(1, 100, ErrorMessage = "الكمية يجب أن تكون بين 1 و 100")]
        public int Quantity { get; set; }
    }
}
