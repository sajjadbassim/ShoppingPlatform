namespace ecommerce.Core.Exceptions
{
    // 404
    public class NotFoundException : AppException
    {
        public NotFoundException(string message) : base(message) { }
    }
}
