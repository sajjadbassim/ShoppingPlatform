using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    public class UpdateDriverWorkStatusDto
    {
        [Required(ErrorMessage = "حالة العمل مطلوبة")]
        public string WorkStatus { get; set; } // available | delivering | break | offline
    }

}
