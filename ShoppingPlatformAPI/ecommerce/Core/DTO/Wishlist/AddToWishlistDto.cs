using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Wishlist
{
    public class AddToWishlistDto
    {
        [Required(ErrorMessage = "معرف المنتج مطلوب")]
        public Guid ProductId { get; set; }
    }
}
