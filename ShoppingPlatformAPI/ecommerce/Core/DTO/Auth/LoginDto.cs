using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class LoginDto
    {
        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [Phone(ErrorMessage = "رقم الهاتف غير صحيح")]
        public string Phone { get; set; }

        [Required(ErrorMessage = "كلمة المرور مطلوبة")]
        public string Password { get; set; }
    }
}
