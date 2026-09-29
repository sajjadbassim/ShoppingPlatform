using ecommerce.Core.Constants;
using ecommerce.Core.DTO.OrderRating;
using ecommerce.Core.Models;
using ecommerce.Data;
using ecommerce.Services.OrderRatingService;
using Microsoft.EntityFrameworkCore;

namespace ecommerce.Services.OrderRatingService
{
    public class OrderRatingService : IOrderRatingService
    {
        private readonly AppDbContext _context;

        public OrderRatingService(AppDbContext context)
        {
            _context = context;
        }

        // ===================================
        // CreateRatingAsync
        // ===================================
        public async Task<OrderRatingDto> CreateRatingAsync(Guid orderId, Guid customerId, CreateOrderRatingDto dto)
        {
            // التحقق من الطلب
            var order = await _context.Orders
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Vendor)
                .Include(o => o.SubOrders)
                    .ThenInclude(so => so.Driver)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                throw new Exception("الطلب غير موجود");

            if (order.CustomerId != customerId)
                throw new UnauthorizedAccessException("ليس لديك صلاحية لتقييم هذا الطلب");

            // الطلب يجب أن يكون مسلّماً
            if (order.Status != OrderStatus.DELIVERED)
                throw new Exception("يمكن تقييم الطلب فقط بعد الاستلام");

            // منع التقييم المتكرر
            var alreadyRated = await _context.OrderRatings
                .AnyAsync(r => r.OrderId == orderId && r.CustomerId == customerId);

            if (alreadyRated)
                throw new Exception("لقد قيّمت هذا الطلب مسبقاً");

            // التحقق من SubOrders المرسلة
            var subOrderIds = order.SubOrders.Select(so => so.Id).ToHashSet();
            foreach (var sub in dto.SubOrderRatings)
            {
                if (!subOrderIds.Contains(sub.SubOrderId))
                    throw new Exception($"الطلب الفرعي {sub.SubOrderId} لا ينتمي لهذا الطلب");
            }

            // إنشاء التقييم الرئيسي
            var rating = new OrderRating
            {
                OrderId = orderId,
                CustomerId = customerId,
                DeliveryRating = dto.DeliveryRating,
                DeliveryComment = dto.DeliveryComment,
                SpeedRating = dto.SpeedRating,
                PackagingRating = dto.PackagingRating,
                WouldRecommend = dto.WouldRecommend
            };

            await _context.OrderRatings.AddAsync(rating);
            await _context.SaveChangesAsync();

            // إنشاء تقييمات المتاجر
            foreach (var subDto in dto.SubOrderRatings)
            {
                var subOrder = order.SubOrders.First(so => so.Id == subDto.SubOrderId);

                var subRating = new SubOrderRating
                {
                    OrderRatingId = rating.Id,
                    SubOrderId = subDto.SubOrderId,
                    VendorId = subOrder.VendorId,
                    VendorRating = subDto.VendorRating,
                    VendorComment = subDto.VendorComment,
                    DriverRating = subDto.DriverRating,
                    DriverId = subOrder.DriverId
                };

                await _context.SubOrderRatings.AddAsync(subRating);
            }

            await _context.SaveChangesAsync();

            // جلب النتيجة كاملة
            return await GetRatingDtoAsync(rating.Id);
        }

        // ===================================
        // GetRatingByOrderIdAsync
        // ===================================
        public async Task<OrderRatingDto?> GetRatingByOrderIdAsync(Guid orderId, Guid customerId)
        {
            var rating = await _context.OrderRatings
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.CustomerId == customerId);

            if (rating == null) return null;

            return await GetRatingDtoAsync(rating.Id);
        }

        // ===================================
        // HasRatedAsync
        // ===================================
        public async Task<bool> HasRatedAsync(Guid orderId, Guid customerId)
        {
            return await _context.OrderRatings
                .AnyAsync(r => r.OrderId == orderId && r.CustomerId == customerId);
        }

        // ===================================
        // GetOverallStatsAsync
        // ===================================
        public async Task<RatingStatsDto> GetOverallStatsAsync()
        {
            var ratings = await _context.OrderRatings
                .Include(r => r.SubOrderRatings)
                .AsNoTracking()
                .ToListAsync();

            if (!ratings.Any())
                return new RatingStatsDto();

            var subRatings = ratings.SelectMany(r => r.SubOrderRatings).ToList();

            // توزيع تقييمات التوصيل
            var distribution = Enumerable.Range(1, 5)
                .ToDictionary(
                    star => star,
                    star => ratings.Count(r => r.DeliveryRating == star)
                );

            var recommendCount = ratings.Count(r => r.WouldRecommend == true);

            return new RatingStatsDto
            {
                TotalRatings = ratings.Count,
                AverageDeliveryRating = ratings.Average(r => r.DeliveryRating),
                AverageSpeedRating = ratings.Where(r => r.SpeedRating.HasValue).Any()
                                            ? ratings.Where(r => r.SpeedRating.HasValue).Average(r => r.SpeedRating!.Value)
                                            : 0,
                AveragePackagingRating = ratings.Where(r => r.PackagingRating.HasValue).Any()
                                            ? ratings.Where(r => r.PackagingRating.HasValue).Average(r => r.PackagingRating!.Value)
                                            : 0,
                AverageVendorRating = subRatings.Any()
                                            ? subRatings.Average(sr => sr.VendorRating)
                                            : 0,
                AverageDriverRating = subRatings.Where(sr => sr.DriverRating.HasValue).Any()
                                            ? subRatings.Where(sr => sr.DriverRating.HasValue).Average(sr => sr.DriverRating!.Value)
                                            : 0,
                RecommendCount = recommendCount,
                RecommendPercentage = ratings.Any(r => r.WouldRecommend.HasValue)
                                            ? Math.Round((double)recommendCount / ratings.Count(r => r.WouldRecommend.HasValue) * 100, 1)
                                            : 0,
                DeliveryRatingDistribution = distribution
            };
        }

        // ===================================
        // GetVendorStatsAsync
        // ===================================
        public async Task<VendorRatingStatsDto> GetVendorStatsAsync(Guid vendorId)
        {
            var vendor = await _context.Vendors
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == vendorId);

            if (vendor == null)
                throw new Exception("المتجر غير موجود");

            var subRatings = await _context.SubOrderRatings
                .Where(sr => sr.VendorId == vendorId)
                .AsNoTracking()
                .ToListAsync();

            var distribution = Enumerable.Range(1, 5)
                .ToDictionary(
                    star => star,
                    star => subRatings.Count(sr => sr.VendorRating == star)
                );

            return new VendorRatingStatsDto
            {
                VendorId = vendorId,
                VendorName = vendor.Name,
                AverageRating = subRatings.Any() ? Math.Round(subRatings.Average(sr => sr.VendorRating), 2) : 0,
                TotalRatings = subRatings.Count,
                Distribution = distribution
            };
        }

        // ===================================
        // GetDriverStatsAsync
        // ===================================
        public async Task<DriverRatingStatsDto> GetDriverStatsAsync(Guid driverId)
        {
            var driver = await _context.Drivers
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == driverId);

            if (driver == null)
                throw new Exception("السائق غير موجود");

            var ratings = await _context.SubOrderRatings
                .Where(sr => sr.DriverId == driverId && sr.DriverRating.HasValue)
                .AsNoTracking()
                .ToListAsync();

            return new DriverRatingStatsDto
            {
                DriverId = driverId,
                DriverName = driver.FullName,
                AverageRating = ratings.Any() ? Math.Round(ratings.Average(sr => sr.DriverRating!.Value), 2) : 0,
                TotalRatings = ratings.Count
            };
        }

        // ===================================
        // GetAllRatingsAsync
        // ===================================
        public async Task<List<OrderRatingDto>> GetAllRatingsAsync(int pageNumber, int pageSize)
        {
            var ratings = await _context.OrderRatings
                .OrderByDescending(r => r.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var result = new List<OrderRatingDto>();
            foreach (var r in ratings)
                result.Add(await GetRatingDtoAsync(r.Id));

            return result;
        }

        // ===================================
        // Private: GetRatingDtoAsync
        // ===================================
        private async Task<OrderRatingDto> GetRatingDtoAsync(Guid ratingId)
        {
            var rating = await _context.OrderRatings
                .Include(r => r.Order)
                .Include(r => r.Customer)
                .Include(r => r.SubOrderRatings)
                    .ThenInclude(sr => sr.Vendor)
                .Include(r => r.SubOrderRatings)
                    .ThenInclude(sr => sr.SubOrder)
                .Include(r => r.SubOrderRatings)
                    .ThenInclude(sr => sr.Driver)
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == ratingId);

            // حساب المتوسط الكلي
            var scores = new List<double> { rating.DeliveryRating };
            if (rating.SpeedRating.HasValue) scores.Add(rating.SpeedRating.Value);
            if (rating.PackagingRating.HasValue) scores.Add(rating.PackagingRating.Value);

            return new OrderRatingDto
            {
                Id = rating.Id,
                OrderId = rating.OrderId,
                OrderNumber = rating.Order?.OrderNumber ?? "—",
                CustomerName = rating.Customer?.FullName ?? "—",
                DeliveryRating = rating.DeliveryRating,
                DeliveryComment = rating.DeliveryComment,
                SpeedRating = rating.SpeedRating,
                PackagingRating = rating.PackagingRating,
                WouldRecommend = rating.WouldRecommend,
                OverallAverage = Math.Round(scores.Average(), 2),
                CreatedAt = rating.CreatedAt,
                SubOrderRatings = rating.SubOrderRatings.Select(sr => new SubOrderRatingDto
                {
                    Id = sr.Id,
                    SubOrderId = sr.SubOrderId,
                    SubOrderNumber = sr.SubOrder?.SubOrderNumber ?? "—",
                    VendorId = sr.VendorId,
                    VendorName = sr.Vendor?.Name ?? "—",
                    VendorRating = sr.VendorRating,
                    VendorComment = sr.VendorComment,
                    DriverRating = sr.DriverRating,
                    DriverName = sr.Driver?.FullName
                }).ToList()
            };
        }
    }
}