using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    public class AssignDriverDto
    {
        [Required(ErrorMessage = "معرف السائق مطلوب")]
        public Guid DriverId { get; set; }

        [Required(ErrorMessage = "معرف موظف Ops مطلوب")]
        public Guid OpsUserId { get; set; }
    }
}