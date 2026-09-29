using ecommerce.Core.DTO.Cart;
using ecommerce.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CartController : Controller
    {
        private readonly ICartService _cartService;

        public CartController(ICartService cartService)
        {
            _cartService = cartService;
        }

        // GET: api/Cart
        [HttpGet]
        public async Task<IActionResult> GetCart()
        {
            try
            {
                var userId = GetCurrentUserId();
                var cart = await _cartService.GetCartAsync(userId);
                return Ok(new { success = true, data = cart });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // POST: api/Cart/add
        [HttpPost("add")]
        public async Task<IActionResult> AddToCart([FromBody] AddToCartDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var cart = await _cartService.AddToCartAsync(userId, dto);
                return Ok(new { success = true, data = cart });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // PUT: api/Cart/update
        [HttpPut("update")]
        public async Task<IActionResult> UpdateQuantity([FromBody] UpdateCartItemDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var cart = await _cartService.UpdateQuantityAsync(userId, dto);
                return Ok(new { success = true, data = cart, message = "تم تحديث الكمية" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/Cart/remove/{productId}?variantId=xxx
        [HttpDelete("remove/{productId}")]
        public async Task<IActionResult> RemoveFromCart(Guid productId, [FromQuery] Guid? variantId = null)
        {
            try
            {
                var userId = GetCurrentUserId();
                var cart = await _cartService.RemoveFromCartAsync(userId, productId, variantId);
                return Ok(new { success = true, data = cart, message = "تم حذف المنتج من السلة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // DELETE: api/Cart/clear
        [HttpDelete("clear")]
        public async Task<IActionResult> ClearCart()
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _cartService.ClearCartAsync(userId);
                if (result)
                    return Ok(new { success = true, message = "تم تفريغ السلة" });
                else
                    return NotFound(new { success = false, message = "السلة فارغة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst("userId")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.Parse(userIdClaim!);
        }
    }
}