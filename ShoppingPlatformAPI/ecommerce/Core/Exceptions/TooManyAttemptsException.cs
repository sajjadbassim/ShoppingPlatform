namespace ecommerce.Core.Exceptions
{
    // 429 — محاولات كثيرة (تسجيل دخول خاطئ متكرر من عنوان واحد)
    public class TooManyAttemptsException : AppException
    {
        public TooManyAttemptsException(string message) : base(message) { }
    }
}
