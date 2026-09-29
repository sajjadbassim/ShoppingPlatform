using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Users
{
    public class UpdateUserDto
    {
        [MaxLength(255)]
        public string FullName { get; set; }

        [EmailAddress(ErrorMessage = "البريد الإلكتروني غير صحيح")]
        [MaxLength(255)]
        public string Email { get; set; }
    }
}
