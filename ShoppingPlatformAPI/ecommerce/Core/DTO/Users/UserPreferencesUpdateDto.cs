using System.ComponentModel.DataAnnotations;

namespace ecommerce.Core.DTO.Users
{
    // تحديث جزئي: الحقول غير المُرسلة (null) لا تتغير
    public class UserPreferencesUpdateDto
    {
        [RegularExpression("^(ar|en|ku)$", ErrorMessage = "اللغة يجب أن تكون ar أو en أو ku")]
        public string? Language { get; set; }

        [RegularExpression("^(light|dark)$", ErrorMessage = "المظهر يجب أن يكون light أو dark")]
        public string? Theme { get; set; }

        [RegularExpression("^(IQD|USD)$", ErrorMessage = "العملة يجب أن تكون IQD أو USD")]
        public string? Currency { get; set; }

        public bool? NotifyOrderUpdates { get; set; }
        public bool? NotifyNewOrders { get; set; }
        public bool? NotifyOrderConfirmations { get; set; }
        public bool? NotifyLowStock { get; set; }
        public bool? NotifyReviews { get; set; }
        public bool? NotifyReturns { get; set; }
        public bool? NotifyNewUsers { get; set; }
        public bool? NotifyNewVendors { get; set; }
    }
}
