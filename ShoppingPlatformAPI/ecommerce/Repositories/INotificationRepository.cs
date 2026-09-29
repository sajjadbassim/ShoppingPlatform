using ecommerce.Core.Models;

namespace ecommerce.Repositories
{
    public interface INotificationRepository
    {
        Task<Notification> CreateAsync(Notification notification);
        Task<IEnumerable<Notification>> GetByUserIdAsync(Guid userId, int take = 20);
        Task<int> GetUnreadCountAsync(Guid userId);
        Task<bool> MarkAsReadAsync(Guid notificationId, Guid userId);
        Task<bool> MarkAllAsReadAsync(Guid userId);
        Task<bool> DeleteAsync(Guid notificationId, Guid userId);
        Task<bool> DeleteAllReadAsync(Guid userId);
    }
}