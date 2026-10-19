namespace ecommerce.Core.Models
{
    // إثبات ملكية رقم الهاتف قبل ربطه بحساب (إنشاء حساب، أو إضافة رقم لحساب Google):
    // رمز يُرسل للرقم ← التحقق منه يُصدر رمز إثبات قصير العمر يُقدَّم مع الطلب ويُستهلك مرة واحدة
    public class PhoneVerification
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        // بصيغة 07XXXXXXXXX
        public string Phone { get; set; } = "";

        public string CodeHash { get; set; } = "";
        public DateTime ExpiresAt { get; set; }
        public int Attempts { get; set; }

        // SHA-256 لرمز الإثبات (الرمز نفسه لا يُخزَّن)
        public string? TokenHash { get; set; }
        public DateTime? TokenExpiresAt { get; set; }
        public DateTime? UsedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
