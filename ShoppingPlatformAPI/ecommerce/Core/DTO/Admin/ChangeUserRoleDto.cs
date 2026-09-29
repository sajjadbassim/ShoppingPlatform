using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Admin
{

        public class ChangeUserRoleDto
        {
            [Required(ErrorMessage = "الدور مطلوب")]
            public string NewRole { get; set; }
        }
   
}
