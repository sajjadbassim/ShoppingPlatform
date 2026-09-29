using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class ResetPasswordDto
    {
        [Required(ErrorMessage = "رمز إعادة التعيين مطلوب")]
        public string ResetToken { get; set; }

        [Required(ErrorMessage = "كلمة المرور الجديدة مطلوبة")]
        [MinLength(6, ErrorMessage = "كلمة المرور يجب أن تكون 6 أحرف على الأقل")]
        public string NewPassword { get; set; }
    }
}
