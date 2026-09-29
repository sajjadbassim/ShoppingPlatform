namespace ecommerce.Core.DTO.Order
{
    public class SubOrderDto
    {
        public Guid Id { get; set; }
        public string SubOrderNumber { get; set; }
        public string Status { get; set; }

        // معلومات المتجر
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public string VendorNameAr { get; set; }
        public string VendorPhone { get; set; }

        // المبالغ
        public decimal Subtotal { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Total => Subtotal + DeliveryFee;

        // التأكيد
        public Guid? ConfirmedBy { get; set; }
        public string ConfirmedByName { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public DateTime? ConfirmationDeadline { get; set; }
        public int? MinutesRemaining { get; set; }

        // الإلغاء
        public string CancellationReason { get; set; }
        public Guid? CancelledBy { get; set; }
        public string CancelledByName { get; set; }
        public DateTime? CancelledAt { get; set; }

        //خاص في السائقين
        public Guid? DriverId { get; set; }
        public string? DriverName { get; set; }
        public string? DriverPhone { get; set; }
        public DateTime? AssignedAt { get; set; }


        // المنتجات
        public List<SubOrderItemDto> Items { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
