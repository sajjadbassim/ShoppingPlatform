// منقول من ShoppingPlatformFrontend/src/api/endpoints.js — أي endpoint جديد يُضاف في الويب أولاً ثم يُنسخ هنا
type Id = string | number;

export const API_ENDPOINTS = {
  // ============ Auth ============
  AUTH: {
    LOGIN: '/api/Auth/login',
    REGISTER: '/api/Auth/register',
    CHANGE_PASSWORD: '/api/Auth/change-password',
    REFRESH_TOKEN: '/api/Auth/refresh-token',
    ME: '/api/Auth/me',
    FORGOT_PASSWORD: '/api/Auth/forgot-password',
    VERIFY_RESET_OTP: '/api/Auth/verify-reset-otp',
    RESET_PASSWORD: '/api/Auth/reset-password',
    GOOGLE: '/api/auth/google',
    ADD_PHONE: '/api/auth/phone',
    PHONE_SEND_CODE: '/api/auth/phone/send-code',
    PHONE_VERIFY_CODE: '/api/auth/phone/verify-code',
    GOOGLE_STATUS: '/api/auth/google/status',
    GOOGLE_LINK: '/api/auth/google/link',
  },

  // ============ Users ============
  USERS: {
    BASE: '/api/Users',
    BY_ID: (id: Id) => `/api/Users/${id}`,
    BY_PHONE: (phone: Id) => `/api/Users/phone/${phone}`,
    BY_ROLE: (role: Id) => `/api/Users/role/${role}`,
    PAGED: '/api/Users/paged',
    MY_PREFERENCES: '/api/users/me/preferences',
  },

  // ============ Products ============
  PRODUCTS: {
    DUPLICATE: (id: Id) => `/api/Products/${id}/duplicate`,
    BASE: '/api/Products',
    PAGED: '/api/Products/paged',
    BY_ID: (id: Id) => `/api/Products/${id}`,
    BY_VENDOR: (vendorId: Id) => `/api/Products/vendor/${vendorId}`,
    BY_CATEGORY: (categoryId: Id) => `/api/Products/category/${categoryId}`,
    SEARCH: '/api/Products/search',
    UNIFIED_SEARCH: '/api/Products/unified-search',         // ✅ جديد
    SUGGESTIONS: '/api/Products/suggestions',               // اقتراحات نصية خفيفة أثناء الكتابة
    FILTER: '/api/Products/filter',
    ADVANCED_FILTER: '/api/Products/advanced-filter',       // ✅ جديد
    IMAGES: (id: Id) => `/api/Products/${id}/images`,
    DELETE_IMAGE: (imageId: Id) => `/api/Products/images/${imageId}`,
    SET_PRIMARY_IMAGE: (productId: Id, imageId: Id) => `/api/Products/${productId}/images/${imageId}/set-primary`,
    UPDATE_STOCK: (id: Id) => `/api/Products/${id}/stock`,
    BUY_AGAIN: '/api/Products/buy-again',                       // ما طلبه الزبون سابقاً
    STOCK_ALERT: (id: Id) => `/api/Products/${id}/stock-alert`,     // أعلمني عند التوفر
  },

  // روابط المشاركة بمعاينة (صورة/اسم/سعر) — تُحوّل الزائر لصفحة المنتج أو المتجر
  SHARE: {
    PRODUCT: (id: Id) => `/api/share/products/${id}`,
    STORE: (id: Id) => `/api/share/stores/${id}`,
  },

  // ============ Product Variants ============  ✅ جديد كلياً
  VARIANTS: {
    // Attributes
    ATTRIBUTES: (productId: Id) => `/api/products/${productId}/variants/attributes`,
    ATTRIBUTE_BY_ID: (productId: Id, attributeId: Id) => `/api/products/${productId}/variants/attributes/${attributeId}`,
    ATTRIBUTE_VALUES: (productId: Id, attributeId: Id) => `/api/products/${productId}/variants/attributes/${attributeId}/values`,
    ATTRIBUTE_VALUE_BY_ID: (productId: Id, attributeId: Id, valueId: Id) => `/api/products/${productId}/variants/attributes/${attributeId}/values/${valueId}`,
    // Variants
    BASE: (productId: Id) => `/api/products/${productId}/variants`,
    BY_ID: (productId: Id, variantId: Id) => `/api/products/${productId}/variants/${variantId}`,
  },

  // ============ Categories ============
  CATEGORIES: {
    BASE: '/api/Categories',
    BY_ID: (id: Id) => `/api/Categories/${id}`,
    CHILDREN: (parentId: Id) => `/api/Categories/children/${parentId}`,
    ROOT: '/api/Categories/root',
    BY_NAME: (name: Id) => `/api/Categories/name/${name}`,
    BY_ARABIC_NAME: (name: Id) => `/api/Categories/Arbicname/${name}`,
    ICON: (id: Id) => `/api/Categories/${id}/icon`,
    PAGED: '/api/Categories/paged',
  },

  // ============ Vendors ============
  // ============ TikTok ============
  TIKTOK: {
    STATUS: '/api/tiktok/status',
    CONNECT_URL: '/api/tiktok/connect-url',
    CONNECT_COMPLETE: '/api/tiktok/connect/complete',
    SYNC: '/api/tiktok/sync',
    VIDEOS: '/api/tiktok/videos',
    VIDEO: (id: Id) => `/api/tiktok/videos/${id}`,
    SETTINGS: '/api/tiktok/settings',
    CONNECTION: '/api/tiktok/connection',
    STORE_FEED: (vendorId: Id) => `/api/tiktok/stores/${vendorId}/videos`,
    STORE_FEED_REFRESH: (vendorId: Id) => `/api/tiktok/stores/${vendorId}/videos/refresh`,
    REELS: '/api/tiktok/reels',
    REELS_REFRESH: '/api/tiktok/reels/refresh',
    PUBLISH_OPTIONS: '/api/tiktok/publish/options',
    POSTS: '/api/tiktok/posts',
    POST_RETRY: (id: Id) => `/api/tiktok/posts/${id}/retry`,
    POST_CANCEL: (id: Id) => `/api/tiktok/posts/${id}/cancel`,
  },

  // ============ Instagram (المسار يطابق الروابط المسجّلة في تطبيق Meta) ============
  INSTAGRAM: {
    STATUS: '/api/integrations/instagram/status',
    CONNECT_URL: '/api/integrations/instagram/connect-url',
    CONNECT_COMPLETE: '/api/integrations/instagram/connect/complete',
    SYNC: '/api/integrations/instagram/sync',
    MEDIA: '/api/integrations/instagram/media',
    MEDIA_ITEM: (id: Id) => `/api/integrations/instagram/media/${id}`,
    SETTINGS: '/api/integrations/instagram/settings',
    CONNECTION: '/api/integrations/instagram/connection',
    PUBLISH_OPTIONS: '/api/integrations/instagram/publish/options',
    POSTS: '/api/integrations/instagram/posts',
    POST_RETRY: (id: Id) => `/api/integrations/instagram/posts/${id}/retry`,
    POST_CANCEL: (id: Id) => `/api/integrations/instagram/posts/${id}/cancel`,
  },

  // ============ Facebook (المسار يطابق الروابط المسجّلة في تطبيق Meta) ============
  FACEBOOK: {
    STATUS: '/api/integrations/facebook/status',
    CONNECT_URL: '/api/integrations/facebook/connect-url',
    CONNECT_COMPLETE: '/api/integrations/facebook/connect/complete',
    PAGES: '/api/integrations/facebook/pages',
    SELECT_PAGE: '/api/integrations/facebook/pages/select',
    SYNC: '/api/integrations/facebook/sync',
    MEDIA: '/api/integrations/facebook/media',
    MEDIA_ITEM: (id: Id) => `/api/integrations/facebook/media/${id}`,
    SETTINGS: '/api/integrations/facebook/settings',
    CONNECTION: '/api/integrations/facebook/connection',
  },

  // ============ محتوى حسابات التواصل للزوار (تيك توك + إنستغرام + فيسبوك) ============
  SOCIAL: {
    STORE_FEED: (vendorId: Id) => `/api/social/stores/${vendorId}/feed`,
    STORE_FEED_REFRESH: (vendorId: Id) => `/api/social/stores/${vendorId}/feed/refresh`,
    REELS: '/api/social/reels',
    REELS_REFRESH: '/api/social/reels/refresh',
    PUBLISH_UPLOAD: '/api/social/publish/uploads',   // صورة أو فيديو من الاستوديو للنشر
  },

  VENDORS: {
    BASE: '/api/Vendors',
    BY_ID: (id: Id) => `/api/Vendors/${id}`,
    BY_PHONE: (phone: Id) => `/api/Vendors/phone/${phone}`,
    MY_REQUEST: '/api/Vendors/my-request',
    LOGO: (id: Id) => `/api/Vendors/${id}/logo`,
    REMOVE_BACKGROUND: (id: Id) => `/api/vendors/${id}/image-tools/remove-background`,
    PAGED: '/api/Vendors/paged',
  },

  // ============ Vendor Dashboard ============  ✅ جديد كلياً
  VENDOR_MARKETING: {
    PROMOTIONS: (vendorId: Id) => `/api/vendors/${vendorId}/promotions`,
    COUPONS: (vendorId: Id) => `/api/vendors/${vendorId}/coupons`,
  },

  VENDOR_DASHBOARD: {
    BASE: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard`,
    SALES: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/sales`,
    ORDERS: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/orders`,
    ORDER_COUNTS: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/orders/counts`,
    ORDER_BY_ID: (vendorId: Id, subOrderId: Id) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}`,
    CONFIRM_ORDER: (vendorId: Id, subOrderId: Id) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/confirm`,
    REJECT_ORDER: (vendorId: Id, subOrderId: Id) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/reject`,
    START_PREPARING: (vendorId: Id, subOrderId: Id) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/preparing`,
    MARK_READY: (vendorId: Id, subOrderId: Id) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/ready`,
    PRODUCTS: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/products`,
    PRODUCT_SALES: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/products/sales`,
    REVIEWS: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/reviews`,
    RETURN_TRIPS: (vendorId: Id) => `/api/vendors/${vendorId}/dashboard/return-trips`,
    RETURN_TRIP_RECEIVED: (vendorId: Id, tripId: Id) => `/api/vendors/${vendorId}/dashboard/return-trips/${tripId}/received`,
  },

  // ============ Cart ============
  CART: {
    BASE: '/api/Cart',
    ADD: '/api/Cart/add',
    UPDATE: '/api/Cart/update',
    REMOVE: (productId: Id) => `/api/Cart/remove/${productId}`,
    CLEAR: '/api/Cart/clear',
  },

  // ============ Orders ============
  ORDERS: {
    BASE: '/api/Orders',
    BY_ID: (id: Id) => `/api/Orders/${id}`,
    BY_NUMBER: (orderNumber: Id) => `/api/Orders/number/${orderNumber}`,
    BY_CUSTOMER: (customerId: Id) => `/api/Orders/customer/${customerId}`,
    PAGED: '/api/Orders/paged',
    STATUS_COUNTS: '/api/Orders/status-counts',
    TRACKING: (id: Id) => `/api/Orders/${id}/tracking`,         // ✅ جديد
    CANCEL: (id: Id) => `/api/Orders/${id}/cancel`,             // ✅ جديد
    DELIVERY_SLOTS: '/api/orders/delivery-slots',           // مواعيد توصيل السوبرماركت
  },

  // ============ Order Rating ============  ✅ جديد كلياً
  ORDER_RATING: {
    CREATE: (orderId: Id) => `/api/orders/${orderId}/rating`,
    GET: (orderId: Id) => `/api/orders/${orderId}/rating`,
    STATUS: (orderId: Id) => `/api/orders/${orderId}/rating/status`,
    STORES: (orderId: Id) => `/api/orders/${orderId}/rating/stores`,
  },

  // ============ Wishlist ============
  WISHLIST: {
    BASE: '/api/Wishlist',
    COUNT: '/api/Wishlist/count',
    CHECK: (productId: Id) => `/api/Wishlist/check/${productId}`,
    REMOVE: (productId: Id) => `/api/Wishlist/${productId}`,
    TOGGLE: '/api/Wishlist/toggle',
    CLEAR: '/api/Wishlist/clear',
  },

  // ============ Addresses ============
  DELIVERY_ZONES: {
    BASE: '/api/delivery-zones',
    ADMIN: '/api/delivery-zones/admin',
    MODE: '/api/delivery-zones/mode',
    QUOTE: '/api/delivery-zones/quote',
    BY_ID: (id: Id) => `/api/delivery-zones/${id}`,
  },

  PROFILE: {
    AVATAR: '/api/profile/avatar',
  },

  // حذف الزبون لحسابه بنفسه + فحص إصدار التطبيق
  ACCOUNT: {
    DELETE: '/api/account',
  },
  APP: {
    VERSION: '/api/app/version',
  },


  ADDRESSES: {
    BASE: '/api/Addresses',
    BY_ID: (id: Id) => `/api/Addresses/${id}`,
    BY_USER: (userId: Id) => `/api/Addresses/user/${userId}`,
  },

  // ============ Reviews ============  ✅ جديد كلياً
  REVIEWS: {
    BASE: '/api/Reviews',
    BY_ID: (id: Id) => `/api/Reviews/${id}`,
    PRODUCT_SUMMARY: (productId: Id) => `/api/Reviews/product/${productId}/summary`,
    VENDOR_SUMMARY: (vendorId: Id) => `/api/Reviews/vendor/${vendorId}/summary`,
    HELPFUL: (id: Id) => `/api/Reviews/${id}/helpful`,
    REPLY: (id: Id) => `/api/Reviews/${id}/reply`,       // رد صاحب المتجر
    REPORT: (id: Id) => `/api/Reviews/${id}/report`,
    // Admin
    REPORTED: '/api/Reviews/reported',
    APPROVE: (id: Id) => `/api/Reviews/${id}/approve`,
    REJECT: (id: Id) => `/api/Reviews/${id}/reject`,
  },

  // ============ Notifications ============  ✅ جديد كلياً
  NOTIFICATIONS: {
    BASE: '/api/Notifications',
    UNREAD_COUNT: '/api/Notifications/unread-count',
    MARK_READ: (id: Id) => `/api/Notifications/${id}/read`,
    MARK_ALL_READ: '/api/Notifications/read-all',
    DELETE: (id: Id) => `/api/Notifications/${id}`,
    DELETE_READ: '/api/Notifications/read',
    LINK: (id: Id) => `/api/Notifications/${id}/link`,
  },

  // ============ Coupons ============  ✅ جديد كلياً
  COUPONS: {
    BASE: '/api/Coupons',
    PAGED: '/api/Coupons/paged',
    BY_ID: (id: Id) => `/api/Coupons/${id}`,
    VALIDATE: '/api/Coupons/validate',
  },

  // ============ Home ============  ✅ جديد كلياً
  HOME: {
    BASE: '/api/Home',
    // Banners
    BANNERS: '/api/Home/banners',
    BANNER_BY_ID: (id: Id) => `/api/Home/banners/${id}`,
    // Sections
    SECTIONS: '/api/Home/sections',
    SECTION_BY_ID: (id: Id) => `/api/Home/sections/${id}`,
    SECTION_ITEMS: (id: Id) => `/api/Home/sections/${id}/items`,
    SECTION_BANNER: (id: Id) => `/api/Home/sections/${id}/banner`,   // صورة بانر رأس قسم المنتجات
    SECTION_ITEM_DELETE: (sectionId: Id, productId: Id) => `/api/Home/sections/${sectionId}/items/${productId}`,
  },

  // ============ Loyalty ============  ✅ جديد كلياً
  LOYALTY: {
    ACCOUNT: '/api/Loyalty/account',
    TRANSACTIONS: '/api/Loyalty/transactions',
    ESTIMATE: '/api/Loyalty/estimate',
    REDEEM: '/api/Loyalty/redeem',
    REFERRAL: '/api/Loyalty/referral',                      // ادعُ صديقاً
    // Admin
    SETTINGS: '/api/Loyalty/settings',
    ADMIN_ADJUST: '/api/Loyalty/admin/adjust',
    ADMIN_USER: (userId: Id) => `/api/Loyalty/admin/users/${userId}`,
  },

  // ============ Promotions ============  ✅ جديد كلياً
  PROMOTIONS: {
    BASE: '/api/Promotions',
    PAGED: '/api/Promotions/paged',
    BY_ID: (id: Id) => `/api/Promotions/${id}`,
    ACTIVE: '/api/Promotions/active',
    BY_PRODUCT: (productId: Id) => `/api/Promotions/product/${productId}`,
  },

  // ============ Returns ============  ✅ جديد كلياً
  STAFF: {
    VENDOR: '/api/vendor-staff',
    ADMIN: '/api/admin-staff',
  },

  ACTIVITY: {
    LIST: '/api/activity',
    PURGE_OLD: '/api/activity/old',
  },

  RETURNS: {
    BASE: '/api/Returns',
    MY: '/api/Returns/my',
    PAGED: '/api/Returns/paged',
    BY_ID: (id: Id) => `/api/Returns/${id}`,
    REVIEW: (id: Id) => `/api/Returns/${id}/review`,
    RESTOCK: (id: Id) => `/api/Returns/${id}/restock`,
    REFUNDED: (id: Id) => `/api/Returns/${id}/refunded`,
    ASSIGN_DRIVER: (id: Id) => `/api/Returns/${id}/assign-driver`,
    UNASSIGN_DRIVER: (id: Id) => `/api/Returns/${id}/unassign-driver`,
    PICKUP_FEE: (id: Id) => `/api/Returns/${id}/pickup-fee`,
  },

  // ============ Invoice ============  ✅ جديد كلياً
  INVOICE: {
    GET: (orderId: Id) => `/api/Invoice/${orderId}`,
    PREVIEW: (orderId: Id) => `/api/Invoice/${orderId}/preview`,
  },

  // ============ Rating Admin ============  ✅ جديد كلياً
  RATING_ADMIN: {
    STATS: '/api/admin/ratings/stats',
    ALL: '/api/admin/ratings',
    BY_VENDOR: (vendorId: Id) => `/api/admin/ratings/vendors/${vendorId}`,
    BY_DRIVER: (driverId: Id) => `/api/admin/ratings/drivers/${driverId}`,
  },

  // ============ Admin ============
  ADMIN: {
    DASHBOARD_STATS: '/api/Admin/dashboard/stats',
    USERS: '/api/Admin/users',
    SEARCH_USERS: '/api/Admin/users/search',
    CREATE_OPS_USER: '/api/Admin/users/ops',
    TOGGLE_USER_STATUS: (id: Id) => `/api/Admin/users/${id}/toggle-status`,
    DELETE_USER: (id: Id) => `/api/Admin/users/${id}`,
    VENDORS: '/api/Admin/vendors',
    TOGGLE_VENDOR_STATUS: (id: Id) => `/api/Admin/vendors/${id}/toggle-status`,
    PRODUCTS: '/api/Admin/products',
    TOGGLE_PRODUCT_STATUS: (id: Id) => `/api/Admin/products/${id}/toggle-status`,
    BULK_UPDATE_STATUS: '/api/Admin/products/bulk-update-status',
    REPORTS: {
      SALES: '/api/Admin/reports/sales',
      TOP_VENDORS: '/api/Admin/reports/top-vendors',
      TOP_PRODUCTS: '/api/Admin/reports/top-products',
    },
  },

  // ============ Operations ============
  OPS: {
    RETURN_TRIPS: '/api/ops/return-trips',
    RETURN_TRIP_RECEIVED: (id: Id) => `/api/ops/return-trips/${id}/received`,
    PENDING_SUBORDERS: '/api/Ops/suborders/pending',
    SUBORDERS_PAGED: '/api/Ops/suborders/paged',
    SUBORDER_BY_ID: (id: Id) => `/api/Ops/suborders/${id}`,
    CONFIRM_SUBORDER: (id: Id) => `/api/Ops/suborders/${id}/confirm`,
    CANCEL_SUBORDER: (id: Id) => `/api/Ops/suborders/${id}/cancel`,
    UPDATE_SUBORDER_STATUS: (id: Id) => `/api/Ops/suborders/${id}/status`,
    ASSIGN_DRIVER: (id: Id) => `/api/Ops/suborders/${id}/assign-driver`,
    UNASSIGN_DRIVER: (id: Id) => `/api/Ops/suborders/${id}/unassign`,
    ASSIGN_DRIVER_TO_ORDER: (orderId: Id) => `/api/Ops/orders/${orderId}/assign-driver`, // ✅ جديد
    DASHBOARD_STATS: '/api/Ops/dashboard/stats',
    TRACKING: '/api/ops/tracking',
    TRACKING_LINK: (driverId: Id) => `/api/ops/drivers/${driverId}/tracking-link`,
    REPORTS: '/api/ops/reports',
  },

  // ============ صفحة السائق (رابط مشاركة الموقع — بلا تسجيل دخول) ============
  // مستحقات المتاجر
  FINANCE: {
    BALANCES: '/api/finance/vendors',
    STATEMENT: (vendorId: Id) => `/api/finance/vendors/${vendorId}/statement`,
    PAYOUT: (vendorId: Id) => `/api/finance/vendors/${vendorId}/payouts`,
    ADJUST: (vendorId: Id) => `/api/finance/vendors/${vendorId}/adjustments`,
    VENDOR_COMMISSION: (vendorId: Id) => `/api/finance/vendors/${vendorId}/commission`,
    COMMISSION: '/api/finance/commission',
    BACKFILL: '/api/finance/backfill',
    ME: '/api/vendor-finance/me',
  },

  // إعدادات الطلبات + المتأخرة عن مهلة التأكيد
  ORDER_SETTINGS: {
    GET: '/api/order-settings',
    TIMEOUT: '/api/order-settings/confirmation-timeout',
    OVERDUE: '/api/order-settings/overdue',
    THRESHOLDS: '/api/order-settings/delivery-thresholds',
    GROCERY_SLOTS: '/api/order-settings/grocery-slots',
  },

  // كم استغرق الطلب للوصول
  ORDER_TIMING: {
    BY_ID: (orderId: Id) => `/api/order-timing/${orderId}`,
    LIST: '/api/order-timing',
  },

  // إشعارات الدفع (Web Push)
  PUSH: {
    PUBLIC_KEY: '/api/push/public-key',
    SUBSCRIBE: '/api/push/subscribe',
    UNSUBSCRIBE: '/api/push/unsubscribe',
    TEST: '/api/push/test',
    DEVICE: '/api/push/device',               // موبايل: تسجيل رمز FCM
    DEVICE_REMOVE: '/api/push/device/remove',
  },

  // لوحة السائق (حساب بدور DRIVER)
  DRIVER_APP: {
    ME: '/api/driver/me',
    MY_CASH: '/api/driver/me/cash',
    MY_RETURNS: '/api/driver/returns',
    WORK_STATUS: '/api/driver/me/work-status',
    LOCATION: '/api/driver/me/location',
    ORDERS: '/api/driver/orders',
    PICKED_UP: (subOrderId: Id) => `/api/driver/stops/${subOrderId}/picked-up`,
    RETURN_PICKED_UP: (returnId: Id) => `/api/driver/returns/${returnId}/picked-up`,
    RETURN_PICKUP_FAILED: (returnId: Id) => `/api/driver/returns/${returnId}/pickup-failed`,
    DELIVERED: (orderId: Id) => `/api/driver/orders/${orderId}/delivered`,
    FAILED: (orderId: Id) => `/api/driver/orders/${orderId}/failed`,
  },

  DRIVER_TRACKING: {
    INFO: (token: Id) => `/api/driver-tracking/${token}`,
    LOCATION: (token: Id) => `/api/driver-tracking/${token}/location`,
  },

  // ============ Drivers ============
  DRIVERS: {
    PAGED: '/api/Drivers/paged',
    AVAILABLE: '/api/Drivers/available',
    BY_ID: (id: Id) => `/api/Drivers/${id}`,
    CREATE: '/api/Drivers',
    UPDATE: (id: Id) => `/api/Drivers/${id}`,
    TOGGLE_STATUS: (id: Id) => `/api/Drivers/${id}/toggle-status`,
    UPDATE_WORK_STATUS: (id: Id) => `/api/Drivers/${id}/work-status`,
    ORDERS: (id: Id) => `/api/Drivers/${id}/orders`,
    STATS: (id: Id) => `/api/Drivers/${id}/stats`,
    ACCOUNT: (id: Id) => `/api/ops/drivers/${id}/account`,
    CASH: (id: Id) => `/api/ops/drivers/${id}/cash`,
    CASH_CUSTODY: '/api/ops/drivers/cash',
    REFUSAL_FEE: (orderId: Id) => `/api/ops/drivers/orders/${orderId}/refusal-fee`,
    SETTLE_CASH: (id: Id) => `/api/ops/drivers/${id}/cash/settle`,
    DELIVERY_SETTINGS: '/api/ops/drivers/settings',
  },
};

export default API_ENDPOINTS;