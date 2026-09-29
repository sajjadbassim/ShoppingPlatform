using ecommerce.Core.DTO.Users;

namespace ecommerce.Services.UserPreferencesService
{
    public interface IUserPreferencesService
    {
        Task<UserPreferencesResponseDto> GetAsync(Guid userId, CancellationToken ct = default);
        Task<UserPreferencesResponseDto> UpdateAsync(Guid userId, UserPreferencesUpdateDto dto, CancellationToken ct = default);
    }
}
