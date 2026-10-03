using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InventoryService;
using ecommerce.Services.NotificationService;
using Microsoft.EntityFrameworkCore;

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
                throw new Exception("المتجر غير موجود");

            // الفترات بتوقيت بغداد (UTC+3، بلا توقيت صيفي) ومتداولة: اليوم، آخر 7 أيام، آخر 30 يوماً —
            // الأسبوع التقويمي كان يتجاوز الشهر التقويمي في أول أيام الشهر
            var now = DateTime.UtcNow;
            var todayStart = now.AddHours(BaghdadOffsetHours).Date.AddHours(-BaghdadOffsetHours);
            var weekStart = todayStart.AddDays(-6);
            var monthStart = todayStart.AddDays(-29);

            // ===================================
            // إحصائيات الطلبات
            // ===================================
            var subOrders = await _context.SubOrders
                .Include(so => so.Order)
                    .ThenInclude(o => o.Customer)
                .Where(so => so.VendorId == vendorId)
                .AsNoTracking()
                .ToListAsync();

            var totalOrders = subOrders.Count;
            var pendingOrders = subOrders.Count(so => so.Status == SubOrderStatus.PendingConfirmation);
            var activeOrders = subOrders.Count(so =>
                so.Status == SubOrderStatus.Confirmed ||
                so.Status == SubOrderStatus.Preparing ||
                so.Status == SubOrderStatus.Ready ||
                so.Status == SubOrderStatus.OutForDelivery);
            var completedOrders = subOrders.Count(so => so.Status == SubOrderStatus.Delivered);
            var cancelledOrders = subOrders.Count(so => so.Status == SubOrderStatus.Cancelled);

            // ===================================
            // إحصائيات المبيعات
            // ===================================
            var completedSubOrders = subOrders.Where(so => so.Status == SubOrderStatus.Delivered).ToList();

            var totalRevenue = completedSubOrders.Sum(so => so.Subtotal);
            var revenueToday = completedSubOrders.Where(so => so.UpdatedAt >= todayStart).Sum(so => so.Subtotal);
            var revenueThisWeek = completedSubOrders.Where(so => so.UpdatedAt >= weekStart).Sum(so => so.Subtotal);
            var revenueThisMonth = completedSubOrders.Where(so => so.UpdatedAt >= monthStart).Sum(so => so.Subtotal);

            // ===================================
            // إحصائيات المنتجات
            // ===================================
            var products = await _context.Products
                .Where(p => p.VendorId == vendorId && !p.IsDeleted)
                .AsNoTracking()
                .ToListAsync();

            var totalProducts = products.Count;
            var activeProducts = products.Count(p => p.IsActive && p.IsAvailable);
            var outOfStockProducts = products.Count(p => p.StockQuantity == 0);
            var lowStockProducts = products.Count(p => p.StockQuantity > 0 && p.StockQuantity < StockThresholds.LowStock);

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
            var recentOrders = subOrders
                .OrderBy(so => finalStatuses.Contains(so.Status) ? 1 : 0)
                .ThenByDescending(so => so.CreatedAt)
                .Take(5)
                .Select(so => new VendorRecentOrderDto
                {
                    SubOrderId = so.Id,
                    SubOrderNumber = so.SubOrderNumber,
                    CustomerName = so.Order?.Customer?.FullName ?? string.Empty,
                    Subtotal = so.Subtotal,
                    Status = so.Status,
                    CreatedAt = so.CreatedAt
                }).ToList();

            // ===================================
            // أكثر 5 منتجات مبيعاً
            // ===================================
            var topProducts = await _context.SubOrderItems
                .Include(i => i.Product)
                    .ThenInclude(p => p.Images)
                .Where(i => i.SubOrder.VendorId == vendorId &&
                            i.SubOrder.Status == SubOrderStatus.Delivered)
                .GroupBy(i => new { i.ProductId, i.ProductName, i.ProductNameAr, i.UnitPrice })
                .Select(g => new VendorTopProductDto
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.ProductName,
                    ProductNameAr = g.Key.ProductNameAr,
                    TotalSold = g.Sum(i => i.Quantity),
                    TotalRevenue = g.Sum(i => i.Subtotal),
                    Price = g.Key.UnitPrice
                })
                .OrderByDescending(p => p.TotalSold)
                .Take(5)
                .AsNoTracking()
                .ToListAsync();

            // إضافة صورة المنتج
            foreach (var tp in topProducts)
            {
                var img = await _context.Products
                    .Include(p => p.Images)
                    .Where(p => p.Id == tp.ProductId)
                    .Select(p => new
                    {
                        Stock = p.StockQuantity,
                        Image = p.Images.FirstOrDefault(i => i.IsPrimary) != null
                            ? p.Images.FirstOrDefault(i => i.IsPrimary).ImageUrl
                            : p.Images.FirstOrDefault() != null
                                ? p.Images.FirstOrDefault().ImageUrl
                                : null
                    })
                    .AsNoTracking()
                    .FirstOrDefaultAsync();

                tp.ImageUrl = img?.Image;
                tp.StockQuantity = img?.Stock ?? 0;
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
        public async Task<VendorSalesStatsDto> GetSalesStatsAsync(Guid vendorId, string period = "month")
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);
            if (vendor == null)
                throw new Exception("المتجر غير موجود");

            var now = DateTime.UtcNow;
            DateTime startDate;
            int days;

            switch (period.ToLower())
            {
                case "today":
                    startDate = now.Date;
                    days = 1;
                    break;
                case "week":
                    startDate = now.Date.AddDays(-6);
                    days = 7;
                    break;
                case "year":
                    startDate = new DateTime(now.Year, 1, 1);
                    days = (int)(now.Date - startDate).TotalDays + 1;
                    break;
                default: // month
                    startDate = new DateTime(now.Year, now.Month, 1);
                    days = (int)(now.Date - startDate).TotalDays + 1;
                    break;
            }

            var subOrders = await _context.SubOrders
                .Where(so =>
                    so.VendorId == vendorId &&
                    so.Status == SubOrderStatus.Delivered &&
                    so.UpdatedAt >= startDate)
                .AsNoTracking()
                .ToListAsync();

            var totalRevenue = subOrders.Sum(so => so.Subtotal);
            var totalOrders = subOrders.Count;
            var avgOrderValue = totalOrders > 0 ? Math.Round(totalRevenue / totalOrders, 2) : 0;

            // مبيعات يومية
            var salesByDay = Enumerable.Range(0, days)
                .Select(d => startDate.AddDays(d))
                .Select(date => new VendorSalesByDayDto
                {
                    Date = date,
                    Revenue = subOrders
                        .Where(so => so.UpdatedAt.Date == date)
                        .Sum(so => so.Subtotal),
                    OrderCount = subOrders
                        .Count(so => so.UpdatedAt.Date == date)
                })
                .ToList();

            return new VendorSalesStatsDto
            {
                Period = period,
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                AverageOrderValue = avgOrderValue,
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
            int pageSize = 20)
        {
            var vendor = await _context.Vendors.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);
            if (vendor == null)
                throw new Exception("المتجر غير موجود");

            var query = _context.SubOrders
                .Include(so => so.Order)
                    .ThenInclude(o => o.Customer)
                .Include(so => so.Order)
                    .ThenInclude(o => o.Address)
                .Include(so => so.Items)
                .Where(so => so.VendorId == vendorId)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(so => so.Status == status);

            var totalCount = await query.CountAsync();

            var subOrders = await query
                .OrderByDescending(so => so.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var dtos = subOrders.Select(MapToVendorOrderDto).ToList();

            return new PagedResponse<VendorOrderDto>(dtos, totalCount, pageNumber, pageSize);
        }

        // ===================================
        // GetOrderByIdAsync
        // ===================================
        public async Task<VendorOrderDto> GetOrderByIdAsync(Guid vendorId, Guid subOrderId)
        {
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                    .ThenInclude(o => o.Customer)
                .Include(so => so.Order)
                    .ThenInclude(o => o.Address)
                .Include(so => so.Items)
                .AsNoTracking()
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new Exception("الطلب غير موجود");

            return MapToVendorOrderDto(subOrder);
        }

        // ===================================
        // ConfirmOrderAsync
        // ===================================
        public async Task<VendorOrderDto> ConfirmOrderAsync(Guid vendorId, Guid subOrderId, Guid opsUserId)
        {
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new Exception("الطلب غير موجود");

            if (subOrder.Status != SubOrderStatus.PendingConfirmation)
                throw new Exception($"لا يمكن تأكيد الطلب وهو «{OrderStatusText.Ar(subOrder.Status)}»");

            var oldStatus = subOrder.Status;

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
                Notes = "تأكيد الطلب من لوحة البائع"
            };

            await _context.OrderStatusLogs.AddAsync(log);

            var parent = await RollUpOrderAsync(subOrder, opsUserId, "تأكيد المتجر");
            await _context.SaveChangesAsync();
            await NotifyAsync(subOrder, SubOrderStatus.Confirmed, parent, pushToOps: false);

            return await GetOrderByIdAsync(vendorId, subOrderId);
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
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId)
                ?? throw new Exception("الطلب غير موجود");

            if (subOrder.Status == to) return await GetOrderByIdAsync(vendorId, subOrderId);   // ضغطة مكررة
            if (subOrder.Status != from)
                throw new Exception($"لا يمكن تحويل الطلب إلى «{OrderStatusText.Ar(to)}» وهو «{OrderStatusText.Ar(subOrder.Status)}»");

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
            var subOrder = await _context.SubOrders
                .Include(so => so.Order)
                .FirstOrDefaultAsync(so => so.Id == subOrderId && so.VendorId == vendorId);

            if (subOrder == null)
                throw new Exception("الطلب غير موجود");

            if (subOrder.Status != SubOrderStatus.PendingConfirmation)
                throw new Exception($"لا يمكن رفض الطلب وهو «{OrderStatusText.Ar(subOrder.Status)}»");

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
            if (subOrder.Order.Status == OrderStatus.CANCELLED && _loyalty != null)
                await _loyalty.CancelRedemptionAsync(subOrder.OrderId);
            await NotifyAsync(subOrder, SubOrderStatus.Cancelled, parent, pushToOps: false);

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
                throw new Exception("المتجر غير موجود");

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
            var sales = await _context.SubOrderItems
                .Where(i => ids.Contains(i.ProductId) && i.SubOrder.Status == SubOrderStatus.Delivered)
                .GroupBy(i => i.ProductId)
                .Select(g => new { ProductId = g.Key, Sold = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.Subtotal) })
                .ToDictionaryAsync(x => x.ProductId);
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
                SubOrderNumber = so.SubOrderNumber,
                OrderNumber = so.Order?.OrderNumber ?? string.Empty,
                CustomerName = so.Order?.Customer?.FullName ?? string.Empty,
                CustomerPhone = so.Order?.Customer?.Phone ?? string.Empty,
                DeliveryAddress = deliveryAddress,
                Subtotal = so.Subtotal,
                DeliveryFee = so.DeliveryFee,
                Status = so.Status,
                CancellationReason = so.CancellationReason,
                ConfirmationDeadline = so.ConfirmationDeadline,
                MinutesRemaining = so.ConfirmationDeadline.HasValue
                    ? (int)Math.Max(0, (so.ConfirmationDeadline.Value - DateTime.UtcNow).TotalMinutes)
                    : null,
                Items = so.Items?.Select(i => new VendorOrderItemDto
                {
                    ProductId = i.ProductId,
                    ProductName = i.ProductName,
                    ProductNameAr = i.ProductNameAr,
                    ProductImageUrl = i.ProductImageUrl,
                    UnitPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                    Subtotal = i.Subtotal
                }).ToList() ?? new(),
                CreatedAt = so.CreatedAt
            };
        }
    }
}
