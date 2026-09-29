using ecommerce.Core.DTO.Common;
using ecommerce.Core.DTO.Loyalty;
using ecommerce.Repositories;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LoyaltyController : Controller
    {
        private readonly ILoyaltyService _loyaltyService;
        private readonly IUserRepository _userRepository;

        public LoyaltyController(ILoyaltyService loyaltyService, IUserRepository userRepository)
        {
            _loyaltyService = loyaltyService;
            _userRepository = userRepository;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // ===================================
        // GET: api/loyalty/account
        // حساب النقاط للمستخدم الحالي
        // ===================================
        [HttpGet("account")]
        public async Task<IActionResult> GetAccount()
        {
            try
            {
                var account = await _loyaltyService.GetOrCreateAccountAsync(GetCurrentUserId());
                return Ok(new { success = true, data = account });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/loyalty/transactions
        // سجل المعاملات
        // ===================================
        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions([FromQuery] PaginationParams pagination)
        {
            try
            {
                var result = await _loyaltyService.GetTransactionsAsync(GetCurrentUserId(), pagination);
                return Ok(new { success = true, data = result.Data, pagination = result.Pagination });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/loyalty/estimate?orderAmount=500
        // تقدير النقاط قبل إتمام الطلب
        // ===================================
        [HttpGet("estimate")]
        public async Task<IActionResult> GetEstimate([FromQuery] decimal orderAmount)
        {
            try
            {
                if (orderAmount <= 0)
                    return BadRequest(new { success = false, message = "قيمة الطلب يجب أن تكون أكبر من 0" });

                var estimate = await _loyaltyService.GetEstimateAsync(GetCurrentUserId(), orderAmount);
                return Ok(new { success = true, data = estimate });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/loyalty/redeem
        // استرداد النقاط على طلب
        // ===================================
        [HttpPost("redeem")]
        public async Task<IActionResult> RedeemPoints([FromBody] RedeemPointsDto dto)
        {
            try
            {
                var result = await _loyaltyService.RedeemPointsAsync(GetCurrentUserId(), dto);
                return Ok(new { success = true, data = result, message = result.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/loyalty/settings
        // إعدادات النظام (عامة — للعرض في الـ frontend)
        // ===================================
        [HttpGet("settings")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var settings = await _loyaltyService.GetSettingsAsync();
                return Ok(new { success = true, data = settings });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PUT: api/loyalty/settings
        // تعديل إعدادات النظام (Admin)
        // ===================================
        [HttpPut("settings")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateLoyaltySettingsDto dto)
        {
            try
            {
                var settings = await _loyaltyService.UpdateSettingsAsync(dto);
                return Ok(new { success = true, data = settings, message = "تم تحديث الإعدادات بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // POST: api/loyalty/admin/adjust
        // تعديل نقاط مستخدم يدوياً (Admin)
        // ===================================
        [HttpPost("admin/adjust")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> AdminAdjust([FromBody] AdminAdjustPointsDto dto)
        {
            try
            {
                var account = await _loyaltyService.AdminAdjustPointsAsync(dto);
                return Ok(new { success = true, data = account, message = "تم تعديل النقاط بنجاح" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/loyalty/admin/users/{userId}
        // حساب نقاط مستخدم معين (Admin)
        // ===================================
        [HttpGet("admin/users/{userId}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> GetUserAccount(Guid userId)
        {
            try
            {
                var account = await _loyaltyService.GetOrCreateAccountAsync(userId);
                var user = await _userRepository.GetByIdAsync(userId);
                var recentTransactions = await _loyaltyService.GetTransactionsAsync(
                    userId, new PaginationParams { PageNumber = 1, PageSize = 5 });

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        account.Id,
                        account.Balance,
                        account.TotalEarned,
                        account.TotalRedeemed,
                        account.Tier,
                        account.TierAr,
                        account.BalanceValue,
                        account.NextTierPoints,
                        account.NextTier,
                        account.TierMultiplier,
                        customerName = user?.FullName,
                        customerPhone = user?.Phone,
                        recentTransactions = recentTransactions.Data
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}