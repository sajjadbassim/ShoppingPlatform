namespace ecommerce.Services.SmsService
{
    /// <summary>
    /// تنفيذ افتراضي للتطوير: يطبع الرسالة في الـ console بدل إرسالها فعليًا،
    /// لأن المشروع لا يملك حاليًا حساب مزوّد SMS حقيقي.
    /// </summary>
    public class ConsoleSmsSender : ISmsSender
    {
        public Task SendAsync(string phone, string message)
        {
            Console.WriteLine($"[SMS -> {phone}] {message}");
            return Task.CompletedTask;
        }
    }
}
