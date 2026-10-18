namespace ecommerce.Core.DTO.Drivers
{
    // مهمة إرجاع بضاعة لم تُسلَّم إلى متجرها (انظر ReturnTrip)
    public class ReturnTripDto
    {
        public Guid Id { get; set; }
        public Guid OrderId { get; set; }
        public string OrderNumber { get; set; } = "";
        public string SubOrderNumber { get; set; } = "";
        public Guid VendorId { get; set; }
        public string VendorName { get; set; } = "";
        public string? VendorPhone { get; set; }
        public string? VendorAddress { get; set; }
        public Guid DriverId { get; set; }
        public string DriverName { get; set; } = "";
        public string? DriverPhone { get; set; }
        public string Reason { get; set; } = "";
        public string ReasonAr { get; set; } = "";
        public string Status { get; set; } = "";
        public decimal DeliveryFee { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReceivedAt { get; set; }
        // مرتجع بعد الاستلام: السائق يأخذه من الزبون أولاً
        public Guid? ReturnId { get; set; }
        public string? ReturnNumber { get; set; }
        public DateTime? PickedUpAt { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string? CustomerAddress { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public List<ReturnTripItemDto> Items { get; set; } = new();
    }

    public class ReturnTripItemDto
    {
        public string ProductName { get; set; } = "";
        public int Quantity { get; set; }
    }

    // تقرير المرتجعات — منفصل عن تقارير الطلبات والمبيعات
    public class ReturnTripReportDto
    {
        public int Open { get; set; }          // مع السائقين الآن
        public int Received { get; set; }      // استلمتها المتاجر (ضمن الفترة)
        public Dictionary<string, int> ByReason { get; set; } = new();
        public List<ReturnTripDto> Trips { get; set; } = new();
    }
}
