using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    public class ConfirmSubOrderDto
    {
        [Required(ErrorMessage = "معرف موظف Ops مطلوب")]
        public Guid OpsUserId { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }
    }
}
