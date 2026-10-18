using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Order
{
    public class CreateOrderDto
    {
        [Required(ErrorMessage = "عنوان التوصيل مطلوب")]
        public Guid AddressId { get; set; }

        [MaxLength(500)]
        public string? CustomerNotes { get; set; }

        // ✅ جديد: كوبون الخصم (اختياري)
        [MaxLength(50)]
        public string? CouponCode { get; set; }

        // لطلب فيه منتجات سوبرماركت: بداية الفترة المختارة من /api/orders/delivery-slots (UTC)
        public DateTime? DeliverySlotStart { get; set; }

        // REMOVE | SIMILAR — ماذا يفعل المتجر إن نفد منتج سوبرماركت
        [MaxLength(20)]
        public string? SubstitutionPreference { get; set; }
    }

}
