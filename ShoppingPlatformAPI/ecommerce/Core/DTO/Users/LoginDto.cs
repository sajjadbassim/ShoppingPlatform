using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Users
{
    public class LoginDto
    {
        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [Phone(ErrorMessage = "رقم الهاتف غير صحيح")]
        public string Phone { get; set; }
    }
}
