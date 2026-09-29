using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Order
{
    public class CreateOrderDto
    {
        [Required(ErrorMessage = "عنوان التوصيل مطلوب")]
        public Guid AddressId { get; set; }

        [MaxLength(500)]
        public string CustomerNotes { get; set; }

        // ✅ جديد: كوبون الخصم (اختياري)
        [MaxLength(50)]
        public string? CouponCode { get; set; }
    }

}
