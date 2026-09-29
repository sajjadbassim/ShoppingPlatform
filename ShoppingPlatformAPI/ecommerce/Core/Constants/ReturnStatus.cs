namespace ecommerce.Core.Constants
{
    public static class ReturnStatus
    {
        public const string PENDING = "PENDING";    // بانتظار المراجعة
        public const string APPROVED = "APPROVED";   // تمت الموافقة
        public const string REJECTED = "REJECTED";   // مرفوض
        public const string COMPLETED = "COMPLETED";  // مكتمل (تم الاسترداد)
    }

    public static class ReturnReason
    {
        public const string DEFECTIVE = "defective";         // معيب
        public const string WRONG_ITEM = "wrong_item";        // منتج خاطئ
        public const string NOT_AS_DESCRIBED = "not_as_described";  // لا يطابق الوصف
        public const string CHANGED_MIND = "changed_mind";      // تغيير الرأي
        public const string OTHER = "other";             // أخرى

        public static readonly string[] All =
        {
            DEFECTIVE, WRONG_ITEM, NOT_AS_DESCRIBED, CHANGED_MIND, OTHER
        };
    }
}