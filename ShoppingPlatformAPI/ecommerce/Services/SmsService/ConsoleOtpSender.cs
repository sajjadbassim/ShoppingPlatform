namespace ecommerce.Services.SmsService
{
    /// <summary>
    /// للتطوير (بلا مفتاح Wevlix): يطبع الرمز في سجل الخادم بدل إرساله.
    /// </summary>
    public class ConsoleOtpSender : IOtpSender
    {
        private readonly ILogger<ConsoleOtpSender> _logger;

        public ConsoleOtpSender(ILogger<ConsoleOtpSender> logger) => _logger = logger;

        public Task SendCodeAsync(string phone, string code, CancellationToken ct = default)
        {
            _logger.LogWarning("[OTP -> {Phone}] {Code} (Wevlix غير مضبوط — الرمز لم يُرسل)", phone, code);
            return Task.CompletedTask;
        }
    }
}
