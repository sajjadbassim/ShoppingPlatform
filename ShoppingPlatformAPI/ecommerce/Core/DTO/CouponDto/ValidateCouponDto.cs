using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.CouponDto
{
    public class ValidateCouponDto
    {
        [Required(ErrorMessage = "كود الكوبون مطلوب")]
        [MaxLength(50)]
        public string Code { get; set; }

        [Required(ErrorMessage = "مبلغ الطلب مطلوب")]
        [Range(0, double.MaxValue)]
        public decimal OrderAmount { get; set; }
    }
}
