using ecommerce.Common;
using ecommerce.Core.DTO.Users;
using ecommerce.Core.Interfaces;
using ecommerce.Services.UserPreferencesService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ecommerce.Controllers
{
    // تفضيلات المستخدم الحالي فقط — لا يمكن قراءة أو تعديل تفضيلات مستخدم آخر
    [ApiController]
    [Route("api/users/me/preferences")]
    [Authorize]
    public class UserPreferencesController : ControllerBase
    {
        private readonly IUserPreferencesService _preferencesService;
        private readonly ICurrentUserService _currentUser;

        public UserPreferencesController(IUserPreferencesService preferencesService, ICurrentUserService currentUser)
        {
            _preferencesService = preferencesService;
            _currentUser = currentUser;
        }

        // GET: api/users/me/preferences
        [HttpGet]
        public async Task<ActionResult<ApiResponse<UserPreferencesResponseDto>>> Get(CancellationToken ct)
        {
            var preferences = await _preferencesService.GetAsync(_currentUser.UserId, ct);
            return Ok(ApiResponse<UserPreferencesResponseDto>.Ok(preferences));
        }

        // PUT: api/users/me/preferences
        [HttpPut]
        public async Task<ActionResult<ApiResponse<UserPreferencesResponseDto>>> Update(
            UserPreferencesUpdateDto dto, CancellationToken ct)
        {
            var preferences = await _preferencesService.UpdateAsync(_currentUser.UserId, dto, ct);
            return Ok(ApiResponse<UserPreferencesResponseDto>.Ok(preferences, "تم حفظ الإعدادات بنجاح"));
        }
    }
}
