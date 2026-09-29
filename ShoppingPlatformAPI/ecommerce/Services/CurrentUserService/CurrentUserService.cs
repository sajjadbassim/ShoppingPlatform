using ecommerce.Core.Exceptions;
using ecommerce.Core.Interfaces;
using System.Security.Claims;

namespace ecommerce.Services.CurrentUserService
{
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public Guid UserId
        {
            get
            {
                var claim = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
                return Guid.TryParse(claim, out var userId)
                    ? userId
                    : throw new UnauthorizedException("يجب تسجيل الدخول");
            }
        }
    }
}
