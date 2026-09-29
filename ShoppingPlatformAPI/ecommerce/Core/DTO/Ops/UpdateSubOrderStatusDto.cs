// Core/DTO/Ops/UpdateSubOrderStatusDto.cs
using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    public class UpdateSubOrderStatusDto
    {
        [Required(ErrorMessage = "معرف موظف Ops مطلوب")]
        public Guid OpsUserId { get; set; }

        [Required(ErrorMessage = "الحالة الجديدة مطلوبة")]
        public string NewStatus { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }
    }
}