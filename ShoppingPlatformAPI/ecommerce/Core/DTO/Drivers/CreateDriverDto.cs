using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Drivers
{
    public class CreateDriverDto
    {
        [Required(ErrorMessage = "الاسم مطلوب")]
        [MaxLength(100)]
        public string FullName { get; set; }

        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [MaxLength(20)]
        public string Phone { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }

        [Required(ErrorMessage = "نوع المركبة مطلوب")]
        public string VehicleType { get; set; }

        public string? WorkArea { get; set; }

        // اختياري: إنشاء حساب دخول للوحة السائق برقم هاتفه
        [MinLength(6, ErrorMessage = "كلمة المرور 6 أحرف على الأقل")]
        public string? Password { get; set; }
    }
}
