using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Exceptions;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.OpsReportService
{
    public interface IOpsReportService
    {
        Task<OpsReportDto> GetReportAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
    }

    // تقارير العمليات: تُحسب من الطلبات الفرعية وسجل الحالات.
    // الأيام والساعات بتوقيت العراق (UTC+3 بلا توقيت صيفي) حتى يطابق "اليوم" ما يراه الفريق.
    public class OpsReportService : IOpsReportService
    {
        public static readonly TimeSpan IraqOffset = TimeSpan.FromHours(3);
        private const int MaxDays = 366;

        private const int SlowestCount = 10;

        private readonly AppDbContext _context;
        private readonly OrderTimingService.IOrderTimingService? _timing;

        public OpsReportService(AppDbContext context, OrderTimingService.IOrderTimingService? timing = null)
        {
            _context = context;
            _timing = timing;
        }

        private static DateTime StartUtc(DateOnly day) => day.ToDateTime(TimeOnly.MinValue) - IraqOffset;
        private static DateOnly LocalDay(DateTime utc) => DateOnly.FromDateTime(utc + IraqOffset);

        public async Task<OpsReportDto> GetReportAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
        {
            if (to < from) throw new BusinessRuleException("تاريخ النهاية قبل تاريخ البداية");
            var days = to.DayNumber - from.DayNumber + 1;
            if (days > MaxDays) throw new BusinessRuleException($"أقصى مدة للتقرير {MaxDays} يوماً");

            var prevTo = from.AddDays(-1);
            var prevFrom = prevTo.AddDays(-(days - 1));

            // الفترتان معاً في استعلام واحد
            var subs = await LoadAsync(StartUtc(prevFrom), StartUtc(to.AddDays(1)), ct);
            var current = subs.Where(s => s.CreatedAt >= StartUtc(from)).ToList();
            var previous = subs.Where(s => s.CreatedAt < StartUtc(from)).ToList();

            var report = new OpsReportDto
            {
                From = from,
                To = to,
                Summary = Summarize(current),
                PreviousSummary = Summarize(previous),
            };

            // يومي — كل الأيام حتى الخالية
            var byDay = current.GroupBy(s => LocalDay(s.CreatedAt)).ToDictionary(g => g.Key, g => g.ToList());
            for (var d = from; d <= to; d = d.AddDays(1))
            {
                var list = byDay.GetValueOrDefault(d) ?? new();
                report.Daily.Add(new OpsReportDayDto
                {
                    Date = d,
                    Orders = list.Select(s => s.OrderId).Distinct().Count(),
                    Delivered = list.Count(s => s.Status == OrderStatus.DELIVERED),
                    Cancelled = list.Count(s => s.Status == OrderStatus.CANCELLED),
                    Revenue = list.Where(s => s.Status == OrderStatus.DELIVERED).Sum(s => s.Total),
                });
            }

            foreach (var orderGroup in current.GroupBy(s => s.OrderId))
                report.Hourly[(orderGroup.Min(s => s.CreatedAt) + IraqOffset).Hour]++;

            report.Vendors = current
                .GroupBy(s => s.VendorId)
                .Select(g => new OpsReportVendorDto
                {
                    VendorId = g.Key,
                    Name = g.First().VendorName,
                    Orders = g.Count(),
                    Delivered = g.Count(s => s.Status == OrderStatus.DELIVERED),
                    Cancelled = g.Count(s => s.Status == OrderStatus.CANCELLED),
                    Revenue = g.Where(s => s.Status == OrderStatus.DELIVERED).Sum(s => s.Total),
                    AvgConfirmMinutes = Avg(g.Select(s => s.ConfirmMinutes)),
                })
                .OrderByDescending(v => v.Orders).ThenByDescending(v => v.Revenue)
                .Take(20)
                .ToList();

            report.Drivers = current
                .Where(s => s.DriverId.HasValue && s.Status == OrderStatus.DELIVERED)
                .GroupBy(s => s.DriverId!.Value)
                .Select(g => new OpsReportDriverDto
                {
                    DriverId = g.Key,
                    Name = g.First().DriverName ?? "",
                    Deliveries = g.Select(s => s.OrderId).Distinct().Count(),
                    AvgRideMinutes = Avg(g.Select(s => s.RideMinutes)),
                })
                .OrderByDescending(d => d.Deliveries)
                .Take(20)
                .ToList();

            report.CancellationReasons = current
                .Where(s => s.Status == OrderStatus.CANCELLED)
                .GroupBy(s => string.IsNullOrWhiteSpace(s.CancellationReason) ? "بدون سبب" : s.CancellationReason.Trim())
                .Select(g => new OpsReportReasonDto { Reason = g.Key, Count = g.Count() })
                .OrderByDescending(r => r.Count)
                .Take(8)
                .ToList();

            // أبطأ الطلبات المُسلَّمة كاملةً في الفترة، مع أطول مرحلة فيها
            if (_timing != null)
            {
                var deliveredIds = current.GroupBy(r => r.OrderId)
                    .Where(g => g.All(r => r.Status == OrderStatus.DELIVERED))
                    .Select(g => g.Key).ToList();
                var timings = await _timing.GetTimingsAsync(deliveredIds, ct);
                report.SlowestOrders = timings.Values
                    .Where(t => t.TotalMinutes.HasValue)
                    .OrderByDescending(t => t.TotalMinutes)
                    .Take(SlowestCount)
                    .Select(t =>
                    {
                        var worst = t.Stages.Count > 0 ? t.Stages.MaxBy(x => x.Minutes) : null;
                        return new OpsReportSlowOrderDto
                        {
                            OrderId = t.OrderId, OrderNumber = t.OrderNumber, TotalMinutes = t.TotalMinutes!.Value,
                            Speed = t.Speed, SlowestStage = worst?.Label, SlowestStageMinutes = worst?.Minutes, CreatedAt = t.CreatedAt,
                        };
                    }).ToList();
                (report.DeliveryFastMinutes, report.DeliverySlowMinutes) = await _timing.GetThresholdsAsync(ct);
            }

            return report;
        }

        // ===================================
        // البيانات
        // ===================================
        internal sealed class Row
        {
            public Guid OrderId { get; init; }
            public Guid VendorId { get; init; }
            public string VendorName { get; init; } = "";
            public Guid? DriverId { get; init; }
            public string? DriverName { get; init; }
            public string Status { get; init; } = "";
            public decimal Total { get; init; }
            public DateTime CreatedAt { get; init; }
            public string? CancellationReason { get; init; }
            public double? ConfirmMinutes { get; init; }
            public double? DeliveryMinutes { get; init; }
            public double? RideMinutes { get; init; }
        }

        private async Task<List<Row>> LoadAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
        {
            var subs = await _context.SubOrders
                .AsNoTracking()
                .Where(s => s.CreatedAt >= fromUtc && s.CreatedAt < toUtc)
                .Select(s => new
                {
                    s.Id, s.OrderId, s.VendorId, s.DriverId, s.Status, s.Subtotal, s.DeliveryFee,
                    s.CreatedAt, s.ConfirmedAt, s.AssignedAt, s.CancellationReason,
                    VendorName = s.Vendor.NameAr ?? s.Vendor.Name,
                    DriverName = s.Driver != null ? s.Driver.FullName : null,
                })
                .ToListAsync(ct);

            // أوقات الخروج والتسليم من سجل الحالات
            var ids = subs.Select(s => s.Id).ToList();
            var logs = await _context.OrderStatusLogs
                .AsNoTracking()
                .Where(l => l.SubOrderId != null && ids.Contains(l.SubOrderId.Value)
                            && (l.NewStatus == OrderStatus.OUT_FOR_DELIVERY || l.NewStatus == OrderStatus.DELIVERED))
                .Select(l => new { SubOrderId = l.SubOrderId!.Value, l.NewStatus, l.CreatedAt })
                .ToListAsync(ct);
            var firstLog = logs
                .GroupBy(l => (l.SubOrderId, l.NewStatus))
                .ToDictionary(g => g.Key, g => g.Min(l => l.CreatedAt));

            return subs.Select(s =>
            {
                DateTime? delivered = firstLog.TryGetValue((s.Id, OrderStatus.DELIVERED), out var dAt) ? dAt : null;
                DateTime? leftAt = firstLog.TryGetValue((s.Id, OrderStatus.OUT_FOR_DELIVERY), out var oAt) ? oAt : s.AssignedAt;
                return new Row
                {
                    OrderId = s.OrderId,
                    VendorId = s.VendorId,
                    VendorName = s.VendorName ?? "",
                    DriverId = s.DriverId,
                    DriverName = s.DriverName,
                    Status = s.Status,
                    Total = s.Subtotal + s.DeliveryFee,
                    CreatedAt = s.CreatedAt,
                    CancellationReason = s.CancellationReason,
                    ConfirmMinutes = Minutes(s.CreatedAt, s.ConfirmedAt),
                    DeliveryMinutes = s.Status == OrderStatus.DELIVERED ? Minutes(s.CreatedAt, delivered) : null,
                    RideMinutes = s.Status == OrderStatus.DELIVERED ? Minutes(leftAt, delivered) : null,
                };
            }).ToList();
        }

        private static OpsReportSummaryDto Summarize(List<Row> rows)
        {
            var delivered = rows.Where(r => r.Status == OrderStatus.DELIVERED).ToList();
            var revenue = delivered.Sum(r => r.Total);
            var deliveredOrders = delivered.Select(r => r.OrderId).Distinct().Count();
            var cancelled = rows.Count(r => r.Status == OrderStatus.CANCELLED);
            return new OpsReportSummaryDto
            {
                Orders = rows.Select(r => r.OrderId).Distinct().Count(),
                StoreOrders = rows.Count,
                Delivered = delivered.Count,
                Cancelled = cancelled,
                CancellationRate = rows.Count == 0 ? 0 : Math.Round((double)cancelled / rows.Count, 4),
                Revenue = revenue,
                AverageOrderValue = deliveredOrders == 0 ? 0 : Math.Round(revenue / deliveredOrders, 0),
                AvgConfirmMinutes = Avg(rows.Select(r => r.ConfirmMinutes)),
                AvgDeliveryMinutes = Avg(delivered.Select(r => r.DeliveryMinutes)),
                AvgRideMinutes = Avg(delivered.Select(r => r.RideMinutes)),
            };
        }

        // الفروق السالبة (بيانات قديمة غير متسقة) تُستبعد
        private static double? Minutes(DateTime? start, DateTime? end) =>
            start.HasValue && end.HasValue && end >= start ? (end.Value - start.Value).TotalMinutes : null;

        private static double? Avg(IEnumerable<double?> values)
        {
            var list = values.Where(v => v.HasValue).Select(v => v!.Value).ToList();
            return list.Count == 0 ? null : Math.Round(list.Average(), 1);
        }
    }
}
