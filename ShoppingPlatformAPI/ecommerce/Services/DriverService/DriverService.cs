// Services/DriverService.cs
using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Drivers;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services
{
    public class DriverService : IDriverService
    {
        private readonly IDriverRepository _driverRepository;
        private readonly ISubOrderRepository _subOrderRepository;
        private readonly IUserRepository _userRepository;

        public DriverService(IDriverRepository driverRepository, ISubOrderRepository subOrderRepository, IUserRepository userRepository)
        {
            _driverRepository = driverRepository;
            _subOrderRepository = subOrderRepository;
            _userRepository = userRepository;
        }

        public async Task<DriversPagedResultDto> GetDriversPagedAsync(
            int pageNumber, int pageSize, string? status, string? workStatus)
        {
            var (items, totalCount) = await _driverRepository.GetPagedAsync(
                pageNumber, pageSize, status, workStatus);
            var drivers = items.ToList();
            var load = await _driverRepository.GetActiveOrderCountsAsync(drivers.Select(d => d.Id));

            return new DriversPagedResultDto
            {
                Items = drivers.Select(d => { var dto = MapToDto(d); dto.ActiveOrders = load.GetValueOrDefault(d.Id); return dto; }).ToList(),
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<DriverDto> GetDriverByIdAsync(Guid id)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new NotFoundException("السائق غير موجود");

            return MapToDto(driver);
        }

        public async Task<IEnumerable<DriverDto>> GetAvailableDriversAsync()
        {
            var drivers = (await _driverRepository.GetAvailableDriversAsync()).ToList();
            var load = await _driverRepository.GetActiveOrderCountsAsync(drivers.Select(d => d.Id));
            // الأقل حملاً أولاً
            return drivers
                .Select(d => { var dto = MapToDto(d); dto.ActiveOrders = load.GetValueOrDefault(d.Id); return dto; })
                .OrderBy(d => d.ActiveOrders).ThenBy(d => d.FullName)
                .ToList();
        }

        public async Task<DriverDto> CreateDriverAsync(CreateDriverDto dto)
        {
            // الرقم بصيغة واحدة — هو أيضاً رقم دخول السائق إن أُنشئ له حساب
            dto.Phone = PhoneNumber.Require(dto.Phone);

            // التحقق من عدم تكرار رقم الهاتف
            var existing = await _driverRepository.GetByPhoneAsync(dto.Phone);
            if (existing != null)
                throw new BusinessRuleException("رقم الهاتف مسجل مسبقاً");

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
                throw new NotFoundException("السائق غير موجود");

            // تحديث فقط الحقول المرسلة
            if (!string.IsNullOrEmpty(dto.FullName))
                driver.FullName = dto.FullName;

            if (!string.IsNullOrEmpty(dto.Phone))
            {
                dto.Phone = PhoneNumber.Require(dto.Phone);
                var existing = await _driverRepository.GetByPhoneAsync(dto.Phone);
                if (existing != null && existing.Id != id)
                    throw new BusinessRuleException("رقم الهاتف مسجل مسبقاً");

                // رقم الدخول يتبع رقم السائق
                if (driver.UserId.HasValue && dto.Phone != driver.Phone)
                {
                    var owner = await _userRepository.GetByPhoneAsync(dto.Phone);
                    if (owner != null && owner.Id != driver.UserId)
                        throw new BusinessRuleException("رقم الهاتف مسجل بحساب آخر");
                    var user = await _userRepository.GetByIdAsync(driver.UserId.Value);
                    if (user != null) { user.Phone = dto.Phone; await _userRepository.UpdateAsync(user); }
                }
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
                throw new NotFoundException("السائق غير موجود");

            // إيقاف سائق معه طلب في الطريق يترك الطلب بلا من يسلّمه
            if (driver.Status == DriverStatus.Active && await _subOrderRepository.HasActiveDeliveryAsync(driver.Id))
                throw new BusinessRuleException("مع السائق طلب في الطريق — انتظر تسليمه أو تعذّره قبل إيقافه");

            driver.Status = driver.Status == DriverStatus.Active
                ? DriverStatus.Suspended
                : DriverStatus.Active;

            // لو تم إيقافه، غير workStatus لـ offline
            if (driver.Status == DriverStatus.Suspended)
                driver.WorkStatus = DriverWorkStatus.Offline;

            // السائق الموقوف لا يستطيع الدخول للوحته
            if (driver.UserId.HasValue)
            {
                var user = await _userRepository.GetByIdAsync(driver.UserId.Value);
                if (user != null) { user.IsActive = driver.Status == DriverStatus.Active; await _userRepository.UpdateAsync(user); }
            }

            driver = await _driverRepository.UpdateAsync(driver);
            return MapToDto(driver);
        }

        public async Task<DriverDto> UpdateDriverWorkStatusAsync(Guid id, UpdateDriverWorkStatusDto dto)
        {
            var driver = await _driverRepository.GetByIdAsync(id);
            if (driver == null)
                throw new NotFoundException("السائق غير موجود");

            if (driver.Status != DriverStatus.Active)
                throw new BusinessRuleException("السائق غير نشط");

            var allowedStatuses = new[]
            {
        DriverWorkStatus.Available,
        DriverWorkStatus.Delivering,
        DriverWorkStatus.Break,
        DriverWorkStatus.Offline
    };

            if (!allowedStatuses.Contains(dto.WorkStatus))
                throw new BusinessRuleException("حالة العمل غير صحيحة");

            // «يوصل» تتبع الطلبات فعلاً: لا يُجعل السائق متاحاً (فيُعيَّن له طلب ثانٍ) وهو في الطريق، ولا «يوصل» بلا طلب
            var delivering = await _subOrderRepository.HasActiveDeliveryAsync(driver.Id);
            if (delivering && dto.WorkStatus != DriverWorkStatus.Delivering)
                throw new BusinessRuleException("مع السائق طلب في الطريق — تتغير حالته تلقائياً بعد التسليم");
            if (!delivering && dto.WorkStatus == DriverWorkStatus.Delivering)
                throw new BusinessRuleException("لا يوجد مع السائق طلب في الطريق");

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
            CreatedAt = driver.CreatedAt,
            HasAccount = driver.UserId.HasValue
        };

        public async Task<DriverOrdersResultDto> GetDriverOrdersAsync(
    Guid driverId, int pageNumber, int pageSize, string? filter)
        {
            var driver = await _driverRepository.GetByIdAsync(driverId);
            if (driver == null)
                throw new NotFoundException("السائق غير موجود");

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
                        DeliverySlotStart = so.Order?.DeliverySlotStart,
                        DeliverySlotEnd = so.Order?.DeliverySlotEnd,
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
                            Subtotal = i.Subtotal,
                            WeightStepKg = i.WeightStepKg
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
                throw new NotFoundException("السائق غير موجود");

            return await _subOrderRepository.GetDriverStatsAsync(driverId);
        }






    }
}