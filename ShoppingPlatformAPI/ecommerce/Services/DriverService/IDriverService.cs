// Services/IDriverService.cs
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;

namespace ecommerce.Services
{
    public interface IDriverService
    {
        Task<DriversPagedResultDto> GetDriversPagedAsync(
            int pageNumber, int pageSize, string? status, string? workStatus);
        Task<DriverDto> GetDriverByIdAsync(Guid id);
        Task<IEnumerable<DriverDto>> GetAvailableDriversAsync();
        Task<DriverDto> CreateDriverAsync(CreateDriverDto dto);
        Task<DriverDto> UpdateDriverAsync(Guid id, UpdateDriverDto dto);
        Task<DriverDto> ToggleDriverStatusAsync(Guid id);

        Task<DriverDto> UpdateDriverWorkStatusAsync(Guid id, UpdateDriverWorkStatusDto dto);

        Task<DriverOrdersResultDto> GetDriverOrdersAsync(
    Guid driverId, int pageNumber, int pageSize, string? filter);

        Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId);




    }
}