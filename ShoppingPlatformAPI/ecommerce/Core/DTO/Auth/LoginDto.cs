using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class LoginDto
    {
        // رقم الهاتف أو الإيميل (Phone للتوافق مع الواجهات القديمة)
        public string? Identifier { get; set; }
        public string? Phone { get; set; }

        [Required(ErrorMessage = "كلمة المرور مطلوبة")]
        public string Password { get; set; }
    }
}
