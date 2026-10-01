using ecommerce.Core.Constants;
using ecommerce.Core.Exceptions;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.OrderSettingsService
{
    public class OrderSettingsDto
    {
        public int ConfirmationTimeoutMinutes { get; set; }
        public int DeliveryFastMinutes { get; set; }
        public int DeliverySlowMinutes { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    // طلب فرعي تجاوز مهلة تأكيد المتجر ولم يُؤكَّد
    public class OverdueConfirmationDto
    {
        public Guid SubOrderId { get; set; }
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public string SubOrderNumber { get; set; } = "";
        public string VendorName { get; set; } = "";
        public string? VendorPhone { get; set; }
        public string? CustomerName { get; set; }
        public decimal Total { get; set; }
        public DateTime Deadline { get; set; }
        public int MinutesOverdue { get; set; }
    }

    public interface IOrderSettingsService
    {
        Task<int> GetConfirmationTimeoutAsync(CancellationToken ct = default);
        Task<OrderSettingsDto> GetAsync(CancellationToken ct = default);
        Task<OrderSettingsDto> SetConfirmationTimeoutAsync(int minutes, Guid userId, CancellationToken ct = default);
        Task<OrderSettingsDto> SetDeliveryThresholdsAsync(int fast, int slow, Guid userId, CancellationToken ct = default);
        Task<List<OverdueConfirmationDto>> GetOverdueConfirmationsAsync(CancellationToken ct = default);
    }

    public class OrderSettingsService : IOrderSettingsService
    {
        public const int DefaultTimeoutMinutes = 5;
        public const int MinTimeoutMinutes = 1;
        public const int MaxTimeoutMinutes = 240;

        private readonly AppDbContext _context;
        private readonly TimeProvider _time;

        public OrderSettingsService(AppDbContext context, TimeProvider? time = null)
        {
            _context = context;
            _time = time ?? TimeProvider.System;
        }

        private DateTime Now => _time.GetUtcNow().UtcDateTime;

        public async Task<int> GetConfirmationTimeoutAsync(CancellationToken ct = default)
        {
            var minutes = await _context.DeliverySettings.AsNoTracking()
                .Select(s => (int?)s.ConfirmationTimeoutMinutes).FirstOrDefaultAsync(ct);
            return minutes is >= MinTimeoutMinutes and <= MaxTimeoutMinutes ? minutes.Value : DefaultTimeoutMinutes;
        }

        public async Task<OrderSettingsDto> GetAsync(CancellationToken ct = default)
        {
            var s = await _context.DeliverySettings.AsNoTracking().FirstOrDefaultAsync(ct);
            var fast = s?.DeliveryFastMinutes ?? 45;
            var slow = s?.DeliverySlowMinutes ?? 90;
            if (fast <= 0 || slow <= fast) (fast, slow) = (45, 90);
            return new OrderSettingsDto
            {
                ConfirmationTimeoutMinutes = await GetConfirmationTimeoutAsync(ct),
                DeliveryFastMinutes = fast,
                DeliverySlowMinutes = slow,
                UpdatedAt = s?.UpdatedAt,
            };
        }

        public async Task<OrderSettingsDto> SetConfirmationTimeoutAsync(int minutes, Guid userId, CancellationToken ct = default)
        {
            if (minutes < MinTimeoutMinutes || minutes > MaxTimeoutMinutes)
                throw new BusinessRuleException($"المهلة بين {MinTimeoutMinutes} و{MaxTimeoutMinutes} دقيقة");

            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new Core.Models.DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.ConfirmationTimeoutMinutes = minutes;
            s.UpdatedAt = Now;
            s.UpdatedBy = userId;
            await _context.SaveChangesAsync(ct);
            return await GetAsync(ct);
        }

        public async Task<OrderSettingsDto> SetDeliveryThresholdsAsync(int fast, int slow, Guid userId, CancellationToken ct = default)
        {
            if (fast < 5 || slow > 1440 || slow <= fast)
                throw new BusinessRuleException("حد «سريع» يجب أن يكون أقل من حد «بطيء» (بين 5 و1440 دقيقة)");

            var s = await _context.DeliverySettings.FirstOrDefaultAsync(ct);
            if (s == null) { s = new Core.Models.DeliverySettings(); _context.DeliverySettings.Add(s); }
            s.DeliveryFastMinutes = fast;
            s.DeliverySlowMinutes = slow;
            s.UpdatedAt = Now;
            s.UpdatedBy = userId;
            await _context.SaveChangesAsync(ct);
            return await GetAsync(ct);
        }

        public async Task<List<OverdueConfirmationDto>> GetOverdueConfirmationsAsync(CancellationToken ct = default)
        {
            var now = Now;
            var rows = await _context.SubOrders.AsNoTracking()
                .Where(so => so.Status == SubOrderStatus.PendingConfirmation && so.ConfirmationDeadline != null && so.ConfirmationDeadline < now)
                .OrderBy(so => so.ConfirmationDeadline)
                .Select(so => new
                {
                    so.Id, so.OrderId, so.Order.OrderNumber, so.SubOrderNumber,
                    VendorName = so.Vendor.NameAr ?? so.Vendor.Name, VendorPhone = so.Vendor.Phone,
                    CustomerName = so.Order.Customer.FullName,
                    Total = so.Subtotal + so.DeliveryFee,
                    Deadline = so.ConfirmationDeadline!.Value,
                })
                .Take(50)
                .ToListAsync(ct);

            return rows.Select(r => new OverdueConfirmationDto
            {
                SubOrderId = r.Id, OrderId = r.OrderId, OrderNumber = r.OrderNumber, SubOrderNumber = r.SubOrderNumber,
                VendorName = r.VendorName ?? "", VendorPhone = r.VendorPhone, CustomerName = r.CustomerName,
                Total = r.Total, Deadline = r.Deadline,
                MinutesOverdue = (int)Math.Max(1, Math.Ceiling((now - r.Deadline).TotalMinutes)),
            }).ToList();
        }
    }
}
