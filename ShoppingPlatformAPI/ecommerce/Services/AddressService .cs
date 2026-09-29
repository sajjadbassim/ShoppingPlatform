using ecommerce.Core.DTO.Addresses;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services
{
    public class AddressService : IAddressService
    {
        private readonly IAddressRepository _addressRepository;

        public AddressService(IAddressRepository addressRepository)
        {
            _addressRepository = addressRepository;
        }
        public async Task<IEnumerable<AddressResponseDto>> GetAllAsync()
        {
            var addresses = await _addressRepository.GetAllAsync();
            return addresses.Select(MapToDto);
        }
        public async Task<AddressResponseDto> GetByIdAsync(Guid id)
        {
            var address = await _addressRepository.GetByIdAsync(id);
            if (address == null)
                throw new Exception("العنوان غير موجود");

            return MapToDto(address);
        }

        public async Task<IEnumerable<AddressResponseDto>> GetByUserIdAsync(Guid userId)
        {
            var addresses = await _addressRepository.GetByUserIdAsync(userId);
            return addresses.Select(MapToDto);
        }

        public async Task<AddressResponseDto> CreateAsync(AddressCreateDto dto)
        {
            var address = new Address
            {
                UserId = dto.UserId,
                Label = dto.Label,
                StreetAddress = dto.StreetAddress,
                Area = dto.Area,
                City = dto.City,
                BuildingNumber = dto.BuildingNumber,
                FloorNumber = dto.FloorNumber,
                ApartmentNumber = dto.ApartmentNumber,
                Phone = dto.Phone,
                Notes = dto.Notes,
                IsDefault = dto.IsDefault,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude
            };

            var createdAddress = await _addressRepository.CreateAsync(address);
            return MapToDto(createdAddress);
        }

        public async Task<AddressResponseDto> UpdateAsync(Guid id, AddressUpdateDto dto)
        {
            var address = await _addressRepository.GetByIdAsync(id);
            if (address == null)
                throw new Exception("العنوان غير موجود");

            // تحديث الحقول المسموح بها فقط
            address.Label = dto.Label ?? address.Label;
            address.StreetAddress = dto.StreetAddress ?? address.StreetAddress;
            address.Area = dto.Area ?? address.Area;
            address.City = dto.City ?? address.City;
            address.BuildingNumber = dto.BuildingNumber ?? address.BuildingNumber;
            address.FloorNumber = dto.FloorNumber ?? address.FloorNumber;
            address.ApartmentNumber = dto.ApartmentNumber ?? address.ApartmentNumber;
            address.Phone = dto.Phone ?? address.Phone;
            address.Notes = dto.Notes ?? address.Notes;
            address.IsDefault = dto.IsDefault;
            address.Latitude = dto.Latitude;
            address.Longitude = dto.Longitude;

            var updatedAddress = await _addressRepository.UpdateAsync(address);
            return MapToDto(updatedAddress);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            return await _addressRepository.DeleteAsync(id);
        }

        // Helper method للتحويل من Model إلى ResponseDto
        private AddressResponseDto MapToDto(Address address)
        {
            return new AddressResponseDto
            {
                Id = address.Id,
                UserId = address.UserId,
                Label = address.Label,
                StreetAddress = address.StreetAddress,
                Area = address.Area,
                City = address.City,
                BuildingNumber = address.BuildingNumber,
                FloorNumber = address.FloorNumber,
                ApartmentNumber = address.ApartmentNumber,
                Phone = address.Phone,
                Notes = address.Notes,
                IsDefault = address.IsDefault,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                CreatedAt = address.CreatedAt
            };
        }
    }
}
