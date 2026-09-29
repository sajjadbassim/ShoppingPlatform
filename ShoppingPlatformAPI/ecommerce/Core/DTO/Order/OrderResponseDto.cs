namespace ecommerce.Core.DTO.Order
{
    public class OrderResponseDto
    {
        public Guid Id { get; set; }
        public string OrderNumber { get; set; }
        public string Status { get; set; }

        // معلومات الزبون
        public Guid CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }

        // عنوان التوصيل
        public Guid AddressId { get; set; }
        public string DeliveryAddress { get; set; }
        public string DeliveryPhone { get; set; }

        // المبالغ
        public decimal Subtotal { get; set; }
        public decimal DeliveryFees { get; set; }
        public decimal TotalAmount { get; set; }

        // الدفع
        public string PaymentMethod { get; set; }
        public string PaymentStatus { get; set; }

        // ملاحظات
        public string CustomerNotes { get; set; }
        public string CancellationReason { get; set; }

        // الطلبات الفرعية
        public List<SubOrderDto> SubOrders { get; set; }

        // إحصائيات
        public int TotalSubOrders { get; set; }
        public int ConfirmedSubOrders { get; set; }
        public int CancelledSubOrders { get; set; }
        public int PendingSubOrders { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public decimal DiscountAmount { get; set; }
        public string? CouponCode { get; set; }


    }
}
