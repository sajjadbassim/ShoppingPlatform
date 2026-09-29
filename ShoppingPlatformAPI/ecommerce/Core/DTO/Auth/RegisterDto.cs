using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class RegisterDto
    {
        // Role سيكون CUSTOMER افتراضياً

        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [Phone(ErrorMessage = "رقم الهاتف غير صحيح")]
        [MaxLength(20)]
        public string Phone { get; set; }

        [Required(ErrorMessage = "كلمة المرور مطلوبة")]
        [MinLength(6, ErrorMessage = "كلمة المرور يجب أن تكون 6 أحرف على الأقل")]
        public string Password { get; set; }

        [Required(ErrorMessage = "الاسم الكامل مطلوب")]
        [MaxLength(255)]
        public string FullName { get; set; }

        [EmailAddress(ErrorMessage = "البريد الإلكتروني غير صحيح")]
        [MaxLength(255)]
        public string Email { get; set; }



    }
}
