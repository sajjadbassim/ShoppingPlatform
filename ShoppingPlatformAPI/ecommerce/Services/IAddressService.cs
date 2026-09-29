using ecommerce.Core.DTO.Addresses;

namespace ecommerce.Services
{
    public interface IAddressService
    {
        Task<AddressResponseDto> GetByIdAsync(Guid id);
        Task<IEnumerable<AddressResponseDto>> GetByUserIdAsync(Guid userId);
        Task<IEnumerable<AddressResponseDto>> GetAllAsync();
        Task<AddressResponseDto> CreateAsync(AddressCreateDto dto);
        Task<AddressResponseDto> UpdateAsync(Guid id, AddressUpdateDto dto);
        Task<bool> DeleteAsync(Guid id);
    }
}
