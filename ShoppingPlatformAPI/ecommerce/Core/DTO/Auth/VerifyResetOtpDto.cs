using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class VerifyResetOtpDto
    {
        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        public string Phone { get; set; }

        [Required(ErrorMessage = "رمز التحقق مطلوب")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "رمز التحقق يجب أن يكون 6 أرقام")]
        public string Code { get; set; }
    }
}
