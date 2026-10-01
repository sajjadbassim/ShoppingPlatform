using ecommerce.Core.DTO.Notification;
using ecommerce.Core.Models;
using ecommerce.Repositories;
using ecommerce.Services.NotificationService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace ecommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : Controller
    {
        private readonly INotificationRepository _notificationRepository;
        private readonly INotificationLinkService _linkService;

        public NotificationsController(INotificationRepository notificationRepository, INotificationLinkService linkService)
        {
            _linkService = linkService;
            _notificationRepository = notificationRepository;
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("userId")?.Value;
            return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
        }

        // ===================================
        // GET: api/notifications
        // جلب إشعارات المستخدم الحالي
        // ===================================
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] int take = 20)
        {
            try
            {
                var userId = GetCurrentUserId();
                var notifications = await _notificationRepository.GetByUserIdAsync(userId, take);
                var unreadCount = await _notificationRepository.GetUnreadCountAsync(userId);

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        unreadCount,
                        notifications = notifications.Select(MapToDto)
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // GET: api/notifications/unread-count
        // عدد الإشعارات غير المقروءة
        // ===================================
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            try
            {
                var userId = GetCurrentUserId();
                var count = await _notificationRepository.GetUnreadCountAsync(userId);
                return Ok(new { success = true, data = new { unreadCount = count } });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/notifications/{id}/read
        // تحديد إشعار كمقروء
        // ===================================
        [HttpPatch("{id}/read")]
        public async Task<IActionResult> MarkAsRead(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _notificationRepository.MarkAsReadAsync(id, userId);

                if (result)
                    return Ok(new { success = true, message = "تم تحديد الإشعار كمقروء" });
                else
                    return NotFound(new { success = false, message = "الإشعار غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // PATCH: api/notifications/read-all
        // تحديد كل الإشعارات كمقروءة
        // ===================================
        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            try
            {
                var userId = GetCurrentUserId();
                await _notificationRepository.MarkAllAsReadAsync(userId);
                return Ok(new { success = true, message = "تم تحديد كل الإشعارات كمقروءة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/notifications/{id}
        // حذف إشعار محدد
        // ===================================
        // GET: api/notifications/{id}/link — الصفحة التي يفتحها الإشعار حسب دور المستخدم (أو null)
        [HttpGet("{id}/link")]
        public async Task<IActionResult> GetLink(Guid id, CancellationToken ct)
        {
            var path = await _linkService.GetLinkAsync(id, GetCurrentUserId(), User.FindFirstValue(ClaimTypes.Role) ?? "", ct);
            return Ok(new { success = true, data = new { path } });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _notificationRepository.DeleteAsync(id, userId);

                if (result)
                    return Ok(new { success = true, message = "تم حذف الإشعار" });
                else
                    return NotFound(new { success = false, message = "الإشعار غير موجود" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // DELETE: api/notifications/read
        // حذف كل الإشعارات المقروءة
        // ===================================
        [HttpDelete("read")]
        public async Task<IActionResult> DeleteAllRead()
        {
            try
            {
                var userId = GetCurrentUserId();
                await _notificationRepository.DeleteAllReadAsync(userId);
                return Ok(new { success = true, message = "تم حذف الإشعارات المقروءة" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ===================================
        // Private: MapToDto
        // ===================================
        private static NotificationDto MapToDto(Notification n)
        {
            object? parsedData = null;
            if (!string.IsNullOrWhiteSpace(n.Data))
            {
                try { parsedData = JsonSerializer.Deserialize<object>(n.Data); }
                catch { parsedData = n.Data; }
            }

            return new NotificationDto
            {
                Id = n.Id,
                Type = n.Type,
                Message = n.Message,
                Data = parsedData,
                IsRead = n.IsRead,
                ReadAt = n.ReadAt,
                CreatedAt = n.CreatedAt
            };
        }
    }
}