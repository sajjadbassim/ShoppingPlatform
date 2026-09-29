namespace ecommerce.Core.Interfaces
{
    public interface ICurrentUserService
    {
        // يرمي UnauthorizedException إذا لم يكن هناك مستخدم مسجّل دخول
        Guid UserId { get; }
    }
}
