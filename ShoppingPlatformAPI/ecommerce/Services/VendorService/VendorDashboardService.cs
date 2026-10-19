using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.FinanceService;
using ecommerce.Core.DTO.Inventory;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;
using ecommerce.Core.Exceptions;

namespace ecommerce.Services
{
    public class VendorDashboardService : IVendorDashboardService
    {
        private const int BaghdadOffsetHours = 3;

        private readonly AppDbContext _context;
        private readonly IInventoryService _inventoryService;
        private readonly INotificationService? _notifications;
        private readonly ILoyaltyService? _loyalty;

        public VendorDashboardService(AppDbContext context, IInventoryService inventoryService, INotificationService? notifications = null,
            ILoyaltyService? loyalty = null)
        {
            _loyalty = loyalty;
            _context = context;
            _inventoryService = inventoryService;
            _notifications = notifications;
        }

        // ===================================
        // GetDashboardAsync
        // ===================================
        public async Task<VendorDashboardDto> GetDashboardAsync(Guid vendorId)
        {
            var vendor = await _context.Vendors
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);

            if (vendor == null)
                throw new NotFoundException("المتجر غير موجود");

            // الفترات بتوقيت بغداد (UTC+3، بلا توقيت صيفي) ومتداولة: اليوم، آخر 7 أيام، آخر 30 يوماً —
            // الأسبوع التقويمي كان يتجاوز الشهر التقويمي في أول أيام الشهر
            var now = DateTime.UtcNow;
            var todayStart = now.AddHours(BaghdadOffsetHours).Date.AddHours(-BaghdadOffsetHours);
            var weekStart = todayStart.AddDays(-6);
            var monthStart = todayStart.AddDays(-29);

            // ===================================
            // إحصائيات الطلبات
            // ===================================
            var statusCounts = await CountByStatusAsync(vendorId);
            int Count(string status) => statusCounts.GetValueOrDefault(status);

            var totalOrders = statusCounts.Values.Sum();
            var pendingOrders = Count(SubOrderStatus.PendingConfirmation);
            var activeOrders = Count(SubOrderStatus.Confirmed) + Count(SubOrderStatus.Preparing)
                + Count(SubOrderStatus.Ready) + Count(SubOrderStatus.OutForDelivery);
            var completedOrders = Count(SubOrderStatus.Delivered);
            var cancelledOrders = Count(SubOrderStatus.Cancelled);

            // ===================================
            // إحصائيات المبيعات — من دفتر المتجر (نفس أساس «أرباحي») وبتاريخ التسليم الفعلي
            // ===================================
            var totalRevenue = await SalesEntries(vendorId).SumAsync(e => e.Amount);
            var recentSales = await SalesEntries(vendorId)
                .Where(e => e.CreatedAt >= monthStart)
                .Select(e => new { e.Amount, e.CreatedAt })
                .ToListAsync();
            var revenueToday = recentSales.Where(e => e.CreatedAt >= todayStart).Sum(e => e.Amount);
            var revenueThisWeek = recentSales.Where(e => e.CreatedAt >= weekStart).Sum(e => e.Amount);
            var revenueThisMonth = recentSales.Sum(e => e.Amount);

            // ===================================
            // إحصائيات المنتجات
            // ===================================
            var products = await _context.Products
                .Where(p => p.VendorId == vendorId && !p.IsDeleted)
                .AsNoTracking()
                .ToListAsync();

            var variantStock = await VariantStockAsync(products.Select(p => p.Id));
            int StockOf(Product p) => variantStock.TryGetValue(p.Id, out var s) ? s : p.StockQuantity;
            bool AvailableOf(Product p) => variantStock.ContainsKey(p.Id) ? StockOf(p) > 0 : p.IsAvailable;

            var totalProducts = products.Count;
            var activeProducts = products.Count(p => p.IsActive && AvailableOf(p));
            var outOfStockProducts = products.Count(p => StockOf(p) == 0);
            var lowStockProducts = products.Count(p => StockOf(p) > 0 && StockOf(p) < StockThresholds.LowStock);

            // ===================================
            // إحصائيات التقييمات
            // ===================================
            var reviews = await _context.Reviews
                .Where(r => r.Product.VendorId == vendorId)
                .AsNoTracking()
                .ToListAsync();

            var totalReviews = reviews.Count(r => r.IsApproved);
            var pendingReviews = reviews.Count(r => !r.IsApproved);
            var avgRating = reviews.Any(r => r.IsApproved)
                ? Math.Round((decimal)reviews.Where(r => r.IsApproved).Average(r => r.Rating), 1)
                : (decimal?)null;

            // ===================================
            // أحدث 5 طلبات
            // ===================================
            // النشطة أولاً (تحتاج متابعة) ثم الأحدث من المكتملة — حتى لا يختفي طلب نشط أقدم من آخر 5 طلبات
            var finalStatuses = new[] { SubOrderStatus.Delivered, SubOrderStatus.Cancelled, SubOrderStatus.DeliveryFailed };
            var recentOrders = await _context.SubOrders.AsNoTracking()
                .Where(so => so.VendorId == vendorId)
                .OrderBy(so => finalStatuses.Contains(so.Status) ? 1 : 0)
                .ThenByDescending(so => so.CreatedAt)
                .Take(5)
                .Select(so => new VendorRecentOrderDto
                {
                    SubOrderId = so.Id,
                    SubOrderNumber = so.SubOrderNumber,
                    CustomerName = so.Order.Customer.FullName ?? string.Empty,
                    Subtotal = so.Subtotal,
                    Status = so.Status,
                    CreatedAt = so.CreatedAt
                }).ToListAsync();

            // ===================================
            // أكثر 5 منتجات مبيعاً
            // ===================================
            // كان التجميع بالمنتج والسعر معاً، فالمنتج المبيع بسعرين (عرض، متغيرات) يتكرر ويتوزع مبيعه
            var topProducts = await _context.SubOrderItems.AsNoTracking()
                .Where(i => i.SubOrder.VendorId == vendorId &&
                            i.SubOrder.Status == SubOrderStatus.Delivered &&
                            i.Quantity > i.RefusedQuantity)
                .GroupBy(i => i.ProductId)
                .Select(g => new VendorTopProductDto
                {
                    ProductId = g.Key,
                    ProductName = g.Max(i => i.ProductName),
                    ProductNameAr = g.Max(i => i.ProductNameAr),
                    TotalSold = g.Sum(i => i.Quantity - i.RefusedQuantity),
                    TotalRevenue = g.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity)),
                })
                .ToListAsync();
            // ناقص ما أُرجع بعد الاستلام (نفس حساب صفحة مبيعات المنتجات)
            var sales = (await GetProductSalesAsync(vendorId)).ToDictionary(s => s.ProductId);
            foreach (var tp in topProducts)
                if (sales.TryGetValue(tp.ProductId, out var s)) { tp.TotalSold = s.Sold; tp.TotalRevenue = s.Revenue; }
            topProducts = topProducts.Where(p => p.TotalSold > 0).OrderByDescending(p => p.TotalSold).Take(5).ToList();

            // السعر الحالي والصورة والمخزون (استعلام واحد للخمسة)
            var topIds = topProducts.Select(p => p.ProductId).ToList();
            var topInfo = await _context.Products.AsNoTracking()
                .Where(p => topIds.Contains(p.Id))
                .Select(p => new
                {
                    p.Id,
                    p.Price,
                    p.StockQuantity,
                    Image = p.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.ImageUrl).FirstOrDefault()
                })
                .ToDictionaryAsync(p => p.Id);
            var topVariantStock = await VariantStockAsync(topIds);
            foreach (var tp in topProducts)
            {
                if (!topInfo.TryGetValue(tp.ProductId, out var info)) continue;
                tp.Price = info.Price;
                tp.ImageUrl = info.Image;
                tp.StockQuantity = topVariantStock.TryGetValue(tp.ProductId, out var vs) ? vs : info.StockQuantity;
            }

            return new VendorDashboardDto
            {
                VendorId = vendor.Id,
                VendorName = vendor.Name,
                LogoUrl = vendor.LogoUrl,
                TotalOrders = totalOrders,
                PendingOrders = pendingOrders,
                ActiveOrders = activeOrders,
                CompletedOrders = completedOrders,
                CancelledOrders = cancelledOrders,
                TotalRevenue = totalRevenue,
                RevenueToday = revenueToday,
                RevenueThisWeek = revenueThisWeek,
                RevenueThisMonth = revenueThisMonth,
                TotalProducts = totalProducts,
                ActiveProducts = activeProducts,
                OutOfStockProducts = outOfStockProducts,
                LowStockProducts = lowStockProducts,
                AverageRating = avgRating,
                TotalReviews = totalReviews,
                PendingReviews = pendingReviews,
                RecentOrders = recentOrders,
                TopProducts = topProducts
            };
        }

        // ===================================
        // GetSalesStatsAsync
        // ===================================
        public async Task<VendorSalesStatsDto> GetSalesStatsAsync(Guid vendorId, string period = "month",
            DateTime? from = null, DateTime? to = null)
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);
            if (vendor == null)
                throw new NotFoundException("المتجر غير موجود");

            // الأيام بتوقيت بغداد: اليوم، آخر 7 أيام، الشهر الحالي، السنة الحالية
            var localToday = DateTime.UtcNow.AddHours(BaghdadOffsetHours).Date;
            DateTime startDate, endDate = localToday;
            if (period.ToLower() == "custom")
            {
                if (from == null || to == null)
                    throw new BusinessRuleException("اختر تاريخ البداية والنهاية");
                startDate = from.Value.Date;
                endDate = to.Value.Date;
                if (startDate > endDate) throw new BusinessRuleException("تاريخ البداية بعد تاريخ النهاية");
                if ((endDate - startDate).Days > 366) throw new BusinessRuleException("الفترة المخصصة سنة واحدة كحد أقصى");
            }
            else
            {
                startDate = period.ToLower() switch
                {
                    "today" => localToday,
                    "week" => localToday.AddDays(-6),
                    "year" => new DateTime(localToday.Year, 1, 1),
                    _ => new DateTime(localToday.Year, localToday.Month, 1),
                };
            }
            var days = (endDate - startDate).Days + 1;
            var startUtc = startDate.AddHours(-BaghdadOffsetHours);
            var endUtc = endDate.AddDays(1).AddHours(-BaghdadOffsetHours);

            // الفترة السابقة بنفس عدد الأيام — للمقارنة (+12% عن الفترة السابقة)
            var previousStartUtc = startUtc.AddDays(-days);
            var previous = await SalesEntries(vendorId)
                .Where(e => e.CreatedAt >= previousStartUtc && e.CreatedAt < startUtc)
                .Select(e => new { e.Type, e.Amount, e.SubOrderId })
                .ToListAsync();

            // صافي المبيعات من الدفتر: المسلَّم دون المرفوض عند الباب، ناقص المرتجعات — بتاريخ حدوثها
            var entries = await SalesEntries(vendorId)
                .Where(e => e.CreatedAt >= startUtc && e.CreatedAt < endUtc)
                .Select(e => new { e.Type, e.Amount, e.SubOrderId, Day = e.CreatedAt.AddHours(BaghdadOffsetHours).Date })
                .ToListAsync();

            var totalRevenue = entries.Sum(e => e.Amount);
            var totalOrders = entries.Where(e => e.Type == LedgerType.Sale).Select(e => e.SubOrderId).Distinct().Count();
            var avgOrderValue = totalOrders > 0 ? Math.Round(totalRevenue / totalOrders, 2) : 0;

            // مبيعات يومية
            var salesByDay = Enumerable.Range(0, days)
                .Select(d => startDate.AddDays(d))
                .Select(date => new VendorSalesByDayDto
                {
                    Date = date,
                    Revenue = entries.Where(e => e.Day == date).Sum(e => e.Amount),
                    OrderCount = entries.Count(e => e.Day == date && e.Type == LedgerType.Sale)
                })
                .ToList();

            return new VendorSalesStatsDto
            {
                Period = period,
                From = startDate,
                To = endDate,
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                AverageOrderValue = avgOrderValue,
                PreviousRevenue = previous.Sum(e => e.Amount),
                PreviousOrders = previous.Where(e => e.Type == LedgerType.Sale).Select(e => e.SubOrderId).Distinct().Count(),
                SalesByDay = salesByDay
            };
        }

        // ===================================
        // GetOrdersAsync
        // ===================================
        public async Task<PagedResponse<VendorOrderDto>> GetOrdersAsync(
            Guid vendorId,
            string? status = null,
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null)
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);
            if (vendor == null)
                throw new NotFoundException("المتجر غير موجود");

            var query = WithOrderDetails(_context.SubOrders)
                .Where(so => so.VendorId == vendorId);

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(so => so.Status == status);

            // البحث في كل الطلبات (لا الصفحة المعروضة فقط): رقم الطلب، اسم الزبون أو هاتفه
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(so =>
                    so.SubOrderNumber.Contains(s) ||
                    so.Order.OrderNumber.Contains(s) ||
                    so.Order.Customer.FullName.Contains(s) ||
                    (so.Order.Customer.Phone != null && so.Order.Customer.Phone.Contains(s)));
            }

            var totalCount = await query.CountAsync();

            var subOrders = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .AsSplitQuery()
                .ToListAsync();

            var dtos = subOrders.Select(MapToVendorOrderDto).ToList();
            await AttachReturnsAsync(vendorId, dtos);

            return new PagedResponse<VendorOrderDto>(dtos, totalCount, pageNumber, pageSize);
        }

        // ===================================
        // GetOrderByIdAsync
        // ===================================
        public async Task<VendorOrderDto> GetOrderByIdAsync(Guid vendorId, Guid subOrderId)
        {
            var subOrder = await WithOrderDetails(_context.SubOrders)
                .AsNoTracking()
                .AsSplitQuery()
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new NotFoundException("الطلب غير موجود");

            var dto = MapToVendorOrderDto(subOrder);
            await AttachReturnsAsync(vendorId, new List<VendorOrderDto> { dto });
            return dto;
        }

        // الإرجاعات بعد الاستلام لقطع هذا المتجر: الكمية لكل قطعة + ملخص كل إرجاع.
        // (الرفض عند الباب يظهر في RefusedQuantity، وسجله هنا كإرجاع «عند الباب»)
        private async Task AttachReturnsAsync(Guid vendorId, List<VendorOrderDto> orders)
        {
            if (orders.Count == 0) return;
            var orderIds = orders.Select(o => o.OrderId).Distinct().ToList();

            var returns = await _context.Returns.AsNoTracking()
                .Where(r => orderIds.Contains(r.OrderId) && r.Items.Any(i => i.Product.VendorId == vendorId))
                .Select(r => new
                {
                    r.Id, r.OrderId, r.ReturnNumber, r.Status, r.Reason, r.Details, r.IsDoorRefusal, r.CreatedAt,
                    Items = r.Items.Where(i => i.Product.VendorId == vendorId)
                        .Select(i => new { i.ProductId, i.VariantId, i.Quantity, i.ProductName }).ToList()
                })
                .ToListAsync();
            if (returns.Count == 0) return;

            foreach (var order in orders)
            {
                var mine = returns.Where(r => r.OrderId == order.OrderId).OrderBy(r => r.CreatedAt).ToList();
                order.Returns = mine.Select(r => new VendorOrderReturnDto
                {
                    Id = r.Id, ReturnNumber = r.ReturnNumber, Status = r.Status, Reason = r.Reason,
                    Details = r.Details, IsDoorRefusal = r.IsDoorRefusal, CreatedAt = r.CreatedAt,
                    // ما يُرجَع من قطع هذا المتجر — يراه قبل الموافقة ليستعد لاستلامه
                    Items = r.Items.Select(i => new VendorOrderReturnItemDto { ProductName = i.ProductName, Quantity = i.Quantity }).ToList(),
                }).ToList();

                var accepted = mine.Where(r => !r.IsDoorRefusal && (r.Status == ReturnStatus.APPROVED || r.Status == ReturnStatus.COMPLETED));
                foreach (var item in order.Items)
                    item.ReturnedQuantity = accepted.SelectMany(r => r.Items)
                        .Where(i => i.ProductId == item.ProductId && i.VariantId == item.VariantId)
                        .Sum(i => i.Quantity);
            }
        }

        // ===================================
        // ConfirmOrderAsync
        // ===================================
        public async Task<VendorOrderDto> ConfirmOrderAsync(Guid vendorId, Guid subOrderId, Guid opsUserId,
            IReadOnlyList<UnavailableItemDto>? unavailable = null)
        {
            await using var orderLock = await OrderLock.ForSubOrderAsync(_context, subOrderId);
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .Include(so => so.Items)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new NotFoundException("الطلب غير موجود");

            // سطر بكمية 0 أو أقل كان يُسقط بصمت فيصير القبول الجزئي قبولاً كاملاً
            if (unavailable?.Any(l => l.Quantity <= 0) == true)
                throw new BusinessRuleException("كمية القطعة غير المتوفرة يجب أن تكون 1 على الأقل");

            // ضغطة مكررة على «قبول» (الأولى نُفّذت قبلها) — لا سجل ولا إشعار ثانٍ
            if (subOrder.Status == SubOrderStatus.Confirmed && !(unavailable?.Any() ?? false))
                return await GetOrderByIdAsync(vendorId, subOrderId);
            if (subOrder.Status != SubOrderStatus.PendingConfirmation)
                throw new BusinessRuleException($"لا يمكن تأكيد الطلب وهو «{OrderStatusText.Ar(subOrder.Status)}»");

            var oldStatus = subOrder.Status;

            // القبول الجزئي: تُزال القطع غير المتوفرة من الطلب ويُعاد مخزونها، ويُعاد حساب مبلغ الطلب.
            // وإن اختار الزبون «استبدله بمشابه» يمكن للمتجر إضافة بديل من منتجاته (لا يدفع الزبون أكثر من الأصلي)
            var keptBefore = OrderTotals.Kept(subOrder);
            var removed = ApplyUnavailable(subOrder, unavailable);
            var replacements = await ApplyReplacementsAsync(subOrder, removed, unavailable);
            if (removed.Count > 0)
            {
                OrderTotals.ReducePointsForRemoved(subOrder, keptBefore);
                var siblings = await _context.SubOrders
                    .Where(so => so.OrderId == subOrder.OrderId && so.Id != subOrder.Id).ToListAsync();
                OrderTotals.Recalculate(subOrder.Order, siblings.Append(subOrder));
            }

            subOrder.Status = SubOrderStatus.Confirmed;
            subOrder.ConfirmedBy = opsUserId;
            subOrder.ConfirmedAt = DateTime.UtcNow;
            subOrder.UpdatedAt = DateTime.UtcNow;

            // تسجيل في السجل
            var log = new OrderStatusLog
            {
                SubOrderId = subOrder.Id,
                OldStatus = oldStatus,
                NewStatus = SubOrderStatus.Confirmed,
                ChangedBy = opsUserId,
                Notes = removed.Count == 0
                    ? "تأكيد الطلب من لوحة البائع"
                    : $"تأكيد جزئي من لوحة البائع — غير متوفر: {DescribeRemoved(removed)}" +
                      (replacements.Count > 0 ? $" — البدائل: {DescribeReplacements(replacements)}" : "")
            };

            await _context.OrderStatusLogs.AddAsync(log);

            var parent = await RollUpOrderAsync(subOrder, opsUserId, "تأكيد المتجر");

            // مخزون البدائل يُحجز قبل الحفظ (يفشل التأكيد كله إن نفد)، ويُعاد إن فشل الحفظ
            var replacementStock = replacements.Select(r => new StockLine(
                r.Replacement.ProductId, null, r.Replacement.Quantity, r.Replacement.ProductNameAr ?? r.Replacement.ProductName)).ToList();
            if (replacementStock.Count > 0) await _inventoryService.ReserveAsync(replacementStock);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch
            {
                if (replacementStock.Count > 0)
                    await _inventoryService.RestockAsync(replacementStock.Select(l => new StockLineQuantity(l.ProductId, null, l.Quantity)));
                throw;
            }

            if (removed.Count > 0)
            {
                await _inventoryService.RestockAsync(removed.Select(r =>
                    new StockLineQuantity(r.Item.ProductId, r.Item.VariantId, r.Quantity)));
                // نقاط القطع غير المتوفرة تعود لرصيد الزبون
                var pointsReturned = OrderTotals.UnusedPoints(subOrder.Order);
                if (_loyalty != null && pointsReturned > 0)
                    await _loyalty.RefundUnusedPointsAsync(subOrder.OrderId);
                await NotifyPartialAsync(subOrder, removed, replacements, _loyalty != null ? pointsReturned : 0);
            }
            await NotifyAsync(subOrder, SubOrderStatus.Confirmed, parent, pushToOps: false);

            return await GetOrderByIdAsync(vendorId, subOrderId);
        }

        private static List<(SubOrderItem Item, int Quantity)> ApplyUnavailable(SubOrder subOrder, IReadOnlyList<UnavailableItemDto>? unavailable)
        {
            var removed = new List<(SubOrderItem Item, int Quantity)>();
            foreach (var line in (unavailable ?? Array.Empty<UnavailableItemDto>()).Where(l => l.Quantity > 0)
                         .GroupBy(l => l.ItemId).Select(g => new { ItemId = g.Key, Quantity = g.Sum(l => l.Quantity) }))
            {
                var item = subOrder.Items.FirstOrDefault(i => i.Id == line.ItemId)
                    ?? throw new BusinessRuleException("قطعة غير موجودة في هذا الطلب");
                if (line.Quantity > item.Quantity)
                    throw new BusinessRuleException($"الكمية غير المتوفرة من «{item.ProductNameAr ?? item.ProductName}» أكبر من المطلوبة ({item.Quantity})");
                removed.Add((item, line.Quantity));
            }
            if (removed.Count == 0) return removed;

            if (subOrder.Items.Sum(i => i.Quantity) == removed.Sum(r => r.Quantity))
                throw new BusinessRuleException("كل القطع غير متوفرة — ارفض الطلب بدلاً من قبوله");

            foreach (var (item, qty) in removed)
            {
                item.Quantity -= qty;
                item.UnavailableQuantity += qty;
                item.Subtotal = item.UnitPrice * item.Quantity;
            }
            subOrder.Subtotal = subOrder.Items.Sum(i => i.Subtotal);
            return removed;
        }

        private static string DescribeRemoved(List<(SubOrderItem Item, int Quantity)> removed) =>
            string.Join("، ", removed.Select(r => $"{r.Item.ProductNameAr ?? r.Item.ProductName} ×{r.Quantity}"));

        private static string DescribeReplacements(List<(SubOrderItem Original, SubOrderItem Replacement)> replacements) =>
            string.Join("، ", replacements.Select(r =>
                $"{r.Replacement.ProductNameAr ?? r.Replacement.ProductName} بدل {r.Original.ProductNameAr ?? r.Original.ProductName}"));

        // البدائل: فقط إن اختار الزبون SIMILAR، منتج آخر من نفس المتجر بلا خيارات ومتوفر، بنفس الكمية،
        // وسعر الوحدة = الأقل بين سعر البديل وسعر الأصلي (الزبون لا يدفع أكثر مما وافق عليه)
        private async Task<List<(SubOrderItem Original, SubOrderItem Replacement)>> ApplyReplacementsAsync(
            SubOrder subOrder, List<(SubOrderItem Item, int Quantity)> removed, IReadOnlyList<UnavailableItemDto>? lines)
        {
            var result = new List<(SubOrderItem Original, SubOrderItem Replacement)>();
            var wanted = (lines ?? Array.Empty<UnavailableItemDto>())
                .Where(l => l.ReplacementProductId.HasValue && l.Quantity > 0)
                .GroupBy(l => l.ItemId)
                .ToDictionary(g => g.Key, g => g.First().ReplacementProductId!.Value);
            if (wanted.Count == 0) return result;

            if (subOrder.Order.SubstitutionPreference != SubstitutionPreference.Similar)
                throw new BusinessRuleException("الزبون اختار حذف المنتج غير المتوفر وإعادة المبلغ — لا يمكن إضافة بديل");

            foreach (var (item, qty) in removed)
            {
                if (!wanted.TryGetValue(item.Id, out var productId)) continue;
                var originalName = item.ProductNameAr ?? item.ProductName;
                if (productId == item.ProductId)
                    throw new BusinessRuleException($"البديل عن «{originalName}» يجب أن يكون منتجاً آخر");

                var product = await _context.Products.Include(p => p.Images)
                    .FirstOrDefaultAsync(p => p.Id == productId && p.VendorId == subOrder.VendorId && p.IsActive && !p.IsDeleted)
                    ?? throw new BusinessRuleException($"البديل عن «{originalName}» ليس من منتجات متجرك");
                var name = product.NameAr ?? product.Name;
                if (await _context.ProductVariants.AnyAsync(v => v.ProductId == productId))
                    throw new BusinessRuleException($"اختر بديلاً بلا خيارات (مقاس/لون) بدل «{name}»");
                if (!product.IsAvailable || product.StockQuantity < qty)
                    throw new BusinessRuleException($"لا يتوفر من «{name}» الكمية المطلوبة ({qty})");

                var unitPrice = Math.Min(product.Price, item.UnitPrice);
                var replacement = new SubOrderItem
                {
                    SubOrderId = subOrder.Id,
                    ProductId = product.Id,
                    ProductName = product.Name,
                    ProductNameAr = product.NameAr,
                    ProductImageUrl = product.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl ?? product.Images?.FirstOrDefault()?.ImageUrl ?? "",
                    UnitPrice = unitPrice,
                    Quantity = qty,
                    Subtotal = unitPrice * qty,
                    WeightStepKg = product.WeightStepKg,
                    ReplacesItemId = item.Id,
                };
                subOrder.Items.Add(replacement);
                _context.SubOrderItems.Add(replacement);
                result.Add((item, replacement));
            }

            subOrder.Subtotal = subOrder.Items.Sum(i => i.Subtotal);
            return result;
        }

        private async Task NotifyPartialAsync(SubOrder subOrder, List<(SubOrderItem Item, int Quantity)> removed,
            List<(SubOrderItem Original, SubOrderItem Replacement)> replacements, decimal pointsReturned = 0)
        {
            if (_notifications == null) return;
            try
            {
                var order = subOrder.Order;
                var replaced = replacements.Select(r => r.Original.Id).ToHashSet();
                var removedOnly = removed.Where(r => !replaced.Contains(r.Item.Id)).ToList();
                var message = replacements.Count == 0
                    ? $"بعض منتجات طلبك {order.OrderNumber} غير متوفرة ({DescribeRemoved(removed)}) — أُزيلت من الطلب وأصبح المبلغ {order.TotalAmount:N0} د.ع"
                    : $"بعض منتجات طلبك {order.OrderNumber} غير متوفرة — استُبدل {DescribeReplacements(replacements)}" +
                      (removedOnly.Count > 0 ? $"، وأُزيل ({DescribeRemoved(removedOnly)})" : "") +
                      $" — أصبح المبلغ {order.TotalAmount:N0} د.ع";
                message += OrderTotals.PointsReturnedNote(pointsReturned);
                await _notifications.NotifyCustomerOrderNoticeAsync(order.CustomerId, message,
                    new { orderId = order.Id, orderNumber = order.OrderNumber });
            }
            catch { /* الإشعار لا يُفشل القبول */ }
        }

        // ===================================
        // بدء التحضير ← جاهز للاستلام (المتجر؛ والعمليات تستطيع ذلك أيضاً من شاشتها)
        // ===================================
        public Task<VendorOrderDto> StartPreparingAsync(Guid vendorId, Guid subOrderId, Guid userId)
            => AdvanceAsync(vendorId, subOrderId, userId, OrderStatus.CONFIRMED, OrderStatus.PREPARING, "بدء التحضير من لوحة البائع");

        public Task<VendorOrderDto> MarkReadyAsync(Guid vendorId, Guid subOrderId, Guid userId)
            => AdvanceAsync(vendorId, subOrderId, userId, OrderStatus.PREPARING, OrderStatus.READY, "جاهز للاستلام من لوحة البائع");

        private async Task<VendorOrderDto> AdvanceAsync(Guid vendorId, Guid subOrderId, Guid userId, string from, string to, string note)
        {
            await using var orderLock = await OrderLock.ForSubOrderAsync(_context, subOrderId);
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId)
                ?? throw new NotFoundException("الطلب غير موجود");

            if (subOrder.Status == to) return await GetOrderByIdAsync(vendorId, subOrderId);   // ضغطة مكررة
            if (subOrder.Status != from)
                throw new BusinessRuleException($"لا يمكن تحويل الطلب إلى «{OrderStatusText.Ar(to)}» وهو «{OrderStatusText.Ar(subOrder.Status)}»");

            subOrder.Status = to;
            subOrder.UpdatedAt = DateTime.UtcNow;
            _context.OrderStatusLogs.Add(new OrderStatusLog
            {
                SubOrderId = subOrder.Id, OldStatus = from, NewStatus = to, ChangedBy = userId, Notes = note,
            });

            var parent = await RollUpOrderAsync(subOrder, userId, $"«{OrderStatusText.Ar(to)}» من المتجر");
            await _context.SaveChangesAsync();
            await NotifyAsync(subOrder, to, parent, pushToOps: true);

            return await GetOrderByIdAsync(vendorId, subOrderId);
        }

        // الطلب الرئيسي يتبع مجموع متاجره (مثلاً «جاهز» فقط حين تجهز كلها) — يُرجع (القديمة، الجديدة) إن تغيّرت
        private async Task<(string Old, string New)?> RollUpOrderAsync(SubOrder subOrder, Guid userId, string cause)
        {
            var order = subOrder.Order;
            var statuses = await _context.SubOrders.Where(so => so.OrderId == order.Id && so.Id != subOrder.Id)
                .Select(so => so.Status).ToListAsync();
            statuses.Add(subOrder.Status);
            var oldStatus = order.Status;
            var newStatus = OrderStatusRollup.Compute(statuses);
            if (newStatus == oldStatus) return null;

            order.Status = newStatus;
            order.UpdatedAt = DateTime.UtcNow;
            _context.OrderStatusLogs.Add(new OrderStatusLog
            {
                OrderId = order.Id, OldStatus = oldStatus, NewStatus = newStatus, ChangedBy = userId,
                Notes = $"تحديث تلقائي بعد {cause}",
            });
            if (newStatus == OrderStatus.CANCELLED)
                OrderTotals.SyncCancelled(order, await _context.SubOrders.Where(so => so.OrderId == order.Id).ToListAsync());
            return (oldStatus, newStatus);
        }

        // العمليات (تحديث الشاشات، وإشعار الهواتف عند «جاهز») + الزبون حين تتغير حالة طلبه
        private async Task NotifyAsync(SubOrder subOrder, string subStatus, (string Old, string New)? parent, bool pushToOps)
        {
            if (_notifications == null) return;
            try
            {
                var order = subOrder.Order;
                await _notifications.NotifySubOrderStatusChangedAsync(subOrder.Id, subOrder.SubOrderNumber, order.Id, subStatus, pushToOps);
                if (parent is { } p)
                {
                    await _notifications.NotifyOrderStatusChangedAsync(order.Id, p.Old, p.New, order.OrderNumber);
                    await _notifications.NotifyCustomerOrderStatusAsync(order.CustomerId, order.Id, order.OrderNumber, p.New);
                }
            }
            catch { /* الإشعار لا يُفشل تغيير الحالة */ }
        }

        // ===================================
        // RejectOrderAsync
        // ===================================
        public async Task<VendorOrderDto> RejectOrderAsync(
            Guid vendorId, Guid subOrderId, Guid opsUserId, string reason)
        {
            await using var orderLock = await OrderLock.ForSubOrderAsync(_context, subOrderId);
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new NotFoundException("الطلب غير موجود");

            if (subOrder.Status != SubOrderStatus.PendingConfirmation)
                throw new BusinessRuleException($"لا يمكن رفض الطلب وهو «{OrderStatusText.Ar(subOrder.Status)}»");

            var oldStatus = subOrder.Status;

            subOrder.Status = SubOrderStatus.Cancelled;
            subOrder.CancellationReason = reason;
            subOrder.CancelledBy = opsUserId;
            subOrder.CancelledAt = DateTime.UtcNow;
            subOrder.UpdatedAt = DateTime.UtcNow;

            var log = new OrderStatusLog
            {
                SubOrderId = subOrder.Id,
                OldStatus = oldStatus,
                NewStatus = SubOrderStatus.Cancelled,
                ChangedBy = opsUserId,
                Reason = reason,
                Notes = "رفض الطلب من لوحة البائع"
            };

            await _context.OrderStatusLogs.AddAsync(log);

            var parent = await RollUpOrderAsync(subOrder, opsUserId, "رفض المتجر");
            if (subOrder.Order.Status == OrderStatus.CANCELLED) subOrder.Order.CancellationReason = reason;
            // الزبون يدفع ثمن المتاجر الباقية فقط
            OrderTotals.Recalculate(subOrder.Order, await _context.SubOrders.Where(so => so.OrderId == subOrder.OrderId).ToListAsync());
            await _context.SaveChangesAsync();
            var pointsReturned = _loyalty != null && subOrder.Order.Status != OrderStatus.CANCELLED ? OrderTotals.UnusedPoints(subOrder.Order) : 0;
            if (subOrder.Order.Status == OrderStatus.CANCELLED && _loyalty != null)
                await _loyalty.CancelRedemptionAsync(subOrder.OrderId);
            else if (_loyalty != null)
                await _loyalty.RefundUnusedPointsAsync(subOrder.OrderId);
            await NotifyAsync(subOrder, SubOrderStatus.Cancelled, parent, pushToOps: false);
            // رفض متجر واحد من طلب متعدد المتاجر: الطلب مستمر، فيعرف الزبون ما سقط والمبلغ الجديد
            // (رفض الطلب كله يصله من تحديث حالة الطلب أعلاه)
            if (subOrder.Order.Status != OrderStatus.CANCELLED && _notifications != null)
            {
                try
                {
                    var vendorName = await _context.Vendors.Where(v => v.Id == vendorId).Select(v => v.NameAr ?? v.Name).FirstOrDefaultAsync();
                    await _notifications.NotifyCustomerOrderNoticeAsync(subOrder.Order.CustomerId,
                        $"اعتذر المتجر «{vendorName}» عن جزء من طلبك {subOrder.Order.OrderNumber}: {reason} — المبلغ الجديد {subOrder.Order.TotalAmount:N0} د.ع"
                        + OrderTotals.PointsReturnedNote(pointsReturned),
                        new { orderId = subOrder.OrderId, subOrderId = subOrder.Id });
                }
                catch { /* الإشعار لا يُفشل الرفض */ }
            }

            if (_notifications != null)
            {
                try
                {
                    var name = await _context.Vendors.Where(v => v.Id == vendorId).Select(v => v.NameAr ?? v.Name).FirstOrDefaultAsync();
                    await _notifications.NotifyOpsAsync(NotificationCategory.NewOrders, NotificationType.ORDER_STATUS,
                        $"اعتذر المتجر «{name}» عن الطلب {subOrder.SubOrderNumber}: {reason}", new { orderId = subOrder.OrderId, subOrderId = subOrder.Id });
                }
                catch { /* الإشعار لا يُفشل الرفض */ }
            }

            // إعادة مخزون بنود الطلب المرفوض
            await _inventoryService.RestoreForSubOrdersAsync(new[] { subOrderId });

            return await GetOrderByIdAsync(vendorId, subOrderId);
        }

        // ===================================
        // GetProductsWithStatsAsync
        // ===================================
        public async Task<PagedResponse<VendorProductStatsDto>> GetProductsWithStatsAsync(
            Guid vendorId,
            int pageNumber = 1,
            int pageSize = 20)
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);
            if (vendor == null)
                throw new NotFoundException("المتجر غير موجود");

            var totalCount = await _context.Products
                .CountAsync(p => p.VendorId == vendorId && !p.IsDeleted);

            var products = await _context.Products
                .Include(p => p.Images)
                .Where(p => p.VendorId == vendorId && !p.IsDeleted)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            // تجميعات في قاعدة البيانات لمنتجات الصفحة فقط (بدل تحميل كل عناصر الطلبات والمراجعات)
            var ids = products.Select(p => p.Id).ToList();
            // نفس حساب صفحة المبيعات: ناقص ما أُرجع بعد الاستلام
            var sales = (await GetProductSalesAsync(vendorId))
                .Where(s => ids.Contains(s.ProductId))
                .ToDictionary(s => s.ProductId);
            var ratings = await _context.Reviews
                .Where(r => ids.Contains(r.ProductId) && r.IsApproved)
                .GroupBy(r => r.ProductId)
                .Select(g => new { ProductId = g.Key, Average = g.Average(r => (double)r.Rating), Count = g.Count() })
                .ToDictionaryAsync(x => x.ProductId);
            var variantStock = await _context.ProductVariants
                .Where(v => ids.Contains(v.ProductId))
                .GroupBy(v => v.ProductId)
                .Select(g => new { ProductId = g.Key, Stock = g.Sum(v => v.IsAvailable ? v.StockQuantity : 0) })
                .ToDictionaryAsync(x => x.ProductId, x => x.Stock);

            var dtos = products.Select(p =>
            {
                sales.TryGetValue(p.Id, out var sale);
                ratings.TryGetValue(p.Id, out var rating);
                var hasVariants = variantStock.TryGetValue(p.Id, out var stockFromVariants);
                var primaryImage = p.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl
                                     ?? p.Images?.FirstOrDefault()?.ImageUrl;

                return new VendorProductStatsDto
                {
                    ProductId = p.Id,
                    Name = p.Name,
                    NameAr = p.NameAr,
                    ImageUrl = primaryImage,
                    Price = p.Price,
                    StockQuantity = hasVariants ? stockFromVariants : p.StockQuantity,
                    IsAvailable = hasVariants ? stockFromVariants > 0 : p.IsAvailable,
                    IsActive = p.IsActive,
                    TotalSold = sale?.Sold ?? 0,
                    TotalRevenue = sale?.Revenue ?? 0,
                    AverageRating = rating != null ? Math.Round((decimal)rating.Average, 1) : null,
                    ReviewCount = rating?.Count ?? 0
                };
            }).ToList();

            return new PagedResponse<VendorProductStatsDto>(dtos, totalCount, pageNumber, pageSize);
        }

        // ===================================
        // GetReviewsFeedAsync — كل تقييمات منتجات المتجر في قائمة واحدة (الأحدث أولاً)، مع فلتر «بلا رد»
        // ===================================
        public async Task<PagedResponse<VendorReviewFeedDto>> GetReviewsFeedAsync(
            Guid vendorId, bool unanswered = false, int? rating = null, int pageNumber = 1, int pageSize = 20)
        {
            var query = _context.Reviews.AsNoTracking()
                .Where(r => r.Product.VendorId == vendorId && r.IsApproved);
            if (unanswered) query = query.Where(r => r.VendorReply == null || r.VendorReply == "");
            if (rating is >= 1 and <= 5) query = query.Where(r => r.Rating == rating);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new VendorReviewFeedDto
                {
                    Id = r.Id,
                    ProductId = r.ProductId,
                    ProductName = r.Product.NameAr ?? r.Product.Name,
                    ProductImageUrl = r.Product.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                    CustomerName = r.User.FullName,
                    Rating = r.Rating,
                    Title = r.Title,
                    Body = r.Body,
                    IsVerifiedPurchase = r.IsVerifiedPurchase,
                    Images = r.Images.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).ToList(),
                    VendorReply = r.VendorReply,
                    VendorReplyAt = r.VendorReplyAt,
                    CreatedAt = r.CreatedAt,
                })
                .ToListAsync();
            return new PagedResponse<VendorReviewFeedDto>(items, total, pageNumber, pageSize);
        }

        public Task<int> CountUnansweredReviewsAsync(Guid vendorId) =>
            _context.Reviews.CountAsync(r => r.Product.VendorId == vendorId && r.IsApproved && (r.VendorReply == null || r.VendorReply == ""));

        // ===================================
        // GetProductSalesAsync — القطع المبيعة وقيمتها لكل منتج (دون المرفوض عند الباب، وناقص المُرجَع بعد الاستلام)
        // ===================================
        public async Task<List<VendorProductSalesDto>> GetProductSalesAsync(Guid vendorId)
        {
            var sales = await _context.SubOrderItems.AsNoTracking()
                .Where(i => i.SubOrder.VendorId == vendorId && i.SubOrder.Status == SubOrderStatus.Delivered)
                .GroupBy(i => i.ProductId)
                .Select(g => new VendorProductSalesDto
                {
                    ProductId = g.Key,
                    Sold = g.Sum(i => i.Quantity - i.RefusedQuantity),
                    Revenue = g.Sum(i => i.UnitPrice * (i.Quantity - i.RefusedQuantity)),
                })
                .ToListAsync();

            var returned = await _context.ReturnItems.AsNoTracking()
                .Where(ri => ri.Product.VendorId == vendorId && !ri.Return.IsDoorRefusal
                    && (ri.Return.Status == ReturnStatus.APPROVED || ri.Return.Status == ReturnStatus.COMPLETED))
                .GroupBy(ri => ri.ProductId)
                .Select(g => new { ProductId = g.Key, Quantity = g.Sum(ri => ri.Quantity), Value = g.Sum(ri => ri.UnitPrice * ri.Quantity) })
                .ToDictionaryAsync(x => x.ProductId);
            foreach (var s in sales)
                if (returned.TryGetValue(s.ProductId, out var r))
                {
                    s.Sold = Math.Max(0, s.Sold - r.Quantity);
                    s.Revenue = Math.Max(0, s.Revenue - r.Value);
                }
            return sales;
        }

        // ===================================
        // GetOrderCountsAsync — أعداد كل حالة وقيمة ما ينتظر القرار (بدل تحميل كل الطلبات في الواجهة)
        // ===================================
        public async Task<VendorOrderCountsDto> GetOrderCountsAsync(Guid vendorId)
        {
            var byStatus = await CountByStatusAsync(vendorId);
            var pendingValue = await _context.SubOrders.AsNoTracking()
                .Where(so => so.VendorId == vendorId && so.Status == SubOrderStatus.PendingConfirmation)
                .SumAsync(so => so.Subtotal);

            return new VendorOrderCountsDto
            {
                Total = byStatus.Values.Sum(),
                ByStatus = byStatus,
                PendingValue = pendingValue
            };
        }

        private Task<Dictionary<string, int>> CountByStatusAsync(Guid vendorId) =>
            _context.SubOrders.AsNoTracking()
                .Where(so => so.VendorId == vendorId)
                .GroupBy(so => so.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Status, x => x.Count);

        // صافي المبيعات في دفتر المتجر: قيمة القطع المسلَّمة (دون المرفوضة عند الباب) والمرتجعات المعتمدة بالسالب
        private IQueryable<VendorLedgerEntry> SalesEntries(Guid vendorId) =>
            _context.VendorLedgerEntries.AsNoTracking()
                .Where(e => e.VendorId == vendorId && (e.Type == LedgerType.Sale || e.Type == LedgerType.Return));

        // مخزون المنتجات ذات المتغيرات = مجموع المتغيرات المتوفرة (نفس قاعدة صفحة المنتجات)
        private Task<Dictionary<Guid, int>> VariantStockAsync(IEnumerable<Guid> productIds)
        {
            var ids = productIds.ToList();
            return _context.ProductVariants.AsNoTracking()
                .Where(v => ids.Contains(v.ProductId))
                .GroupBy(v => v.ProductId)
                .Select(g => new { ProductId = g.Key, Stock = g.Sum(v => v.IsAvailable ? v.StockQuantity : 0) })
                .ToDictionaryAsync(x => x.ProductId, x => x.Stock);
        }

        // الطلب مع الزبون والعنوان والقطع ومتغيراتها (المقاس/اللون)
        private static IQueryable<SubOrder> WithOrderDetails(IQueryable<SubOrder> query) =>
            query
                .Include(so => so.Order).ThenInclude(o => o.Customer)
                .Include(so => so.Order).ThenInclude(o => o.Address)
                .Include(so => so.Items).ThenInclude(i => i.Variant)
                    .ThenInclude(v => v!.AttributeValues).ThenInclude(av => av.AttributeValue).ThenInclude(av => av.Attribute);

        // «المقاس: L · اللون: أحمر»
        private static string? VariantLabel(ProductVariant? variant) =>
            variant?.AttributeValues is { Count: > 0 } values
                ? string.Join(" · ", values
                    .Where(v => v.AttributeValue?.Attribute != null)
                    .OrderBy(v => v.AttributeValue.Attribute.DisplayOrder)
                    .Select(v => $"{v.AttributeValue.Attribute.NameAr ?? v.AttributeValue.Attribute.Name}: {v.AttributeValue.ValueAr ?? v.AttributeValue.Value}"))
                : null;

        // ===================================
        // Private: MapToVendorOrderDto
        // ===================================
        private static VendorOrderDto MapToVendorOrderDto(SubOrder so)
        {
            var address = so.Order?.Address;
            var deliveryAddress = address != null
                ? $"{address.StreetAddress}, {address.Area}, {address.City}"
                : string.Empty;

            return new VendorOrderDto
            {
                SubOrderId = so.Id,
                OrderId = so.OrderId,
                SubOrderNumber = so.SubOrderNumber,
                OrderNumber = so.Order?.OrderNumber ?? string.Empty,
                CustomerNotes = string.IsNullOrWhiteSpace(so.Order?.CustomerNotes) ? null : so.Order.CustomerNotes.Trim(),
                DeliverySlotStart = so.Order?.DeliverySlotStart,
                DeliverySlotEnd = so.Order?.DeliverySlotEnd,
                SubstitutionPreference = so.Order?.SubstitutionPreference,
                CustomerName = so.Order?.Customer?.FullName ?? string.Empty,
                CustomerPhone = so.Order?.Customer?.Phone ?? string.Empty,
                DeliveryAddress = deliveryAddress,
                Subtotal = so.Subtotal,
                DeliveryFee = so.DeliveryFee,
                VendorDiscount = so.Order?.CouponVendorId == so.VendorId ? so.CouponShare : 0,
                PlatformDiscount = so.PointsShare + (so.Order?.CouponVendorId == so.VendorId ? 0 : so.CouponShare),
                CustomerPays = OrderTotals.DueFor(so),
                Status = so.Status,
                CancellationReason = so.CancellationReason,
                ConfirmationDeadline = so.ConfirmationDeadline,
                MinutesRemaining = so.ConfirmationDeadline.HasValue && so.Status == SubOrderStatus.PendingConfirmation
                    ? (int)Math.Max(0, (so.ConfirmationDeadline.Value - DateTime.UtcNow).TotalMinutes)
                    : null,
                Items = so.Items?.Select(i => new VendorOrderItemDto
                {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    ProductNameAr = i.ProductNameAr,
                    ProductImageUrl = i.ProductImageUrl,
                    VariantId = i.VariantId,
                    VariantSku = i.Variant?.Sku,
                    VariantLabel = VariantLabel(i.Variant),
                    RefusedQuantity = i.RefusedQuantity,
                    UnavailableQuantity = i.UnavailableQuantity,
                    WeightStepKg = i.WeightStepKg,
                    ReplacesItemId = i.ReplacesItemId,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    Subtotal = i.Subtotal
                }).ToList() ?? new(),
                CreatedAt = so.CreatedAt
            };
        }
    }
}
