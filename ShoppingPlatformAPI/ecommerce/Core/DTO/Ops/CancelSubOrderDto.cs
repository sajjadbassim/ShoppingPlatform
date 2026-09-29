using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Ops
{
    public class CancelSubOrderDto
    {
        [Required(ErrorMessage = "معرف موظف Ops مطلوب")]
        public Guid OpsUserId { get; set; }

        [Required(ErrorMessage = "سبب الإلغاء مطلوب")]
        [MaxLength(500)]
        public string CancellationReason { get; set; }
    }
}
