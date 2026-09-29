namespace ecommerce.Core.Constants
{
    // فئة الإشعار — كل فئة يقابلها مفتاح تشغيل/إيقاف في تفضيلات المستخدم (UserPreferences)
    public enum NotificationCategory
    {
        OrderUpdates,       // الزبون: تحديثات طلباته
        NewOrders,          // البائع + الأدمن: طلب جديد
        OrderConfirmations, // البائع: تأكيد أو إلغاء طلبه الفرعي
        LowStock,           // البائع + الأدمن: نقص المخزون
        Reviews,            // البائع: تقييم جديد على منتجاته
        Returns,            // الأدمن: طلب إرجاع جديد
        NewUsers,           // الأدمن: تسجيل مستخدم جديد
        NewVendors          // الأدمن: متجر جديد يحتاج تفعيل
    }
}
