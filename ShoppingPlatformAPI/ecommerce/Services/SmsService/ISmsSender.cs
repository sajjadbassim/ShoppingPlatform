namespace ecommerce.Services.SmsService
{
    /// <summary>
    /// واجهة إرسال SMS — قابلة للاستبدال بمزوّد حقيقي (Twilio, ...) لاحقًا
    /// بدون تغيير أي كود يستدعيها.
    /// </summary>
    public interface ISmsSender
    {
        Task SendAsync(string phone, string message);
    }
}
