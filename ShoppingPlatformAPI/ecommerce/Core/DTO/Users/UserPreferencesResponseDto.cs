namespace ecommerce.Core.DTO.Users
{
    public class UserPreferencesResponseDto
    {
        public string Language { get; set; } = string.Empty;
        public string Theme { get; set; } = string.Empty;
        public string Currency { get; set; } = string.Empty;

        public bool NotifyOrderUpdates { get; set; }
        public bool NotifyNewOrders { get; set; }
        public bool NotifyOrderConfirmations { get; set; }
        public bool NotifyLowStock { get; set; }
        public bool NotifyReviews { get; set; }
        public bool NotifyReturns { get; set; }
        public bool NotifyNewUsers { get; set; }
        public bool NotifyNewVendors { get; set; }
    }
}
