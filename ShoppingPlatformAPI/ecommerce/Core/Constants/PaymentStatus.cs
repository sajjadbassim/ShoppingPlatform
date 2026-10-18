namespace ecommerce.Core.Constants
{
    public class PaymentStatus
    {
        public const string Pending = "PENDING";
        public const string Paid = "PAID";
        public const string Failed = "FAILED";
        public const string Cancelled = "CANCELLED";   // طلب أُلغي كله ولم يُدفع عنه شيء — لا دفع مستحق
    }
}
