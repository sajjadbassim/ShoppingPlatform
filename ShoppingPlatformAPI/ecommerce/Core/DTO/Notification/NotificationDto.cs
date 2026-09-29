namespace ecommerce.Core.DTO.Notification
{
    public class NotificationDto
    {
        public Guid Id { get; set; }
        public string Type { get; set; }
        public string Message { get; set; }
        public object? Data { get; set; }
        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class NotificationSummaryDto
    {
        public int TotalUnread { get; set; }
        public List<NotificationDto> Recent { get; set; } = new(); // آخر 10
    }
}
