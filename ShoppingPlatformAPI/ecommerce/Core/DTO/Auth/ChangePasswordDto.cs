using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Auth
{
    public class ChangePasswordDto
    {
        [Required(ErrorMessage = "كلمة المرور الحالية مطلوبة")]
        public string CurrentPassword { get; set; }

        [Required(ErrorMessage = "كلمة المرور الجديدة مطلوبة")]
        [MinLength(6, ErrorMessage = "كلمة المرور يجب أن تكون 6 أحرف على الأقل")]
        public string NewPassword { get; set; }
    }
}
