using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;

namespace ecommerce.Services.VendorService.VendorService
{
    public interface IVendorService
    {
        Task<VendorResponseDto> CreateAsync(VendorCreateDto dto, Guid? ownerId = null);
        Task<VendorResponseDto> GetByIdAsync(Guid id);
        Task<IEnumerable<VendorResponseDto>> GetAllAsync(bool onlyActive = true);
        Task<VendorResponseDto> GetByPhoneAsync(string phone);

        Task<VendorResponseDto> UpdateAsync(Guid id, VendorUpdateDto dto);
        Task<bool> DeleteAsync(Guid id);
      
        // Pagination
        Task<PagedResponse<VendorResponseDto>> GetVendorsPagedAsync(
            string searchTerm = null,
            bool? onlyActive = null,
            int pageNumber = 1,
            int pageSize = 20
        );

        // Logo Methods 
        Task<VendorResponseDto> UpdateLogoAsync(Guid id, IFormFile logo);
        Task<bool> DeleteLogoAsync(Guid id);
    }
}
