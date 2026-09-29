namespace ecommerce.Core.DTO.Ops
{
    public class PendingSubOrderDto
    {
        public Guid Id { get; set; }
        public string SubOrderNumber { get; set; }
        public string Status { get; set; }

        // معلومات الطلب الرئيسي
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; }

        // معلومات الزبون
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }

        // عنوان التوصيل
        public string DeliveryAddress { get; set; }
        public string DeliveryPhone { get; set; }
        public string DeliveryNotes { get; set; }

        // معلومات المتجر
        public Guid VendorId { get; set; }
        public string VendorName { get; set; }
        public string VendorNameAr { get; set; }
        public string VendorPhone { get; set; }

        // المبالغ
        public decimal Subtotal { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Total => Subtotal + DeliveryFee;

        // التوقيت
        public DateTime CreatedAt { get; set; }
        public DateTime? ConfirmationDeadline { get; set; }
        public int MinutesRemaining { get; set; }
        public int SecondsRemaining { get; set; }
        public bool IsExpired => MinutesRemaining <= 0;

        // المنتجات
        public List<PendingSubOrderItemDto> Items { get; set; }
    }
}
