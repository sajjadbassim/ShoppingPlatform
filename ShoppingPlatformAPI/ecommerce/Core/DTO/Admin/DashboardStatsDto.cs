namespace ecommerce.Core.DTO.Admin
{
    public class DashboardStatsDto
    {
        // Users Stats
        public int TotalUsers { get; set; }
        public int TotalCustomers { get; set; }
        public int TotalOps { get; set; }
        public int ActiveUsers { get; set; }
        public int NewUsersToday { get; set; }

        // Vendors Stats
        public int TotalVendors { get; set; }
        public int ActiveVendors { get; set; }
        public int InactiveVendors { get; set; }

        // Products Stats
        public int TotalProducts { get; set; }
        public int ActiveProducts { get; set; }
        public int OutOfStock { get; set; }

        // Orders Stats
        public int TotalOrders { get; set; }
        public int PendingOrders { get; set; }
        public int ConfirmedOrders { get; set; }
        public int CancelledOrders { get; set; }
        public int TodayOrders { get; set; }

        // Revenue Stats
        public decimal TotalRevenue { get; set; }
        public decimal TodayRevenue { get; set; }
        public decimal MonthRevenue { get; set; }

        // SubOrders Stats
        public int PendingSubOrders { get; set; }
        public int ExpiredSubOrders { get; set; }

        // System Stats
        public DateTime LastUpdate { get; set; } = DateTime.UtcNow;
    }
}
