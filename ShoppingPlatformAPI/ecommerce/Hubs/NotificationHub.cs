using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Text.RegularExpressions;

namespace ecommerce.Hubs
{
    public class NotificationHub : Hub
    {
        // عند اتصال المستخدم
        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier; // من JWT
            var connectionId = Context.ConnectionId;

            Console.WriteLine($"User {userId} connected with connection {connectionId}");

            await base.OnConnectedAsync();
        }

        // عند انقطاع الاتصال
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            var userId = Context.UserIdentifier;
            var connectionId = Context.ConnectionId;

            Console.WriteLine($"User {userId} disconnected from connection {connectionId}");

            await base.OnDisconnectedAsync(exception);
        }
    }
}
