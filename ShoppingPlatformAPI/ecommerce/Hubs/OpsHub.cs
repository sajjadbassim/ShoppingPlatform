using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Text.RegularExpressions;

namespace ecommerce.Hubs
{
    [Authorize(Roles = "OPS,ADMIN")] // فقط Ops و Admin — يحمل إشعارات الطلبات ومواقع السائقين
    public class OpsHub : Hub
    {
        // الانضمام لمجموعة Ops
        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;

            // إضافة المستخدم لمجموعة "OpsTeam"
            await Groups.AddToGroupAsync(Context.ConnectionId, "OpsTeam");

            Console.WriteLine($"Ops user {userId} joined OpsTeam");

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            var userId = Context.UserIdentifier;

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "OpsTeam");

            Console.WriteLine($"Ops user {userId} left OpsTeam");

            await base.OnDisconnectedAsync(exception);
        }

        // Method لتحديث حالة الطلب (من Ops إلى باقي الفريق)
        public async Task NotifyOrderStatusUpdate(string subOrderId, string status)
        {
            await Clients.Group("OpsTeam").SendAsync("OrderStatusUpdated", new
            {
                subOrderId,
                status,
                updatedAt = DateTime.UtcNow
            });
        }
    }
}
