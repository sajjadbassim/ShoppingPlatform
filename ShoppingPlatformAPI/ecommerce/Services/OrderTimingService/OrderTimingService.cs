using ecommerce.Core.Constants;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.OrderTimingService
{
    // مراحل الطلب ومدة كل مرحلة — من سجل الحالات وأوقات الطلبات الفرعية
    public class OrderTimingStageDto
    {
        public string Key { get; set; } = "";
        public string Label { get; set; } = "";
        public double Minutes { get; set; }
    }

    public class OrderTimingDto
    {
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public bool IsDelivered { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? DeliveredAt { get; set; }
        public double? TotalMinutes { get; set; }      // من الطلب حتى وصوله (للمُسلَّم)
        public double? ElapsedMinutes { get; set; }    // منذ الطلب حتى الآن (للجاري)
        public string? Speed { get; set; }             // fast | normal | slow (للمُسلَّم)
        public List<OrderTimingStageDto> Stages { get; set; } = new();
        public string? SlowestStage { get; set; }      // أطول مرحلة — أين حصل التأخير
        public bool PickupRecorded { get; set; }       // هل سجّل السائق الاستلام من المتجر
    }

    public interface IOrderTimingService
    {
        Task<Dictionary<Guid, OrderTimingDto>> GetTimingsAsync(IEnumerable<Guid> orderIds, CancellationToken ct = default);
        Task<(int Fast, int Slow)> GetThresholdsAsync(CancellationToken ct = default);
    }

    public class OrderTimingService : IOrderTimingService
    {
        public const int DefaultFast = 45;
        public const int DefaultSlow = 90;

        private readonly AppDbContext _context;
        private readonly TimeProvider _time;

        public OrderTimingService(AppDbContext context, TimeProvider? time = null)
        {
            _context = context;
            _time = time ?? TimeProvider.System;
        }

        public async Task<(int Fast, int Slow)> GetThresholdsAsync(CancellationToken ct = default)
        {
            var s = await _context.DeliverySettings.AsNoTracking()
                .Select(x => new { x.DeliveryFastMinutes, x.DeliverySlowMinutes }).FirstOrDefaultAsync(ct);
            var fast = s?.DeliveryFastMinutes ?? DefaultFast;
            var slow = s?.DeliverySlowMinutes ?? DefaultSlow;
            return fast > 0 && slow > fast ? (fast, slow) : (DefaultFast, DefaultSlow);
        }

        public async Task<Dictionary<Guid, OrderTimingDto>> GetTimingsAsync(IEnumerable<Guid> orderIds, CancellationToken ct = default)
        {
            var ids = orderIds.Distinct().ToList();
            if (ids.Count == 0) return new();

            var orders = await _context.Orders.AsNoTracking()
                .Where(o => ids.Contains(o.Id))
                .Select(o => new { o.Id, o.OrderNumber, o.CreatedAt, o.Status })
                .ToListAsync(ct);

            var subs = await _context.SubOrders.AsNoTracking()
                .Where(s => ids.Contains(s.OrderId) && s.Status != OrderStatus.CANCELLED)
                .Select(s => new { s.Id, s.OrderId, s.ConfirmedAt, s.AssignedAt, s.PickedUpAt })
                .ToListAsync(ct);

            var subIds = subs.Select(s => s.Id).ToList();
            var logs = await _context.OrderStatusLogs.AsNoTracking()
                .Where(l => l.SubOrderId != null && subIds.Contains(l.SubOrderId.Value)
                    && (l.NewStatus == OrderStatus.PREPARING || l.NewStatus == OrderStatus.READY || l.NewStatus == OrderStatus.OUT_FOR_DELIVERY || l.NewStatus == OrderStatus.DELIVERED))
                .Select(l => new { SubOrderId = l.SubOrderId!.Value, l.NewStatus, l.CreatedAt })
                .ToListAsync(ct);
            // آخر مرة دخل فيها كل طلب فرعي كل حالة (إعادة المحاولة تبدأ مرحلة جديدة)
            var at = logs.GroupBy(l => (l.SubOrderId, l.NewStatus)).ToDictionary(g => g.Key, g => g.Max(l => l.CreatedAt));

            var (fast, slow) = await GetThresholdsAsync(ct);
            var now = _time.GetUtcNow().UtcDateTime;
            var result = new Dictionary<Guid, OrderTimingDto>();

            foreach (var o in orders)
            {
                var mine = subs.Where(s => s.OrderId == o.Id).ToList();
                DateTime? Last(Func<Guid, DateTime?> pick)
                {
                    if (mine.Count == 0) return null;
                    var values = mine.Select(s => pick(s.Id)).ToList();
                    return values.All(v => v.HasValue) ? values.Max() : null;   // المرحلة تنتهي حين ينهيها آخر متجر
                }
                DateTime? Log(Guid subId, string status) => at.TryGetValue((subId, status), out var t) ? t : null;

                var confirmed = Last(id => mine.First(s => s.Id == id).ConfirmedAt);
                var preparing = Last(id => Log(id, OrderStatus.PREPARING));
                var ready = Last(id => Log(id, OrderStatus.READY));
                var assigned = Last(id => Log(id, OrderStatus.OUT_FOR_DELIVERY) ?? mine.First(s => s.Id == id).AssignedAt);
                var pickedUp = Last(id => mine.First(s => s.Id == id).PickedUpAt);
                var isDelivered = o.Status == OrderStatus.DELIVERED;
                var delivered = isDelivered ? Last(id => Log(id, OrderStatus.DELIVERED)) : null;

                var dto = new OrderTimingDto
                {
                    OrderId = o.Id,
                    OrderNumber = o.OrderNumber,
                    IsDelivered = isDelivered && delivered.HasValue,
                    CreatedAt = o.CreatedAt,
                    DeliveredAt = delivered,
                    PickupRecorded = pickedUp.HasValue,
                };

                void Stage(string key, string label, DateTime? from, DateTime? to)
                {
                    if (from.HasValue && to.HasValue && to >= from)
                        dto.Stages.Add(new OrderTimingStageDto { Key = key, Label = label, Minutes = Math.Round((to.Value - from.Value).TotalMinutes, 1) });
                }

                Stage("confirm", "انتظار تأكيد المتجر", o.CreatedAt, confirmed);
                Stage("start", "حتى بدء التحضير", confirmed, preparing);
                if (ready.HasValue && ready >= preparing)
                {
                    Stage("prepare", "التحضير", preparing, ready);
                    Stage("dispatch", "إسناد السائق", ready, assigned);
                }
                else
                {
                    Stage("prepare", "التحضير وإسناد السائق", preparing, assigned);   // طلبات ما قبل «جاهز للاستلام»
                }
                if (pickedUp.HasValue && pickedUp >= assigned)
                {
                    Stage("pickup", "وصول السائق للمتجر", assigned, pickedUp);
                    Stage("ride", "الطريق إلى الزبون", pickedUp, delivered);
                }
                else
                {
                    Stage("ride", "الاستلام والطريق إلى الزبون", assigned, delivered);
                }

                if (dto.IsDelivered)
                {
                    dto.TotalMinutes = Math.Round((delivered!.Value - o.CreatedAt).TotalMinutes, 1);
                    dto.Speed = dto.TotalMinutes <= fast ? "fast" : dto.TotalMinutes >= slow ? "slow" : "normal";
                }
                else if (o.Status != OrderStatus.CANCELLED && o.Status != OrderStatus.DELIVERY_FAILED)
                {
                    dto.ElapsedMinutes = Math.Round((now - o.CreatedAt).TotalMinutes, 1);
                }

                dto.SlowestStage = dto.Stages.Count > 1 ? dto.Stages.MaxBy(s => s.Minutes)!.Label : null;
                result[o.Id] = dto;
            }
            return result;
        }
    }
}
