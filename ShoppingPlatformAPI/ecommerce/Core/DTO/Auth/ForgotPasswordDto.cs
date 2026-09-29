using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class ForgotPasswordDto
    {
        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [Phone(ErrorMessage = "رقم الهاتف غير صحيح")]
        public string Phone { get; set; }
    }
}
