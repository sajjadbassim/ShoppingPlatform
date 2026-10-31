namespace ecommerce.Core.Constants
{
    // صلاحيات الحسابات المساعدة:
    // - موظف متجر (VENDOR + User.StaffVendorId): يعمل في متجر غيره بما يسمح به صاحبه
    // - مسؤول محدود (ADMIN + User.Permissions غير فارغ): الأدمن الكامل يحدد أقسامه
    // صاحب المتجر والأدمن الكامل (Permissions = null) لا قيود عليهما. الخادم يفرضها (StaffPermissionFilter)
    public static class StaffPermissions
    {
        // ===== المتجر =====
        public const string Orders = "orders";
        public const string Products = "products";
        public const string Marketing = "marketing";
        public const string Reviews = "reviews";
        public const string Reports = "reports";
        public const string Finance = "finance";
        public const string Social = "social";
        public const string Settings = "settings";
        public const string Home = "home";

        public static readonly (string Key, string Label, string Desc)[] Vendor =
        {
            (Home, "أرقام الصفحة الرئيسية", "المبيعات والطلبات والتقييمات وآخر الطلبات في الرئيسية"),
            (Orders, "الطلبات", "رؤية الطلبات وتأكيدها وتحضيرها ورفضها، واستلام البضاعة الراجعة"),
            (Products, "المنتجات", "إضافة وتعديل المنتجات والأسعار والمخزون والصور"),
            (Marketing, "العروض والكوبونات", "عروض وكوبونات المتجر"),
            (Reviews, "التقييمات", "رؤية التقييمات والرد عليها"),
            (Reports, "التقارير", "تقارير المبيعات"),
            (Finance, "الأرباح", "رصيد المتجر وحركاته"),
            (Social, "ربط الحسابات", "إنستغرام وفيسبوك وتيك توك والنشر"),
            (Settings, "إعدادات المتجر", "معلومات المتجر وأوقات العمل واستقبال الطلبات"),
        };

        // ===== الإدارة =====
        public const string Users = "users";
        public const string Stores = "stores";
        public const string Categories = "categories";
        public const string Homepage = "homepage";
        public const string AdminOrders = "orders";
        public const string AdminReviews = "reviews";
        public const string Coupons = "coupons";
        public const string Loyalty = "loyalty";
        public const string Returns = "returns";
        public const string AdminReports = "reports";
        public const string AdminFinance = "finance";
        public const string Zones = "zones";
        public const string AdminSettings = "settings";
        public const string Activity = "activity";

        public static readonly (string Key, string Label, string Desc)[] Admin =
        {
            (Users, "المستخدمين", "عرض المستخدمين وتفعيلهم وإنشاء حسابات العمليات"),
            (Stores, "المتاجر", "تفعيل المتاجر والمنتجات وأجرة توصيل المتجر"),
            (Categories, "الفئات", "الفئات وأيقوناتها"),
            (Homepage, "الصفحة الرئيسية", "البانرات وأقسام الصفحة الرئيسية"),
            (AdminOrders, "الطلبات", "عرض الطلبات وتفاصيلها والفواتير"),
            (AdminReviews, "التقييمات", "إخفاء وإظهار وحذف التقييمات"),
            (Coupons, "الكوبونات والعروض", "كوبونات وعروض المنصة"),
            (Loyalty, "النقاط التشجيعية", "إعدادات النقاط وتعديل نقاط الزبائن"),
            (Returns, "الإرجاع", "مراجعة الإرجاعات وردّ المبالغ"),
            (AdminReports, "التقارير", "تقارير المبيعات وأفضل المتاجر والمنتجات"),
            (AdminFinance, "المستحقات", "حسابات المتاجر والدفعات والعمولات ونقد السائقين"),
            (Zones, "مناطق التوصيل", "المناطق وأسعارها"),
            (AdminSettings, "الإعدادات العامة", "من يدفع أجرة الرفض والإرجاع، وإعدادات الطلبات"),
            (Activity, "سجل النشاط", "رؤية سجل نشاط الجميع وحذف القديم"),
        };

        public static readonly HashSet<string> VendorKeys = Vendor.Select(p => p.Key).ToHashSet();
        public static readonly HashSet<string> AdminKeys = Admin.Select(p => p.Key).ToHashSet();

        public static HashSet<string> Parse(string? csv) =>
            (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();

        // يقبل المعروف فقط، بلا تكرار، بترتيب ثابت
        public static string Normalize(IEnumerable<string>? keys, HashSet<string> allowed, IEnumerable<string> order) =>
            string.Join(",", order.Where(k => keys?.Contains(k) == true && allowed.Contains(k)));

        // ===== أي صلاحية يحتاجها كل إجراء =====
        // null في القاموس = متاح دائماً لهذا النوع من الحسابات؛ Full = للصاحب/الأدمن الكامل فقط.
        // إجراء غير مذكور: القراءة (GET) متاحة، والتعديل ممنوع — الافتراضي الآمن لأي واجهة جديدة
        public const string Full = "__full";

        // حسابات المستخدم الشخصية — متاحة للجميع
        public static readonly HashSet<string> PersonalControllers = new(StringComparer.OrdinalIgnoreCase)
        {
            "Auth", "Profile", "UserPreferences", "Notifications", "Push", "ActivityLog", "GoogleAuth",
        };

        public static readonly Dictionary<string, string?> VendorMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["VendorDashboard.GetDashboard"] = null,
            ["VendorDashboard.GetOrderCounts"] = null,
            ["VendorDashboard.ReturnTrips"] = Orders,
            ["VendorDashboard.ReturnTripReceived"] = Orders,
            ["VendorDashboard.GetOrders"] = Orders,
            ["VendorDashboard.GetOrderById"] = Orders,
            ["VendorDashboard.ConfirmOrder"] = Orders,
            ["VendorDashboard.StartPreparing"] = Orders,
            ["VendorDashboard.MarkReady"] = Orders,
            ["VendorDashboard.RejectOrder"] = Orders,
            ["VendorDashboard.GetSalesStats"] = Reports,
            ["VendorDashboard.GetProductSales"] = Reports,
            ["VendorDashboard.GetReviewsFeed"] = Reviews,
            ["VendorDashboard.GetProductsWithStats"] = Products,
            ["Returns.GetById"] = Orders,
            ["Returns.GetPaged"] = Orders,
            ["Invoice"] = Orders,
            ["Products"] = Products,
            ["ProductVariants"] = Products,
            ["ProductImageTools"] = Products,
            ["VendorMarketing"] = Marketing,
            ["Reviews.Reply"] = Reviews,
            ["Reviews.DeleteReply"] = Reviews,
            ["VendorFinance"] = Finance,
            ["Vendors.Update"] = Settings,
            ["Vendors.UpdateLogo"] = Settings,
            ["Vendors.DeleteLogo"] = Settings,
            ["Instagram"] = Social,
            ["Facebook"] = Social,
            ["TikTok"] = Social,
            ["SocialPublish"] = Social,
            ["VendorStaff"] = Full,
        };

        public static readonly Dictionary<string, string?> AdminMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Admin.GetDashboardStats"] = null,
            ["Admin.GetAllUsers"] = Users,
            ["Admin.SearchUsers"] = Users,
            ["Admin.CreateOpsUser"] = Users,
            ["Admin.ToggleUserStatus"] = Users,
            ["Admin.DeleteUser"] = Users,
            ["Admin.ChangeUserRole"] = Full,
            ["Admin.GetAllVendors"] = Stores,
            ["Admin.ToggleVendorStatus"] = Stores,
            ["Admin.GetAllProducts"] = Stores,
            ["Admin.ToggleProductStatus"] = Stores,
            ["Admin.BulkUpdateProductsStatus"] = Stores,
            ["Admin.GetSalesReport"] = AdminReports,
            ["Admin.GetTopVendors"] = AdminReports,
            ["Admin.GetTopProducts"] = AdminReports,
            ["Users"] = Users,
            ["Vendors.Update"] = Stores,
            ["Vendors.UpdateLogo"] = Stores,
            ["Vendors.DeleteLogo"] = Stores,
            ["Vendors.Delete"] = Stores,
            ["Vendors.Create"] = Stores,
            ["RatingAdmin"] = Stores,
            ["Categories.Create"] = Categories,
            ["Categories.Update"] = Categories,
            ["Categories.UpdateIcon"] = Categories,
            ["Categories.DeleteIcon"] = Categories,
            ["Categories.Delete"] = Categories,
            ["Home.CreateBanner"] = Homepage,
            ["Home.UpdateBanner"] = Homepage,
            ["Home.DeleteBanner"] = Homepage,
            ["Home.SetSectionBanner"] = Homepage,
            ["Home.RemoveSectionBanner"] = Homepage,
            ["Home.CreateSection"] = Homepage,
            ["Home.UpdateSection"] = Homepage,
            ["Home.DeleteSection"] = Homepage,
            ["Home.AddSectionItem"] = Homepage,
            ["Home.RemoveSectionItem"] = Homepage,
            ["Orders.GetPaged"] = AdminOrders,
            ["Orders.GetStatusCounts"] = AdminOrders,
            ["Orders.GetOrderById"] = AdminOrders,
            ["Orders.GetOrderByNumber"] = AdminOrders,
            ["Orders.GetOrderTracking"] = AdminOrders,
            ["Orders.GetCustomerOrders"] = AdminOrders,
            ["Ops"] = AdminOrders,
            ["OpsTracking"] = AdminOrders,
            ["OrderTiming"] = AdminOrders,
            ["Invoice"] = AdminOrders,
            ["Drivers"] = AdminOrders,
            ["Reviews.GetReported"] = AdminReviews,
            ["Reviews.Approve"] = AdminReviews,
            ["Reviews.Reject"] = AdminReviews,
            ["Reviews.Delete"] = AdminReviews,
            ["Coupons.GetAll"] = Coupons,
            ["Coupons.GetPaged"] = Coupons,
            ["Coupons.GetById"] = Coupons,
            ["Coupons.Create"] = Coupons,
            ["Coupons.Update"] = Coupons,
            ["Coupons.Delete"] = Coupons,
            ["Promotions.Create"] = Coupons,
            ["Promotions.Update"] = Coupons,
            ["Promotions.Delete"] = Coupons,
            ["Loyalty.UpdateSettings"] = Loyalty,
            ["Loyalty.AdminAdjust"] = Loyalty,
            ["Loyalty.GetUserAccount"] = Loyalty,
            ["Returns.GetPaged"] = Returns,
            ["Returns.GetById"] = Returns,
            ["Returns.Restock"] = Returns,
            ["Returns.AssignDriver"] = Returns,
            ["Returns.UnassignDriver"] = Returns,
            ["Returns.SetPickupFee"] = Returns,
            ["Returns.MarkRefunded"] = Returns,
            ["Returns.Review"] = Returns,
            ["ReturnTrips"] = Returns,
            ["Finance"] = AdminFinance,
            ["OpsDriverAccounts.CashCustody"] = AdminFinance,
            ["OpsDriverAccounts.Cash"] = AdminFinance,
            ["OpsDriverAccounts.Settle"] = AdminFinance,
            ["OpsDriverAccounts.UpdateSettings"] = AdminSettings,
            ["OpsDriverAccounts.GetSettings"] = null,
            ["OpsDriverAccounts"] = AdminOrders,
            ["DeliveryZones.Admin"] = Zones,
            ["DeliveryZones.SetMode"] = Zones,
            ["DeliveryZones.Create"] = Zones,
            ["DeliveryZones.Update"] = Zones,
            ["DeliveryZones.Delete"] = Zones,
            ["OrderSettings.SetTimeout"] = AdminSettings,
            ["OrderSettings.SetThresholds"] = AdminSettings,
            ["OrderSettings.SetGrocerySlots"] = AdminSettings,
            ["ActivityLog.PurgeOld"] = Activity,
            ["AdminStaff"] = Full,
        };

        // (مذكور؟، الصلاحية) — الإجراء أولاً ثم القسم كله
        public static (bool Found, string? Permission) Lookup(Dictionary<string, string?> map, string controller, string action)
        {
            if (map.TryGetValue($"{controller}.{action}", out var p)) return (true, p);
            if (map.TryGetValue(controller, out p)) return (true, p);
            return (false, null);
        }
    }
}
