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
            var order = await LoadRateableOrderAsync(orderId, customerId);
            var rating = await _context.OrderRatings.Include(r => r.SubOrderRatings).Include(r => r.DriverRatings)
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.CustomerId == customerId);

            // تقييم التجربة مرة واحدة — لكن قد يسبقه تقييم المتاجر وحدها
            if (rating?.DeliveryRating != null)
                throw new Exception("لقد قيّمت تجربة هذا الطلب مسبقاً");

            if (rating == null)
            {
                rating = new OrderRating { OrderId = orderId, CustomerId = customerId };
                await _context.OrderRatings.AddAsync(rating);
            }
            rating.DeliveryRating = dto.DeliveryRating;
            rating.DeliveryComment = dto.DeliveryComment;
            rating.SpeedRating = dto.SpeedRating;
            rating.PackagingRating = dto.PackagingRating;
            rating.WouldRecommend = dto.WouldRecommend;

            // تقييمات المتاجر المرسلة معها اختيارية (المتاجر المقيّمة مسبقاً تُتجاهل)
            AddStoreRatings(order, rating, dto.SubOrderRatings, skipRated: true);
            var drivers = AddDriverRatings(order, rating, dto.DriverRatings, skipRated: true);

            await _context.SaveChangesAsync();
            await RecalculateDriversAsync(drivers);
            return await GetRatingDtoAsync(rating.Id);
        }

        // تقييم المتاجر وحدها — قبل تقييم التجربة أو بعده
        public async Task<OrderRatingDto> AddStoreRatingsAsync(Guid orderId, Guid customerId, List<CreateSubOrderRatingDto> ratings, List<DriverRatingInputDto>? driverRatings = null)
        {
            ratings ??= new();
            driverRatings ??= new();
            if (ratings.Count == 0 && driverRatings.Count == 0)
                throw new Exception("قيّم متجراً أو السائق على الأقل");

            var order = await LoadRateableOrderAsync(orderId, customerId);
            var rating = await _context.OrderRatings.Include(r => r.SubOrderRatings).Include(r => r.DriverRatings)
                .FirstOrDefaultAsync(r => r.OrderId == orderId && r.CustomerId == customerId);

            if (rating == null)
            {
                rating = new OrderRating { OrderId = orderId, CustomerId = customerId };
                await _context.OrderRatings.AddAsync(rating);
            }

            var added = AddStoreRatings(order, rating, ratings, skipRated: false);
            var drivers = AddDriverRatings(order, rating, driverRatings, skipRated: false);
            if (added == 0 && drivers.Count == 0) throw new Exception("لم يُرسل أي تقييم");

            await _context.SaveChangesAsync();
            await RecalculateDriversAsync(drivers);
            return await GetRatingDtoAsync(rating.Id);
        }

        // تقييم السائق: مرة لكل سائق، والسائق يجب أن يكون أوصل جزءاً من هذا الطلب
        private List<Guid> AddDriverRatings(Order order, OrderRating rating, IEnumerable<DriverRatingInputDto>? dtos, bool skipRated)
        {
            var added = new List<Guid>();
            var orderDrivers = order.SubOrders.Where(s => s.DriverId.HasValue).Select(s => s.DriverId!.Value).ToHashSet();
            foreach (var d in (dtos ?? Enumerable.Empty<DriverRatingInputDto>()).GroupBy(x => x.DriverId).Select(g => g.Last()))
            {
                if (!orderDrivers.Contains(d.DriverId))
                    throw new Exception("السائق لم يوصل هذا الطلب");
                if (d.Rating is < 1 or > 5)
                    throw new Exception("تقييم السائق يجب أن يكون بين 1 و 5");
                if (rating.DriverRatings.Any(r => r.DriverId == d.DriverId))
                {
                    if (skipRated) continue;
                    throw new Exception("لقد قيّمت السائق مسبقاً");
                }
                // يُضاف صراحةً: المعرّف مولَّد مسبقاً
                var entity = new OrderDriverRating { OrderRatingId = rating.Id, DriverId = d.DriverId, Rating = d.Rating };
                _context.OrderDriverRatings.Add(entity);
                added.Add(d.DriverId);
            }
            return added;
        }

        // متوسط السائق (يظهر له وللعمليات): التقييمات الجديدة + القديمة المسجلة مع المتاجر
        private async Task RecalculateDriversAsync(IEnumerable<Guid> driverIds)
        {
            foreach (var id in driverIds.Distinct())
            {
                var (sum, count) = await DriverScoreAsync(id);
                var driver = await _context.Drivers.FirstOrDefaultAsync(x => x.Id == id);
                if (driver == null) continue;
                driver.Rating = count == 0 ? 0 : Math.Round((decimal)sum / count, 2);
                await _context.SaveChangesAsync();
            }
        }

        private async Task<(int Sum, int Count)> DriverScoreAsync(Guid driverId)
        {
            var current = await _context.OrderDriverRatings.Where(r => r.DriverId == driverId).Select(r => r.Rating).ToListAsync();
            var legacy = await _context.SubOrderRatings.Where(r => r.DriverId == driverId && r.DriverRating.HasValue).Select(r => r.DriverRating!.Value).ToListAsync();
            return (current.Sum() + legacy.Sum(), current.Count + legacy.Count);
        }

        private async Task<Order> LoadRateableOrderAsync(Guid orderId, Guid customerId)
        {
            var order = await _context.Orders
                .Include(o => o.SubOrders)
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new Exception("الطلب غير موجود");

            if (order.CustomerId != customerId)
                throw new UnauthorizedAccessException("ليس لديك صلاحية لتقييم هذا الطلب");

            if (order.Status != OrderStatus.DELIVERED)
                throw new Exception("يمكن تقييم الطلب فقط بعد الاستلام");

            return order;
        }

        // يضيف تقييمات المتاجر؛ skipRated=false يرفض تقييم متجر مقيّم مسبقاً بدل تجاهله
        private int AddStoreRatings(Order order, OrderRating rating, IEnumerable<CreateSubOrderRatingDto>? dtos, bool skipRated)
        {
            var added = 0;
            foreach (var subDto in dtos ?? Enumerable.Empty<CreateSubOrderRatingDto>())
            {
                var subOrder = order.SubOrders.FirstOrDefault(so => so.Id == subDto.SubOrderId)
                    ?? throw new Exception("المتجر المُقيَّم لا ينتمي لهذا الطلب");

                if (rating.SubOrderRatings.Any(sr => sr.SubOrderId == subDto.SubOrderId))
                {
                    if (skipRated) continue;
                    throw new Exception("لقد قيّمت هذا المتجر مسبقاً");
                }

                // يُضاف صراحةً كسجل جديد: المعرّف مولَّد مسبقاً فيعدّه EF تعديلاً لو أُضيف عبر المجموعة
                var subRating = new SubOrderRating
                {
                    OrderRatingId = rating.Id,
                    SubOrderId = subDto.SubOrderId,
                    VendorId = subOrder.VendorId,
                    VendorRating = subDto.VendorRating,
                    VendorComment = subDto.VendorComment,
                    // 0 = لم يقيّم السائق
                    DriverRating = subDto.DriverRating is >= 1 and <= 5 ? subDto.DriverRating : null,
                    DriverId = subOrder.DriverId
                };
                _context.SubOrderRatings.Add(subRating); // يربطه EF بمجموعة التقييم تلقائياً
                added++;
            }
            return added;
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
                .AnyAsync(r => r.OrderId == orderId && r.CustomerId == customerId && r.DeliveryRating != null);
        }

        public async Task<OrderRatingStatusDto> GetRatingStatusAsync(Guid orderId, Guid customerId)
        {
            var rating = await _context.OrderRatings
                .AsNoTracking()
                .Where(r => r.OrderId == orderId && r.CustomerId == customerId)
                .Select(r => new { r.DeliveryRating, Subs = r.SubOrderRatings.Select(x => x.SubOrderId).ToList(), Drivers = r.DriverRatings.Select(x => x.DriverId).ToList() })
                .FirstOrDefaultAsync();
            return new OrderRatingStatusDto
            {
                HasRated = rating?.DeliveryRating != null,
                RatedSubOrderIds = rating?.Subs ?? new List<Guid>(),
                RatedDriverIds = rating?.Drivers ?? new List<Guid>(),
            };
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
                AverageDeliveryRating = ratings.Where(r => r.DeliveryRating.HasValue).Select(r => (double)r.DeliveryRating!.Value).DefaultIfEmpty(0).Average(),
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

            var (sum, count) = await DriverScoreAsync(driverId);

            return new DriverRatingStatsDto
            {
                DriverId = driverId,
                DriverName = driver.FullName,
                AverageRating = count == 0 ? 0 : Math.Round((double)sum / count, 2),
                TotalRatings = count
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
            var scores = new List<double>();
            if (rating.DeliveryRating.HasValue) scores.Add(rating.DeliveryRating.Value);
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
                OverallAverage = scores.Count > 0 ? Math.Round(scores.Average(), 2)
                    : rating.SubOrderRatings.Count > 0 ? Math.Round(rating.SubOrderRatings.Average(sr => sr.VendorRating), 2) : 0,
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