using ecommerce.Core.Constants;
using ecommerce.Core.Interfaces;

namespace ecommerce.Core.Models
{
    // تفضيلات المستخدم (سجل واحد لكل مستخدم، المفتاح هو UserId نفسه)
    // الإعدادات في Data/Configurations/UserPreferencesConfiguration.cs
    public class UserPreferences : IAuditableEntity
    {
        public Guid UserId { get; set; }

        // العرض
        public string Language { get; set; } = "ar";     // ar | en | ku
        public string Theme { get; set; } = "light";     // light | dark
        public string Currency { get; set; } = "IQD";    // IQD | USD

        // الإشعارات — القيم الافتراضية تُطبَّق أيضاً على من لا يملك سجلاً بعد
        public bool NotifyOrderUpdates { get; set; } = true;
        public bool NotifyNewOrders { get; set; } = true;
        public bool NotifyOrderConfirmations { get; set; } = true;
        public bool NotifyLowStock { get; set; } = true;
        public bool NotifyReviews { get; set; } = true;
        public bool NotifyReturns { get; set; } = true;
        public bool NotifyNewUsers { get; set; } = false;
        public bool NotifyNewVendors { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public virtual User User { get; set; } = null!;

        public bool IsEnabled(NotificationCategory category) => category switch
        {
            NotificationCategory.OrderUpdates => NotifyOrderUpdates,
            NotificationCategory.NewOrders => NotifyNewOrders,
            NotificationCategory.OrderConfirmations => NotifyOrderConfirmations,
            NotificationCategory.LowStock => NotifyLowStock,
            NotificationCategory.Reviews => NotifyReviews,
            NotificationCategory.Returns => NotifyReturns,
            NotificationCategory.NewUsers => NotifyNewUsers,
            NotificationCategory.NewVendors => NotifyNewVendors,
            _ => true
        };
    }
}
