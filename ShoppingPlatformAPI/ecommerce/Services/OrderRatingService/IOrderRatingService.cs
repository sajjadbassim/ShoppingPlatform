using ecommerce.Core.DTO.OrderRating;

namespace ecommerce.Services.OrderRatingService
{
        public interface IOrderRatingService
        {
            // ===================================
            // Customer
            // ===================================

            /// <summary>إرسال تقييم للطلب — مرة واحدة فقط بعد DELIVERED</summary>
            Task<OrderRatingDto> CreateRatingAsync(Guid orderId, Guid customerId, CreateOrderRatingDto dto);

            /// <summary>جلب تقييم طلب معين</summary>
            Task<OrderRatingDto?> GetRatingByOrderIdAsync(Guid orderId, Guid customerId);

            /// <summary>هل قيّم الزبون هذا الطلب؟</summary>
            Task<bool> HasRatedAsync(Guid orderId, Guid customerId);

            // ===================================
            // Admin
            // ===================================

            /// <summary>إحصائيات التقييمات الكلية</summary>
            Task<RatingStatsDto> GetOverallStatsAsync();

            /// <summary>إحصائيات تقييمات متجر معين</summary>
            Task<VendorRatingStatsDto> GetVendorStatsAsync(Guid vendorId);

            /// <summary>إحصائيات تقييمات سائق معين</summary>
            Task<DriverRatingStatsDto> GetDriverStatsAsync(Guid driverId);

            /// <summary>قائمة التقييمات (للأدمن)</summary>
            Task<List<OrderRatingDto>> GetAllRatingsAsync(int pageNumber, int pageSize);
        }
}
