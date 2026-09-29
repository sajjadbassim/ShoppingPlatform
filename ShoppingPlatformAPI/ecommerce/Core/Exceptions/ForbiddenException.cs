namespace ecommerce.Core.Exceptions
{
    // 403 — مسجّل دخول لكن لا يملك الصلاحية
    public class ForbiddenException : AppException
    {
        public ForbiddenException(string message) : base(message) { }
    }
}
