namespace ecommerce.Core.Exceptions
{
    // 401 — بيانات اعتماد خاطئة أو مستخدم غير معرّف
    public class UnauthorizedException : AppException
    {
        public UnauthorizedException(string message) : base(message) { }
    }
}
