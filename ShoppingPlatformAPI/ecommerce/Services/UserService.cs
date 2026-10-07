using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Users;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;

        public UserService(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<UserResponseDto> RegisterAsync(RegisterDto dto)
        {
            // تحقق من وجود المستخدم
            dto.Phone = PhoneNumber.Require(dto.Phone);
            if (await _userRepository.ExistsAsync(dto.Phone))
            {
                throw new BusinessRuleException("رقم الهاتف مسجل مسبقاً");
            }
            dto.Email = EmailAddress.Normalize(dto.Email);
            if (dto.Email.Length > 0 && await _userRepository.GetByEmailAsync(dto.Email) != null)
                throw new BusinessRuleException("البريد الإلكتروني مستخدم لحساب آخر");

            // تحقق من صحة Role
            var validRoles = new[] { UserRoles.Customer, UserRoles.Ops, UserRoles.Admin };
            if (!validRoles.Contains(dto.Role))
            {
                throw new BusinessRuleException("نوع المستخدم غير صحيح");
            }

            var user = new User
            {
                Phone = dto.Phone,
                FullName = dto.FullName,
                Email = dto.Email,
                Role = dto.Role,
                IsActive = true
            };

            var createdUser = await _userRepository.CreateAsync(user);

            return MapToDto(createdUser);
        }

        public async Task<UserResponseDto> GetByIdAsync(Guid id)
        {
            var user = await _userRepository.GetByIdAsync(id);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            return MapToDto(user);
        }

        public async Task<UserResponseDto> GetByPhoneAsync(string phone)
        {
            var user = await _userRepository.GetByPhoneAsync(phone);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            return MapToDto(user);
        }

        public async Task<IEnumerable<UserResponseDto>> GetAllAsync()
        {
            var users = await _userRepository.GetAllAsync();
            return users.Select(MapToDto);
        }

        public async Task<IEnumerable<UserResponseDto>> GetByRoleAsync(string role)
        {
            var users = await _userRepository.GetByRoleAsync(role);
            return users.Select(MapToDto);
        }

        public async Task<UserResponseDto> UpdateAsync(Guid id, UpdateUserDto dto)
        {
            var user = await _userRepository.GetByIdAsync(id);
            if (user == null)
                throw new NotFoundException("المستخدم غير موجود");

            // تحديث الحقول المسموح بها فقط
            if (!string.IsNullOrEmpty(dto.FullName))
                user.FullName = dto.FullName;

            if (!string.IsNullOrEmpty(dto.Email))
            {
                var email = EmailAddress.Normalize(dto.Email);
                if (!EmailAddress.IsValid(email))
                    throw new BusinessRuleException("البريد الإلكتروني غير صحيح");
                if ((await _userRepository.GetByEmailAsync(email)) is { } other && other.Id != user.Id)
                    throw new BusinessRuleException("البريد الإلكتروني مستخدم لحساب آخر");
                user.Email = email;
            }

            var updatedUser = await _userRepository.UpdateAsync(user);
            return MapToDto(updatedUser);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            return await _userRepository.DeleteAsync(id);
        }

        // Helper method للتحويل من Model إلى DTO
        private UserResponseDto MapToDto(User user)
        {
            return new UserResponseDto
            {
                Id = user.Id,
                Phone = user.Phone,
                AvatarUrl = user.AvatarUrl,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            };
        }

        // ✅ Implementation للـ Pagination
        public async Task<PagedResponse<UserResponseDto>> GetUsersPagedAsync(
            string role = null,
            string searchTerm = null,
            bool? isActive = null,
            int pageNumber = 1,
            int pageSize = 20)
        {
            // استدعاء Repository
            var pagedUsers = await _userRepository.GetPagedAsync(
                role,
                searchTerm,
                isActive,
                pageNumber,
                pageSize
            );

            // تحويل Users إلى DTOs
            var userDtos = pagedUsers.Items.Select(u => new UserResponseDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Phone = u.Phone,
                AvatarUrl = u.AvatarUrl,
                Email = u.Email,
                Role = u.Role,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
            }).ToList();

            // إرجاع PagedResponse
            return new PagedResponse<UserResponseDto>(
                userDtos,
                pagedUsers.TotalCount,
                pagedUsers.PageNumber,
                pagedUsers.PageSize
            );
        }
    }
}
