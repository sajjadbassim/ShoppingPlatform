namespace ecommerce.Core.Exceptions
{
    // 400 — قاعدة عمل مخالَفة
    public class BusinessRuleException : AppException
    {
        public BusinessRuleException(string message) : base(message) { }
    }
}
