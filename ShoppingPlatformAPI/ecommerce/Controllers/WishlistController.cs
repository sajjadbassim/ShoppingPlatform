using ecommerce.Core.DTO.Wishlist;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // يتطلب تسجيل دخول
    public class WishlistController : ControllerBase
    {
        private readonly IWishlistService _wishlistService;

        public WishlistController(IWishlistService wishlistService)
        {
            _wishlistService = wishlistService;
        }

        // الحصول على UserId من التوكن
        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                throw new UnauthorizedAccessException("يجب تسجيل الدخول أولاً");

            return Guid.Parse(userIdClaim);
        }

        // GET: api/wishlist
        [HttpGet]
        public async Task<IActionResult> GetMyWishlist()
        {
            try
            {
                var userId = GetUserId();
                var wishlist = await _wishlistService.GetUserWishlistAsync(userId);
                return Ok(new
                {
                    success = true,
                    data = wishlist,
                    count = wishlist.Count()
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/wishlist/count
        [HttpGet("count")]
        public async Task<IActionResult> GetWishlistCount()
        {
            try
            {
                var userId = GetUserId();
                var count = await _wishlistService.GetWishlistCountAsync(userId);
                return Ok(new { success = true, count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // GET: api/wishlist/check/{productId}
        [HttpGet("check/{productId}")]
        public async Task<IActionResult> CheckProduct(Guid productId)
        {
            try
            {
                var userId = GetUserId();
                var isInWishlist = await _wishlistService.IsInWishlistAsync(userId, productId);
                return Ok(new { success = true, isInWishlist });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/wishlist
        [HttpPost]
        public async Task<IActionResult> AddToWishlist([FromBody] AddToWishlistDto dto)
        {
            try
            {
                var userId = GetUserId();
                var wishlist = await _wishlistService.AddToWishlistAsync(userId, dto);
                return Ok(new
                {
                    success = true,
                    message = "تمت إضافة المنتج إلى المفضلة بنجاح",
                    data = wishlist
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/wishlist/{productId}
        [HttpDelete("{productId}")]
        public async Task<IActionResult> RemoveFromWishlist(Guid productId)
        {
            try
            {
                var userId = GetUserId();
                var result = await _wishlistService.RemoveFromWishlistAsync(userId, productId);

                if (result)
                    return Ok(new
                    {
                        success = true,
                        message = "تم حذف المنتج من المفضلة بنجاح"
                    });
                else
                    return NotFound(new
                    {
                        success = false,
                        message = "المنتج غير موجود في المفضلة"
                    });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/wishlist/toggle
        [HttpPost("toggle")]
        public async Task<IActionResult> ToggleWishlist([FromBody] AddToWishlistDto dto)
        {
            try
            {
                var userId = GetUserId();
                var added = await _wishlistService.ToggleWishlistAsync(userId, dto.ProductId);

                return Ok(new
                {
                    success = true,
                    isInWishlist = added,
                    message = added
                        ? "تمت إضافة المنتج إلى المفضلة"
                        : "تم حذف المنتج من المفضلة"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/wishlist/clear
        [HttpDelete("clear")]
        public async Task<IActionResult> ClearWishlist()
        {
            try
            {
                var userId = GetUserId();
                var result = await _wishlistService.ClearWishlistAsync(userId);

                if (result)
                    return Ok(new
                    {
                        success = true,
                        message = "تم حذف جميع المنتجات من المفضلة بنجاح"
                    });
                else
                    return NotFound(new
                    {
                        success = false,
                        message = "قائمة المفضلة فارغة بالفعل"
                    });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}