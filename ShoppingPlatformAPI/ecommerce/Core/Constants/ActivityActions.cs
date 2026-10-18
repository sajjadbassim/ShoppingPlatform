namespace ecommerce.Core.Constants
{
    // وصف عربي لكل إجراء في سجل النشاط (Controller.Action)، والإجراءات التي لا تُسجَّل (ضجيج أو تخص الزبون)
    public static class ActivityActions
    {
        public const string Login = "auth.login";
        public const string LoginFailed = "auth.login_failed";

        public static string Label(string action) =>
            Labels.TryGetValue(action, out var l) ? l : action;

        // للاختبار: كل مفتاح يطابق Controller.Action موجوداً
        public static IEnumerable<string> LabelKeys => Labels.Keys;

        public static bool IsIgnored(string controller, string action) =>
            IgnoredControllers.Contains(controller) || Ignored.Contains($"{controller}.{action}");

        // كل واجهات هذه الأقسام إما للزبون أو تحديث تلقائي متكرر
        private static readonly HashSet<string> IgnoredControllers = new(StringComparer.OrdinalIgnoreCase)
        {
            "Cart", "Wishlist", "Notifications", "Push", "SocialFeed", "OrderRating", "Addresses", "GoogleAuth",
        };

        private static readonly HashSet<string> Ignored = new(StringComparer.OrdinalIgnoreCase)
        {
            "DriverApp.Location", "DriverTracking.UpdateLocation",          // موقع السائق كل ثوانٍ
            "Auth.Login", "Auth.RefreshToken", "Auth.Register",          // الدخول يُسجَّل بنفسه
            "Auth.ForgotPassword", "Auth.VerifyResetOtp", "Auth.ResetPassword",
            "Products.GetFiltered", "Products.GetAdvancedFiltered",       // بحث بـ POST
            "Products.SubscribeStockAlert", "Products.UnsubscribeStockAlert",
            "Coupons.Validate", "Reviews.VoteHelpful", "Reviews.RemoveHelpfulVote", "Reviews.Report",
            "TikTok.RefreshReels", "TikTok.RefreshStoreFeed",
            "Facebook.Deauthorize", "Facebook.DataDeletion", "Instagram.Deauthorize", "Instagram.DataDeletion",
        };

        private static readonly Dictionary<string, string> Labels = new(StringComparer.OrdinalIgnoreCase)
        {
            [Login] = "تسجيل دخول",
            [LoginFailed] = "محاولة دخول فاشلة (كلمة مرور خاطئة)",
            ["Auth.Logout"] = "تسجيل خروج",
            ["Auth.ChangePassword"] = "تغيير كلمة المرور",
            ["Auth.AddPhone"] = "إضافة رقم هاتف",
            ["ActivityLog.PurgeOld"] = "حذف سجلات النشاط الأقدم من 30 يوماً",
            ["VendorStaff.Create"] = "إضافة موظف للمتجر",
            ["VendorStaff.Update"] = "تعديل موظف المتجر أو صلاحياته",
            ["VendorStaff.Toggle"] = "إيقاف/تفعيل موظف المتجر",
            ["VendorStaff.Remove"] = "إزالة موظف من المتجر",
            ["AdminStaff.Create"] = "إضافة مسؤول",
            ["AdminStaff.Update"] = "تعديل مسؤول أو صلاحياته",
            ["AdminStaff.Toggle"] = "إيقاف/تفعيل مسؤول",

            ["Admin.CreateOpsUser"] = "إنشاء حساب عمليات",
            ["Admin.ToggleUserStatus"] = "تفعيل/تعطيل مستخدم",
            ["Admin.DeleteUser"] = "حذف مستخدم",
            ["Admin.ToggleVendorStatus"] = "تفعيل/تعطيل متجر",
            ["Admin.ToggleProductStatus"] = "تفعيل/تعطيل منتج",
            ["Admin.BulkUpdateProductsStatus"] = "تغيير حالة عدة منتجات",
            ["Admin.ChangeUserRole"] = "تغيير دور مستخدم",
            ["Users.Update"] = "تعديل بيانات مستخدم",
            ["Users.Delete"] = "حذف مستخدم",
            ["Profile.Upload"] = "تغيير الصورة الشخصية",
            ["Profile.Remove"] = "حذف الصورة الشخصية",
            ["UserPreferences.Update"] = "تعديل الإعدادات الشخصية",

            ["Categories.Create"] = "إضافة فئة",
            ["Categories.Update"] = "تعديل فئة",
            ["Categories.UpdateIcon"] = "تغيير أيقونة فئة",
            ["Categories.DeleteIcon"] = "حذف أيقونة فئة",
            ["Categories.Delete"] = "حذف فئة",

            ["Coupons.Create"] = "إنشاء كوبون",
            ["Coupons.Update"] = "تعديل كوبون",
            ["Coupons.Delete"] = "حذف كوبون",
            ["Promotions.Create"] = "إنشاء عرض",
            ["Promotions.Update"] = "تعديل عرض",
            ["Promotions.Delete"] = "حذف عرض",
            ["VendorMarketing.CreatePromotion"] = "إنشاء عرض للمتجر",
            ["VendorMarketing.UpdatePromotion"] = "تعديل عرض المتجر",
            ["VendorMarketing.DeletePromotion"] = "حذف عرض المتجر",
            ["VendorMarketing.CreateCoupon"] = "إنشاء كوبون للمتجر",
            ["VendorMarketing.UpdateCoupon"] = "تعديل كوبون المتجر",
            ["VendorMarketing.DeleteCoupon"] = "حذف كوبون المتجر",
            ["Loyalty.UpdateSettings"] = "تعديل إعدادات النقاط",
            ["Loyalty.AdminAdjust"] = "تعديل نقاط زبون يدوياً",

            ["DeliveryZones.SetMode"] = "تغيير تطبيق مناطق التوصيل",
            ["DeliveryZones.Create"] = "إضافة منطقة توصيل",
            ["DeliveryZones.Update"] = "تعديل منطقة توصيل",
            ["DeliveryZones.Delete"] = "حذف منطقة توصيل",
            ["OrderSettings.SetTimeout"] = "تغيير مهلة تأكيد المتجر",
            ["OrderSettings.SetThresholds"] = "تغيير حدود سرعة التوصيل",
            ["OrderSettings.SetGrocerySlots"] = "تغيير مواعيد توصيل السوبرماركت",
            ["OpsDriverAccounts.UpdateSettings"] = "تغيير من يدفع أجرة الرفض والإرجاع",

            ["Finance.Payout"] = "تسجيل دفعة لمتجر",
            ["Finance.Adjust"] = "تسوية يدوية لحساب متجر",
            ["Finance.VendorCommission"] = "تغيير عمولة متجر",
            ["Finance.SetDefault"] = "تغيير العمولة العامة",
            ["Finance.Backfill"] = "احتساب الطلبات السابقة",

            ["Home.CreateBanner"] = "إضافة بانر",
            ["Home.UpdateBanner"] = "تعديل بانر",
            ["Home.DeleteBanner"] = "حذف بانر",
            ["Home.SetSectionBanner"] = "تعيين بانر قسم",
            ["Home.RemoveSectionBanner"] = "إزالة بانر قسم",
            ["Home.CreateSection"] = "إضافة قسم للصفحة الرئيسية",
            ["Home.UpdateSection"] = "تعديل قسم الصفحة الرئيسية",
            ["Home.DeleteSection"] = "حذف قسم الصفحة الرئيسية",
            ["Home.AddSectionItem"] = "إضافة منتج لقسم",
            ["Home.RemoveSectionItem"] = "إزالة منتج من قسم",

            ["Reviews.Create"] = "إضافة تقييم",
            ["Reviews.Update"] = "تعديل تقييم",
            ["Reviews.Delete"] = "حذف تقييم",
            ["Reviews.Reply"] = "الرد على تقييم",
            ["Reviews.DeleteReply"] = "حذف رد على تقييم",
            ["Reviews.Approve"] = "إظهار تقييم",
            ["Reviews.Reject"] = "إخفاء تقييم",

            ["Ops.ConfirmSubOrder"] = "تأكيد طلب نيابة عن المتجر",
            ["Ops.CancelSubOrder"] = "إلغاء جزء من طلب",
            ["Ops.UpdateSubOrderStatus"] = "تغيير حالة طلب",
            ["Ops.AssignDriver"] = "تعيين سائق",
            ["Ops.UnassignDriver"] = "سحب الطلب من السائق",
            ["Ops.AssignDriverToOrder"] = "تعيين سائق للطلب",
            ["OpsTracking.CreateLink"] = "إنشاء رابط تتبع لسائق",
            ["OpsTracking.RevokeLink"] = "إلغاء رابط تتبع سائق",
            ["OpsDriverAccounts.SetRefusalFee"] = "استثناء أجرة الرفض لطلب",
            ["OpsDriverAccounts.SetAccount"] = "ضبط حساب دخول سائق",
            ["OpsDriverAccounts.Settle"] = "استلام النقد من سائق",
            ["Drivers.CreateDriver"] = "إضافة سائق",
            ["Drivers.UpdateDriver"] = "تعديل بيانات سائق",
            ["Drivers.ToggleDriverStatus"] = "تفعيل/تعطيل سائق",
            ["Drivers.UpdateWorkStatus"] = "تغيير حالة عمل سائق",

            ["DriverApp.SetWorkStatus"] = "تغيير حالتي (متاح/استراحة/غير متصل)",
            ["DriverApp.PickedUp"] = "استلام الطلب من المتجر",
            ["DriverApp.Delivered"] = "تسليم الطلب للزبون",
            ["DriverApp.Failed"] = "تعذّر تسليم الطلب",
            ["DriverApp.ReturnPickedUp"] = "استلام مرتجع من الزبون",
            ["DriverApp.ReturnPickupFailed"] = "تعذّر استلام مرتجع",

            ["Returns.Create"] = "تقديم طلب إرجاع",
            ["Returns.Review"] = "مراجعة طلب إرجاع",
            ["Returns.Restock"] = "إعادة مرتجع للمخزون",
            ["Returns.AssignDriver"] = "تعيين سائق لاستلام مرتجع",
            ["Returns.UnassignDriver"] = "سحب استلام مرتجع من السائق",
            ["Returns.SetPickupFee"] = "استثناء أجرة استلام مرتجع",
            ["Returns.MarkRefunded"] = "تسجيل ردّ مبلغ إرجاع",
            ["ReturnTrips.Received"] = "تأكيد استلام بضاعة راجعة",

            ["Orders.CreateOrder"] = "إنشاء طلب",
            ["Orders.CancelOrder"] = "إلغاء طلب",

            ["VendorDashboard.ConfirmOrder"] = "تأكيد طلب",
            ["VendorDashboard.StartPreparing"] = "بدء تحضير طلب",
            ["VendorDashboard.MarkReady"] = "الطلب جاهز للاستلام",
            ["VendorDashboard.RejectOrder"] = "رفض طلب",
            ["VendorDashboard.ReturnTripReceived"] = "تأكيد استلام بضاعة راجعة",

            ["Products.Create"] = "إضافة منتج",
            ["Products.Duplicate"] = "نسخ منتج",
            ["Products.Update"] = "تعديل منتج",
            ["Products.AddImage"] = "إضافة صورة منتج",
            ["Products.DeleteImage"] = "حذف صورة منتج",
            ["Products.SetPrimaryImage"] = "تغيير الصورة الرئيسية لمنتج",
            ["Products.UpdateStock"] = "تعديل المخزون",
            ["Products.Delete"] = "حذف منتج",
            ["ProductVariants.CreateAttribute"] = "إضافة خاصية لمنتج",
            ["ProductVariants.UpdateAttribute"] = "تعديل خاصية منتج",
            ["ProductVariants.DeleteAttribute"] = "حذف خاصية منتج",
            ["ProductVariants.AddAttributeValue"] = "إضافة قيمة خاصية",
            ["ProductVariants.DeleteAttributeValue"] = "حذف قيمة خاصية",
            ["ProductVariants.CreateVariant"] = "إضافة نسخة منتج",
            ["ProductVariants.UpdateVariant"] = "تعديل نسخة منتج",
            ["ProductVariants.DeleteVariant"] = "حذف نسخة منتج",

            ["Vendors.Create"] = "إنشاء متجر",
            ["Vendors.Update"] = "تعديل بيانات متجر",
            ["Vendors.UpdateLogo"] = "تغيير شعار متجر",
            ["Vendors.DeleteLogo"] = "حذف شعار متجر",
            ["Vendors.Delete"] = "حذف متجر",

            ["Instagram.CreatePost"] = "نشر على إنستغرام",
            ["Instagram.RetryPost"] = "إعادة محاولة نشر على إنستغرام",
            ["Instagram.CancelPost"] = "إلغاء نشر على إنستغرام",
            ["Instagram.Sync"] = "مزامنة إنستغرام",
            ["Instagram.UpdateMedia"] = "تعديل منشور إنستغرام",
            ["Instagram.UpdateSettings"] = "تعديل إعدادات إنستغرام",
            ["Instagram.Disconnect"] = "فصل حساب إنستغرام",
            ["Facebook.SelectPage"] = "ربط صفحة فيسبوك",
            ["Facebook.Sync"] = "مزامنة فيسبوك",
            ["Facebook.UpdateMedia"] = "تعديل منشور فيسبوك",
            ["Facebook.UpdateSettings"] = "تعديل إعدادات فيسبوك",
            ["Facebook.Disconnect"] = "فصل صفحة فيسبوك",
            ["TikTok.Sync"] = "مزامنة تيك توك",
            ["TikTok.UpdateVideo"] = "تعديل فيديو تيك توك",
            ["TikTok.UpdateSettings"] = "تعديل إعدادات تيك توك",
            ["TikTok.Disconnect"] = "فصل حساب تيك توك",
            ["SocialPublish.Upload"] = "رفع ملف للنشر",
        };
    }
}
