using ecommerce.Core.Constants;
using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.InventoryService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services
{
    public class VendorDashboardService : IVendorDashboardService
    {
        private readonly AppDbContext _context;
        private readonly IInventoryService _inventoryService;

        public VendorDashboardService(AppDbContext context, IInventoryService inventoryService)
        {
            _context = context;
            _inventoryService = inventoryService;
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

            var now = DateTime.UtcNow;
            var todayStart = now.Date;
            var weekStart = todayStart.AddDays(-(int)todayStart.DayOfWeek);
            var monthStart = new DateTime(now.Year, now.Month, 1);

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
                .Where(p => p.VendorId == vendorId)
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
            var recentOrders = subOrders
                .OrderByDescending(so => so.CreatedAt)
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

            // تحديث حالة الطلب الرئيسي إذا كانت كل الطلبات الفرعية مؤكدة
            var allSubOrders = await _context.SubOrders
                .Where(so => so.OrderId == subOrder.OrderId)
                .ToListAsync();

            if (allSubOrders.All(so => so.Status == SubOrderStatus.Confirmed || so.Id == subOrderId))
            {
                subOrder.Order.Status = OrderStatus.CONFIRMED;
                subOrder.Order.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return await GetOrderByIdAsync(vendorId, subOrderId);
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

            // إذا كانت كل الطلبات الفرعية ملغاة → الطلب الرئيسي ملغى
            var allSubOrders = await _context.SubOrders
                .Where(so => so.OrderId == subOrder.OrderId)
                .ToListAsync();

            if (allSubOrders.All(so => so.Status == SubOrderStatus.Cancelled || so.Id == subOrderId))
            {
                subOrder.Order.Status = OrderStatus.CANCELLED;
                subOrder.Order.CancellationReason = reason;
                subOrder.Order.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

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
                .CountAsync(p => p.VendorId == vendorId);

            var products = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.Reviews)
                .Include(p => p.SubOrderItems)
                    .ThenInclude(i => i.SubOrder)
                .Where(p => p.VendorId == vendorId)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var dtos = products.Select(p =>
            {
                var approvedReviews = p.Reviews?.Where(r => r.IsApproved).ToList() ?? new();
                var deliveredItems = p.SubOrderItems?
                    .Where(i => i.SubOrder?.Status == SubOrderStatus.Delivered).ToList() ?? new();
                var primaryImage = p.Images?.FirstOrDefault(i => i.IsPrimary)?.ImageUrl
                                     ?? p.Images?.FirstOrDefault()?.ImageUrl;

                return new VendorProductStatsDto
                {
                    ProductId = p.Id,
                    Name = p.Name,
                    NameAr = p.NameAr,
                    ImageUrl = primaryImage,
                    Price = p.Price,
                    StockQuantity = p.StockQuantity,
                    IsAvailable = p.IsAvailable,
                    IsActive = p.IsActive,
                    TotalSold = deliveredItems.Sum(i => i.Quantity),
                    TotalRevenue = deliveredItems.Sum(i => i.Subtotal),
                    AverageRating = approvedReviews.Any()
                        ? Math.Round((decimal)approvedReviews.Average(r => r.Rating), 1)
                        : null,
                    ReviewCount = approvedReviews.Count
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
