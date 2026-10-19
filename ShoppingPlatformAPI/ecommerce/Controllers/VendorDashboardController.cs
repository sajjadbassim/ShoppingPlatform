using ecommerce.Core.Constants;
using ecommerce.Common;
﻿using ecommerce.Core.Constants;
using ecommerce.Filters;
using ecommerce.Core.DTO.Vendor;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using ecommerce.Core.Exceptions;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/vendors/{vendorId}/dashboard")]
    [Authorize(Policy = "OpsOrAdminOrVENDOR")]
    [TypeFilter(typeof(VendorRouteAccessFilter))]
    public class VendorDashboardController : Controller
    {
        private readonly IVendorDashboardService _dashboardService;
        private readonly ecommerce.Services.ReturnTripService.IReturnTripService _returnTrips;

        private readonly ecommerce.Services.AuthService.IUserSessionValidator _sessions;

        public VendorDashboardController(IVendorDashboardService dashboardService,
            ecommerce.Services.ReturnTripService.IReturnTripService returnTrips,
            ecommerce.Services.AuthService.IUserSessionValidator sessions)
        {
            _sessions = sessions;
            _dashboardService = dashboardService;
            _returnTrips = returnTrips;
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/return-trips?open=true
        // بضاعة لم تُسلَّم للزبون في طريقها للمتجر مع السائق (وآخر 30 يوماً إن open=false)
        // ===================================
        [HttpGet("return-trips")]
        public async Task<IActionResult> ReturnTrips(Guid vendorId, [FromQuery] bool open = true, CancellationToken ct = default)
            => Ok(new { success = true, data = await _returnTrips.GetForVendorAsync(vendorId, open, ct) });

        // ===================================
        // POST: api/vendors/{vendorId}/dashboard/return-trips/{tripId}/received
        // المتجر استلم البضاعة المُرجعة: تعود للمخزون ويُغلق الطلب الفاشل
        // ===================================
        [HttpPost("return-trips/{tripId:guid}/received")]
        public async Task<IActionResult> ReturnTripReceived(Guid vendorId, Guid tripId, CancellationToken ct)
        {
            var trip = await _returnTrips.ConfirmReceivedAsync(tripId, GetCurrentUserId(), vendorId, ct);
            return Ok(new { success = true, data = trip, message = "تم تأكيد الاستلام وإعادة القطع للمخزون" });
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("userId")?.Value;
            return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard
        // الداشبورد الرئيسي
        // ===================================
        [HttpGet]
        public async Task<IActionResult> GetDashboard(Guid vendorId)
        {
            try
            {
                var dashboard = await _dashboardService.GetDashboardAsync(vendorId);
                // موظف بلا صلاحية «أرقام الرئيسية»: الاسم فقط، والأرقام لا تغادر الخادم
                var (permissions, staffVendorId) = await _sessions.GetAccessAsync(GetCurrentUserId());
                if (staffVendorId != null && !StaffPermissions.Parse(permissions).Contains(StaffPermissions.Home))
                    return Ok(new { success = true, data = new { vendorName = dashboard.VendorName } });
                return Ok(new { success = true, data = dashboard });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/sales?period=month
        // إحصائيات المبيعات
        // ===================================
        [HttpGet("sales")]
        public async Task<IActionResult> GetSalesStats(
            Guid vendorId,
            [FromQuery] string period = "month",
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var validPeriods = new[] { "today", "week", "month", "year", "custom" };
                if (!validPeriods.Contains(period.ToLower()))
                    return BadRequest(new { success = false, message = "الفترة يجب أن تكون: today / week / month / year / custom" });

                var stats = await _dashboardService.GetSalesStatsAsync(vendorId, period, from, to);
                return Ok(new { success = true, data = stats });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/orders?status=&pageNumber=1&pageSize=20
        // طلبات البائع
        // ===================================
        [HttpGet("orders")]
        public async Task<IActionResult> GetOrders(
            Guid vendorId,
            [FromQuery] string? status = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null)
        {
            try
            {
                StatusFilter.Validate(status, typeof(OrderStatus));
                var result = await _dashboardService.GetOrdersAsync(vendorId, status, pageNumber, Math.Clamp(pageSize, 1, 100), search);
                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/reviews?unanswered=true&rating=5
        // كل تقييمات منتجات المتجر في قائمة واحدة
        // ===================================
        [HttpGet("reviews")]
        public async Task<IActionResult> GetReviewsFeed(Guid vendorId,
            [FromQuery] bool unanswered = false, [FromQuery] int? rating = null,
            [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _dashboardService.GetReviewsFeedAsync(vendorId, unanswered, rating, Math.Max(1, pageNumber), Math.Clamp(pageSize, 1, 50));
            var unansweredCount = await _dashboardService.CountUnansweredReviewsAsync(vendorId);
            return Ok(new { success = true, data = result.Data, pagination = result.Pagination, unansweredCount });
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/products/sales — المبيعات لكل منتج
        // ===================================
        [HttpGet("products/sales")]
        public async Task<IActionResult> GetProductSales(Guid vendorId) =>
            Ok(new { success = true, data = await _dashboardService.GetProductSalesAsync(vendorId) });

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/orders/counts
        // أعداد الطلبات لكل حالة
        // ===================================
        [HttpGet("orders/counts")]
        public async Task<IActionResult> GetOrderCounts(Guid vendorId) =>
            Ok(new { success = true, data = await _dashboardService.GetOrderCountsAsync(vendorId) });

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/orders/{subOrderId}
        // تفاصيل طلب محدد
        // ===================================
        [HttpGet("orders/{subOrderId}")]
        public async Task<IActionResult> GetOrderById(Guid vendorId, Guid subOrderId)
        {
            try
            {
                var order = await _dashboardService.GetOrderByIdAsync(vendorId, subOrderId);
                return Ok(new { success = true, data = order });
            }
            catch (AppException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/confirm
        // تأكيد الطلب
        // ===================================
        // الجسم اختياري: { unavailableItems: [{ itemId, quantity }] } للقبول الجزئي
        [HttpPost("orders/{subOrderId}/confirm")]
        public async Task<IActionResult> ConfirmOrder(Guid vendorId, Guid subOrderId,
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] VendorConfirmDto? dto)
        {
            try
            {
                var opsUserId = GetCurrentUserId();
                var order = await _dashboardService.ConfirmOrderAsync(vendorId, subOrderId, opsUserId, dto?.UnavailableItems);
                return Ok(new { success = true, data = order, message = "تم تأكيد الطلب بنجاح" });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/preparing — بدء التحضير
        [HttpPost("orders/{subOrderId}/preparing")]
        public async Task<IActionResult> StartPreparing(Guid vendorId, Guid subOrderId)
        {
            try
            {
                var order = await _dashboardService.StartPreparingAsync(vendorId, subOrderId, GetCurrentUserId());
                return Ok(new { success = true, data = order, message = "بدأ تحضير الطلب" });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/ready — جاهز للاستلام
        [HttpPost("orders/{subOrderId}/ready")]
        public async Task<IActionResult> MarkReady(Guid vendorId, Guid subOrderId)
        {
            try
            {
                var order = await _dashboardService.MarkReadyAsync(vendorId, subOrderId, GetCurrentUserId());
                return Ok(new { success = true, data = order, message = "الطلب جاهز للاستلام — تم إشعار فريق التوصيل" });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // ===================================
        // POST: api/vendors/{vendorId}/dashboard/orders/{subOrderId}/reject
        // رفض الطلب
        // ===================================
        [HttpPost("orders/{subOrderId}/reject")]
        public async Task<IActionResult> RejectOrder(
            Guid vendorId,
            Guid subOrderId,
            [FromBody] RejectSubOrderDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto?.Reason))
                    return BadRequest(new { success = false, message = "سبب الرفض مطلوب" });

                var opsUserId = GetCurrentUserId();
                var order = await _dashboardService.RejectOrderAsync(vendorId, subOrderId, opsUserId, dto.Reason);
                return Ok(new { success = true, data = order, message = "تم رفض الطلب" });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }

        // ===================================
        // GET: api/vendors/{vendorId}/dashboard/products
        // منتجات البائع مع إحصائيات المبيعات
        // ===================================
        [HttpGet("products")]
        public async Task<IActionResult> GetProductsWithStats(
            Guid vendorId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var result = await _dashboardService.GetProductsWithStatsAsync(vendorId, pageNumber, pageSize);
                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    pagination = result.Pagination
                });
            }
            catch (BusinessRuleException ex)
            {
                return ApiErrors.From(ex);
            }
        }
    }
}