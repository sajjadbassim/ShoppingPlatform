using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Ops;
using ecommerce.Core.Models;
using ecommerce.Data;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

namespace ecommerce.Repositories
{
    public class SubOrderRepository : ISubOrderRepository
    {
        private readonly AppDbContext _context;

        public SubOrderRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<SubOrder> GetByIdAsync(Guid id)
        {
            return await _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Driver)
                .Include(so => so.ConfirmedByUser)
                .Include(so => so.CancelledByUser)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .FirstOrDefaultAsync(so => so.Id == id);
        }

        public async Task<IEnumerable<SubOrder>> GetByOrderIdAsync(Guid orderId)
        {
            return await _context.SubOrders
                .Include(so => so.Vendor)
                .Include(so => so.Driver)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.OrderId == orderId)
                .OrderBy(so => so.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<SubOrder>> GetPendingSubOrdersAsync()
        {
            return await _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.Status == SubOrderStatus.PendingConfirmation)
                .OrderBy(so => so.ConfirmationDeadline)
                .ToListAsync();
        }

        public async Task<SubOrder> CreateAsync(SubOrder subOrder)
        {
            subOrder.CreatedAt = DateTime.UtcNow;
            subOrder.UpdatedAt = DateTime.UtcNow;
            await _context.SubOrders.AddAsync(subOrder);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(subOrder.Id);
        }

        public async Task<IAsyncDisposable> LockOrderAsync(Guid orderId) => await OrderLock.ForOrderAsync(_context, orderId);

        public async Task<IAsyncDisposable?> LockOrderOfSubOrderAsync(Guid subOrderId) => await OrderLock.ForSubOrderAsync(_context, subOrderId);

        public async Task<SubOrder> UpdateAsync(SubOrder subOrder)
        {
            subOrder.UpdatedAt = DateTime.UtcNow;
            _context.SubOrders.Update(subOrder);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(subOrder.Id);
        }

        public async Task<SubOrderItem> CreateItemAsync(SubOrderItem item)
        {
            item.CreatedAt = DateTime.UtcNow;
            await _context.SubOrderItems.AddAsync(item);
            await _context.SaveChangesAsync();
            return item;
        }

        public async Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? status)
        {
            var query = _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(so => so.Status == status);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        // مع السائق أكثر من هذا = تنبيه في لوحة التشغيل (طلب عالق أو سائق نسي تسجيل التسليم)
        public static readonly TimeSpan StaleDeliveryAge = TimeSpan.FromHours(3);

        public async Task<OpsDashboardStatsDto> GetDashboardStatsAsync()
        {
            // «اليوم» بتوقيت بغداد. الحالات المفتوحة تُعدّ كلها مهما كان يوم إنشائها (طلب الأمس المعلّق ما زال عملاً)،
            // والمنتهية (مسلّم/ملغى) ما انتهى اليوم فقط
            // بالطلبات وحالتها (لا بطلبات المتاجر): كل بطاقة تفتح قائمة الطلبات بنفس الحالة فيتطابق الرقمان
            var todayStart = IraqTime.TodayStartUtc;
            var staleBefore = DateTime.UtcNow - StaleDeliveryAge;
            var open = new[] { OrderStatus.PENDING_CONFIRMATION, OrderStatus.PARTIALLY_CONFIRMED, OrderStatus.CONFIRMED, OrderStatus.PREPARING,
                OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERY_FAILED };
            var orders = await _context.Orders.AsNoTracking()
                .Where(o => open.Contains(o.Status) || o.UpdatedAt >= todayStart || o.CreatedAt >= todayStart)
                .Select(o => new
                {
                    o.Status, o.CreatedAt, o.UpdatedAt,
                    // جاهز وفيه جزء بلا سائق = يحتاج تعييناً؛ كله معيَّن ولم يُستلم = بانتظار استلام السائق
                    NeedsDriver = o.SubOrders.Any(so => so.Status == OrderStatus.READY && so.DriverId == null),
                    Stale = o.SubOrders.Any(so => so.DriverId != null && DriverTrip.Statuses.Contains(so.Status) && (so.AssignedAt ?? so.UpdatedAt) < staleBefore),
                })
                .ToListAsync();
            int Open(string status) => orders.Count(o => o.Status == status);
            int EndedToday(string status) => orders.Count(o => o.Status == status && o.UpdatedAt >= todayStart);

            return new OpsDashboardStatsDto
            {
                PendingConfirmation = Open(OrderStatus.PENDING_CONFIRMATION),
                Confirmed = Open(OrderStatus.CONFIRMED),
                PartiallyConfirmed = Open(OrderStatus.PARTIALLY_CONFIRMED),
                Preparing = Open(OrderStatus.PREPARING),
                Ready = orders.Count(o => o.Status == OrderStatus.READY && o.NeedsDriver),
                AwaitingPickup = orders.Count(o => o.Status == OrderStatus.READY && !o.NeedsDriver),
                OutForDelivery = Open(OrderStatus.OUT_FOR_DELIVERY),
                DeliveryFailed = Open(OrderStatus.DELIVERY_FAILED),
                OpenReturnTrips = await _context.ReturnTrips.CountAsync(t => t.Status == ReturnTripStatus.WithDriver),
                StaleDeliveries = orders.Count(o => o.Stale),
                Delivered = EndedToday(OrderStatus.DELIVERED),
                Cancelled = EndedToday(OrderStatus.CANCELLED),
                TotalToday = orders.Count(o => o.CreatedAt >= todayStart)
            };
        }

        public async Task<(IEnumerable<SubOrder> Items, int TotalCount)> GetByDriverAsync(
            Guid driverId, int pageNumber, int pageSize, string? filter)
        {
            var query = _context.SubOrders
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Vendor)
                .Include(so => so.Items).ThenInclude(i => i.Product)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.AttributeValues)
                        .ThenInclude(av => av.AttributeValue)
                            .ThenInclude(av => av.Attribute)
                .Where(so => so.DriverId == driverId)
                .AsQueryable();

            if (filter == "active")
                query = query.Where(so =>
                    so.Status != OrderStatus.DELIVERED &&
                    so.Status != OrderStatus.CANCELLED);
            else if (filter == "completed")
                query = query.Where(so =>
                    so.Status == OrderStatus.DELIVERED ||
                    so.Status == OrderStatus.CANCELLED);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task<Dictionary<Guid, decimal>> GetDiscountSharesAsync(IEnumerable<Guid> orderIds)
        {
            var ids = orderIds.Distinct().ToList();
            var orders = await _context.Orders.AsNoTracking()
                .Where(o => ids.Contains(o.Id) && o.DiscountAmount > 0)
                .Include(o => o.SubOrders)
                .ToListAsync();

            var result = new Dictionary<Guid, decimal>();
            foreach (var o in orders)
                foreach (var (subId, share) in OrderTotals.DiscountShares(o, o.SubOrders))
                    result[subId] = share;
            return result;
        }

        public Task<bool> HasOpenReturnTripAsync(Guid subOrderId) =>
            _context.ReturnTrips.AnyAsync(t => t.SubOrderId == subOrderId && t.Status == ReturnTripStatus.WithDriver && t.ReturnId == null);

        public Task<bool> HasActiveDeliveryAsync(Guid driverId, Guid? exceptSubOrderId = null) =>
            _context.SubOrders.AnyAsync(so => so.DriverId == driverId && DriverTrip.Statuses.Contains(so.Status)
                && (exceptSubOrderId == null || so.Id != exceptSubOrderId));

        public async Task<DriverStatsDto> GetDriverStatsAsync(Guid driverId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == driverId);
            if (driver == null) throw new NotFoundException("السائق غير موجود");

            // الأيام بتوقيت بغداد
            var today = IraqTime.FromUtc(DateTime.UtcNow).Date;
            var weekStart = today.AddDays(-(int)today.DayOfWeek);
            var monthStart = new DateTime(today.Year, today.Month, 1);
            static DateTime Day(DateTime utc) => IraqTime.FromUtc(utc).Date;

            var allOrders = await _context.SubOrders
                .Where(so => so.DriverId == driverId)
                .ToListAsync();

            // العدّ بالطلبات لا بأجزائها (طلب من متجرين = توصيلة واحدة)، مثل TotalDeliveries على السائق وتقرير العمليات
            int Orders(Func<SubOrder, bool> filter) => allOrders.Where(filter).Select(so => so.OrderId).Distinct().Count();
            var totalDeliveries = Orders(so => so.Status == OrderStatus.DELIVERED);
            var totalCancelled = Orders(so => so.Status == OrderStatus.CANCELLED);
            var total = totalDeliveries + totalCancelled;

            return new DriverStatsDto
            {
                DriverId = driver.Id,
                DriverName = driver.FullName,
                WorkStatus = driver.WorkStatus,
                Rating = driver.Rating,
                TotalDeliveries = totalDeliveries,
                TotalCancelled = totalCancelled,
                SuccessRate = total > 0 ? Math.Round((decimal)totalDeliveries / total * 100, 1) : 0,
                DeliveriesToday = Orders(so => so.Status == OrderStatus.DELIVERED && Day(so.UpdatedAt) == today),
                CancelledToday = Orders(so => so.Status == OrderStatus.CANCELLED && Day(so.UpdatedAt) == today),
                DeliveriesThisWeek = Orders(so => so.Status == OrderStatus.DELIVERED && Day(so.UpdatedAt) >= weekStart),
                DeliveriesThisMonth = Orders(so => so.Status == OrderStatus.DELIVERED && Day(so.UpdatedAt) >= monthStart),
                ActiveOrders = Orders(DriverTrip.IsOpen),
            };
        }
    }
}