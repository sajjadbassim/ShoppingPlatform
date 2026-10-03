using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Exceptions;
using ecommerce.Data;
using ecommerce.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace ecommerce.Services.DriverTrackingService
{
    // التتبع المباشر: السائق يشارك موقعه من رابط سري (بدون حساب)، والعمليات ترى الخريطة.
    // نحفظ آخر موقع فقط — لا سجل مسارات.
    public interface IDriverTrackingService
    {
        Task<DriverTrackingLinkDto> CreateLinkAsync(Guid driverId, CancellationToken ct = default);
        Task RevokeLinkAsync(Guid driverId, CancellationToken ct = default);
        Task<DriverTrackingInfoDto> GetByTokenAsync(string token, CancellationToken ct = default);
        Task UpdateLocationAsync(string token, DriverLocationUpdateDto dto, CancellationToken ct = default);
        Task UpdateLocationForDriverAsync(Guid driverId, DriverLocationUpdateDto dto, CancellationToken ct = default);
        Task<TrackingBoardDto> GetBoardAsync(CancellationToken ct = default);
    }

    public class DriverTrackingService : IDriverTrackingService
    {
        public const string StageWaitingStores = "WAITING_STORES";
        public const string StageReadyForDriver = "READY_FOR_DRIVER";
        public const string StageOutForDelivery = "OUT_FOR_DELIVERY";

        // تحديثات أسرع من هذا تُتجاهل (الهاتف قد يرسل كل ثانية)
        private static readonly TimeSpan MinUpdateInterval = TimeSpan.FromSeconds(3);

        private static readonly string[] ActiveStatuses =
        {
            OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PARTIALLY_CONFIRMED,
            OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY,
        };

        private readonly AppDbContext _context;
        private readonly IHubContext<OpsHub> _opsHub;
        private readonly TimeProvider _time;

        public DriverTrackingService(AppDbContext context, IHubContext<OpsHub> opsHub, TimeProvider time)
        {
            _context = context;
            _opsHub = opsHub;
            _time = time;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public static string HashToken(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        // ===================================
        // الرابط
        // ===================================
        public async Task<DriverTrackingLinkDto> CreateLinkAsync(Guid driverId, CancellationToken ct = default)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId, ct)
                ?? throw new NotFoundException("السائق غير موجود");

            // رابط جديد يُبطل القديم
            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
            driver.LocationTokenHash = HashToken(token);
            driver.UpdatedAt = Now;
            await _context.SaveChangesAsync(ct);

            return new DriverTrackingLinkDto { Token = token };
        }

        public async Task RevokeLinkAsync(Guid driverId, CancellationToken ct = default)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId, ct)
                ?? throw new NotFoundException("السائق غير موجود");

            driver.LocationTokenHash = null;
            driver.LastLatitude = null;
            driver.LastLongitude = null;
            driver.LastLocationAccuracy = null;
            driver.LastLocationAt = null;
            await _context.SaveChangesAsync(ct);
        }

        public async Task<DriverTrackingInfoDto> GetByTokenAsync(string token, CancellationToken ct = default)
        {
            var driver = await FindByTokenAsync(token, ct);
            return new DriverTrackingInfoDto { DriverName = driver.FullName, LastLocationAt = driver.LastLocationAt };
        }

        // ===================================
        // تحديث الموقع من هاتف السائق
        // ===================================
        public async Task UpdateLocationAsync(string token, DriverLocationUpdateDto dto, CancellationToken ct = default)
        {
            if (dto.Latitude is < -90 or > 90 || dto.Longitude is < -180 or > 180 || (dto.Latitude == 0 && dto.Longitude == 0))
                throw new BusinessRuleException("موقع غير صالح");

            var driver = await FindByTokenAsync(token, ct);
            await ApplyLocationAsync(driver, dto, ct);
        }

        public async Task UpdateLocationForDriverAsync(Guid driverId, DriverLocationUpdateDto dto, CancellationToken ct = default)
        {
            if (dto.Latitude is < -90 or > 90 || dto.Longitude is < -180 or > 180 || (dto.Latitude == 0 && dto.Longitude == 0))
                throw new BusinessRuleException("موقع غير صالح");

            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId, ct)
                ?? throw new NotFoundException("السائق غير موجود");
            await ApplyLocationAsync(driver, dto, ct);
        }

        private async Task ApplyLocationAsync(Core.Models.Driver driver, DriverLocationUpdateDto dto, CancellationToken ct)
        {
            if (driver.Status != DriverStatus.Active)
                throw new ForbiddenException("حساب السائق موقوف");

            if (driver.LastLocationAt.HasValue && Now - driver.LastLocationAt.Value < MinUpdateInterval)
                return;

            driver.LastLatitude = Math.Round(dto.Latitude, 6);
            driver.LastLongitude = Math.Round(dto.Longitude, 6);
            driver.LastLocationAccuracy = dto.Accuracy.HasValue ? Math.Round(dto.Accuracy.Value, 1) : null;
            driver.LastLocationAt = Now;
            await _context.SaveChangesAsync(ct);

            await _opsHub.Clients.Group("OpsTeam").SendAsync("DriverLocation", new DriverLocationDto
            {
                DriverId = driver.Id,
                Latitude = driver.LastLatitude.Value,
                Longitude = driver.LastLongitude.Value,
                Accuracy = driver.LastLocationAccuracy,
                At = driver.LastLocationAt.Value,
            }, ct);
        }

        private async Task<Core.Models.Driver> FindByTokenAsync(string token, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length > 100)
                throw new NotFoundException("رابط التتبع غير صالح");

            var hash = HashToken(token);
            return await _context.Drivers.FirstOrDefaultAsync(d => d.LocationTokenHash == hash, ct)
                ?? throw new NotFoundException("رابط التتبع غير صالح أو تم إلغاؤه");
        }

        // ===================================
        // لوحة العمليات
        // ===================================
        public async Task<TrackingBoardDto> GetBoardAsync(CancellationToken ct = default)
        {
            var subOrders = await _context.SubOrders
                .AsNoTracking()
                .Where(so => ActiveStatuses.Contains(so.Status))
                .Include(so => so.Vendor)
                .Include(so => so.Driver)
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .AsSplitQuery()
                .ToListAsync(ct);

            var deliveries = subOrders
                .GroupBy(so => so.OrderId)
                .Select(g =>
                {
                    var order = g.First().Order;
                    var subs = g.ToList();
                    var outForDelivery = subs.Where(s => s.Status == OrderStatus.OUT_FOR_DELIVERY).ToList();

                    string stage;
                    DateTime? since;
                    if (outForDelivery.Count > 0)
                    {
                        stage = StageOutForDelivery;
                        since = outForDelivery.Min(s => s.AssignedAt ?? s.UpdatedAt);
                    }
                    else if (subs.All(s => s.Status == OrderStatus.READY))
                    {
                        stage = StageReadyForDriver;
                        since = subs.Max(s => s.UpdatedAt);
                    }
                    else
                    {
                        stage = StageWaitingStores;
                        since = order.CreatedAt;
                    }

                    var driverSub = outForDelivery.FirstOrDefault(s => s.Driver != null);
                    return new TrackingDeliveryDto
                    {
                        OrderId = order.Id,
                        OrderNumber = order.OrderNumber,
                        Stage = stage,
                        CustomerName = order.Customer?.FullName,
                        CustomerPhone = order.Address?.Phone ?? order.Customer?.Phone,
                        Address = order.Address == null ? null
                            : string.Join("، ", new[] { order.Address.StreetAddress, order.Address.Area, order.Address.City }
                                .Where(x => !string.IsNullOrWhiteSpace(x))),
                        ZoneName = order.DeliveryZoneName,
                        Latitude = (double?)(order.DeliveryLatitude ?? order.Address?.Latitude),
                        Longitude = (double?)(order.DeliveryLongitude ?? order.Address?.Longitude),
                        Stores = subs.Select(s => s.Vendor?.NameAr ?? s.Vendor?.Name ?? "").Where(n => n != "").Distinct().ToList(),
                        DriverId = driverSub?.DriverId,
                        DriverName = driverSub?.Driver?.FullName,
                        Total = order.TotalAmount,
                        CreatedAt = order.CreatedAt,
                        StageSince = since,
                    };
                })
                .OrderBy(d => d.Stage == StageOutForDelivery ? 0 : d.Stage == StageReadyForDriver ? 1 : 2)
                .ThenBy(d => d.StageSince)
                .ToList();

            var activeByDriver = deliveries
                .Where(d => d.DriverId.HasValue)
                .GroupBy(d => d.DriverId!.Value)
                .ToDictionary(g => g.Key, g => g.Count());

            var drivers = await _context.Drivers
                .AsNoTracking()
                .Where(d => d.Status == DriverStatus.Active)
                .OrderBy(d => d.FullName)
                .ToListAsync(ct);

            return new TrackingBoardDto
            {
                Deliveries = deliveries,
                Drivers = drivers.Select(d => new TrackingDriverDto
                {
                    Id = d.Id,
                    FullName = d.FullName,
                    Phone = d.Phone,
                    VehicleType = d.VehicleType,
                    WorkStatus = d.WorkStatus,
                    Latitude = d.LastLatitude,
                    Longitude = d.LastLongitude,
                    Accuracy = d.LastLocationAccuracy,
                    LastLocationAt = d.LastLocationAt,
                    HasTrackingLink = d.LocationTokenHash != null,
                    ActiveDeliveries = activeByDriver.GetValueOrDefault(d.Id),
                }).ToList(),
            };
        }
    }
}
