namespace ecommerce.Services.SmsService
{
    /// <summary>
    /// إيصال رمز التحقق للمستخدم. الرمز يولّده خادمنا ويتحقق منه بنفسه (المحاولات والصلاحية في قاعدة بياناتنا)،
    /// والمزوّد يوصله فقط. الفشل لا يُرمى للمستدعي: رد «نسيت كلمة المرور» يبقى واحداً سواء كان الرقم مسجلاً أم لا.
    /// </summary>
    public interface IOtpSender
    {
        Task SendCodeAsync(string phone, string code, CancellationToken ct = default);
    }
}
