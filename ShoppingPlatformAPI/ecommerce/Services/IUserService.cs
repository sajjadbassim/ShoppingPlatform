using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Users;

namespace ecommerce.Services
{
    public interface IUserService
    {
        Task<UserResponseDto> RegisterAsync(RegisterDto dto);
        Task<UserResponseDto> GetByIdAsync(Guid id);
        Task<UserResponseDto> GetByPhoneAsync(string phone);
        Task<IEnumerable<UserResponseDto>> GetAllAsync();
        Task<IEnumerable<UserResponseDto>> GetByRoleAsync(string role);
        Task<UserResponseDto> UpdateAsync(Guid id, UpdateUserDto dto);
        Task<bool> DeleteAsync(Guid id);

        Task<PagedResponse<UserResponseDto>> GetUsersPagedAsync(
          string role = null,
          string searchTerm = null,
          bool? isActive = null,
          int pageNumber = 1,
          int pageSize = 20);
    }
}
