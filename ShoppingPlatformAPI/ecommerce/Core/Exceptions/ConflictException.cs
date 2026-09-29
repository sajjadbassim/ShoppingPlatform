namespace ecommerce.Core.Exceptions
{
    // 409 — تعارض حالة أو تكرار
    public class ConflictException : AppException
    {
        public ConflictException(string message) : base(message) { }
    }
}
