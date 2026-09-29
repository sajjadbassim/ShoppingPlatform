namespace ecommerce.Core.DTO.Order
{
    public class OrderStatusLogDto
    {
        public Guid Id { get; set; }
        public string OldStatus { get; set; }
        public string NewStatus { get; set; }
        public Guid? ChangedBy { get; set; }
        public string ChangedByName { get; set; }
        public string Reason { get; set; }
        public string Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
