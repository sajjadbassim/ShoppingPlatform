using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Users
{
    public class RegisterDto
    {
        [Required(ErrorMessage = "رقم الهاتف مطلوب")]
        [Phone(ErrorMessage = "رقم الهاتف غير صحيح")]
        [MaxLength(20)]
        public string Phone { get; set; }

        [Required(ErrorMessage = "الاسم الكامل مطلوب")]
        [MaxLength(255)]
        public string FullName { get; set; }

        [EmailAddress(ErrorMessage = "البريد الإلكتروني غير صحيح")]
        [MaxLength(255)]
        public string Email { get; set; }

        [Required(ErrorMessage = "نوع المستخدم مطلوب")]
        public string Role { get; set; } = "CUSTOMER";
    }
}
