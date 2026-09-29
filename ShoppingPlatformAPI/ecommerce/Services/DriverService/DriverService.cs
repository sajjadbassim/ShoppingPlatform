// Services/DriverService.cs
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Models;
using ecommerce.Repositories;

namespace ecommerce.Services
{
    public class DriverService : IDriverService
    {
        private readonly IDriverRepository _driverRepository;
        private readonly ISubOrderRepository _subOrderRepository;

        public DriverService(IDriverRepository driverRepository, ISubOrderRepository subOrderRepository)
        {
            _driverRepository = driverRepository;
            _subOrderRepository = subOrderRepository;
        }

        public async Task<DriversPagedResultDto> GetDriversPagedAsync(
            int pageNumber, int pageSize, string? status, string? workStatus)
        {
            var (items, totalCount) = await _driverRepository.GetPagedAsync(
                pageNumber, pageSize, status, workStatus);

            return new DriversPagedResultDto
            {
                Items = items.Select(MapToDto).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<DriverDto> GetDriverByIdAsync(Guid id)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            return MapToDto(driver);
        }

        public async Task<IEnumerable<DriverDto>> GetAvailableDriversAsync()
        {
            var drivers = await _driverRepository.GetAvailableDriversAsync();
            return drivers.Select(MapToDto);
        }

        public async Task<DriverDto> CreateDriverAsync(CreateDriverDto dto)
        {
            // التحقق من عدم تكرار رقم الهاتف
            var existing = await _driverRepository.GetByPhoneAsync(dto.Phone);
            if (existing != null)
                throw new Exception("رقم الهاتف مسجل مسبقاً");

            var driver = new Driver
            {
                FullName = dto.FullName,
                Phone = dto.Phone,
                Email = dto.Email,
                VehicleType = dto.VehicleType,
                WorkArea = dto.WorkArea,
                Status = DriverStatus.Active,
                WorkStatus = DriverWorkStatus.Offline
            };

            driver = await _driverRepository.CreateAsync(driver);
            return MapToDto(driver);
        }

        public async Task<DriverDto> UpdateDriverAsync(Guid id, UpdateDriverDto dto)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            // تحديث فقط الحقول المرسلة
            if (!string.IsNullOrEmpty(dto.FullName))
                driver.FullName = dto.FullName;

            if (!string.IsNullOrEmpty(dto.Phone))
            {
                var existing = await _driverRepository.GetByPhoneAsync(dto.Phone);
                if (existing != null && existing.Id != id)
                    throw new Exception("رقم الهاتف مسجل مسبقاً");
                driver.Phone = dto.Phone;
            }

            if (!string.IsNullOrEmpty(dto.Email))
                driver.Email = dto.Email;

            if (!string.IsNullOrEmpty(dto.VehicleType))
                driver.VehicleType = dto.VehicleType;

            if (!string.IsNullOrEmpty(dto.WorkArea))
                driver.WorkArea = dto.WorkArea;

            driver = await _driverRepository.UpdateAsync(driver);
            return MapToDto(driver);
        }

        public async Task<DriverDto> ToggleDriverStatusAsync(Guid id)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            driver.Status = driver.Status == DriverStatus.Active
                ? DriverStatus.Suspended
                : DriverStatus.Active;

            // لو تم إيقافه، غير workStatus لـ offline
            if (driver.Status == DriverStatus.Suspended)
                driver.WorkStatus = DriverWorkStatus.Offline;

            driver = await _driverRepository.UpdateAsync(driver);
            return MapToDto(driver);
        }

        public async Task<DriverDto> UpdateDriverWorkStatusAsync(Guid id, UpdateDriverWorkStatusDto dto)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            if (driver.Status != DriverStatus.Active)
                throw new Exception("السائق غير نشط");

            var allowedStatuses = new[]
            {
        DriverWorkStatus.Available,
        DriverWorkStatus.Delivering,
        DriverWorkStatus.Break,
        DriverWorkStatus.Offline
    };

            if (!allowedStatuses.Contains(dto.WorkStatus))
                throw new Exception("حالة العمل غير صحيحة");

            driver.WorkStatus = dto.WorkStatus;
            driver = await _driverRepository.UpdateAsync(driver);
            return MapToDto(driver);
        }
        // Helper
        private DriverDto MapToDto(Driver driver) => new DriverDto
        {
            Id = driver.Id,
            FullName = driver.FullName,
            Phone = driver.Phone,
            Email = driver.Email,
            VehicleType = driver.VehicleType,
            WorkArea = driver.WorkArea,
            Status = driver.Status,
            WorkStatus = driver.WorkStatus,
            Rating = driver.Rating,
            TotalDeliveries = driver.TotalDeliveries,
            CreatedAt = driver.CreatedAt
        };

        public async Task<DriverOrdersResultDto> GetDriverOrdersAsync(
    Guid driverId, int pageNumber, int pageSize, string? filter)
        {
            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            var (items, totalCount) = await _subOrderRepository.GetByDriverAsync(
                driverId, pageNumber, pageSize, filter);

            return new DriverOrdersResultDto
            {
                Items = items.Select(so =>
                {
                    var timeRemaining = so.ConfirmationDeadline.HasValue
                        ? so.ConfirmationDeadline.Value - DateTime.UtcNow
                        : TimeSpan.Zero;

                    return new PendingSubOrderDto
                    {
                        Id = so.Id,
                        SubOrderNumber = so.SubOrderNumber,
                        Status = so.Status,
                        OrderId = so.OrderId,
                        OrderNumber = so.Order?.OrderNumber,
                        CustomerId = so.Order?.CustomerId ?? Guid.Empty,
                        CustomerName = so.Order?.Customer?.FullName,
                        CustomerPhone = so.Order?.Customer?.Phone,
                        DeliveryAddress = so.Order?.Address != null
                            ? $"{so.Order.Address.StreetAddress}, {so.Order.Address.Area}, {so.Order.Address.City}"
                            : "",
                        DeliveryPhone = so.Order?.Address?.Phone,
                        DeliveryNotes = so.Order?.CustomerNotes,
                        VendorId = so.VendorId,
                        VendorName = so.Vendor?.Name,
                        VendorNameAr = so.Vendor?.NameAr,
                        VendorPhone = so.Vendor?.Phone,
                        Subtotal = so.Subtotal,
                        DeliveryFee = so.DeliveryFee,
                        CreatedAt = so.CreatedAt,
                        ConfirmationDeadline = so.ConfirmationDeadline,
                        MinutesRemaining = (int)Math.Max(0, timeRemaining.TotalMinutes),
                        SecondsRemaining = (int)Math.Max(0, timeRemaining.TotalSeconds),
                        Items = so.Items?.Select(i => new PendingSubOrderItemDto
                        {
                            ProductId = i.ProductId,
                            ProductName = i.ProductName,
                            ProductNameAr = i.ProductNameAr,
                            ProductImageUrl = i.ProductImageUrl,
                            UnitPrice = i.UnitPrice,
                            Quantity = i.Quantity,
                            Subtotal = i.Subtotal
                        }).ToList() ?? new()
                    };
                }).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId)
        {
            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver == null)
                throw new Exception("السائق غير موجود");

            return await _subOrderRepository.GetDriverStatsAsync(driverId);
        }






    }
}