// src/api/endpoints.js

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
    GOOGLE_STATUS: '/api/auth/google/status',
    GOOGLE_LINK: '/api/auth/google/link',
  },

  // ============ Users ============
  USERS: {
    BASE: '/api/Users',
    BY_ID: (id) => `/api/Users/${id}`,
    BY_PHONE: (phone) => `/api/Users/phone/${phone}`,
    BY_ROLE: (role) => `/api/Users/role/${role}`,
    PAGED: '/api/Users/paged',
    MY_PREFERENCES: '/api/users/me/preferences',
  },

  // ============ Products ============
  PRODUCTS: {
    BASE: '/api/Products',
    PAGED: '/api/Products/paged',
    BY_ID: (id) => `/api/Products/${id}`,
    BY_VENDOR: (vendorId) => `/api/Products/vendor/${vendorId}`,
    BY_CATEGORY: (categoryId) => `/api/Products/category/${categoryId}`,
    SEARCH: '/api/Products/search',
    UNIFIED_SEARCH: '/api/Products/unified-search',         // ✅ جديد
    FILTER: '/api/Products/filter',
    ADVANCED_FILTER: '/api/Products/advanced-filter',       // ✅ جديد
    IMAGES: (id) => `/api/Products/${id}/images`,
    DELETE_IMAGE: (imageId) => `/api/Products/images/${imageId}`,
    SET_PRIMARY_IMAGE: (productId, imageId) => `/api/Products/${productId}/images/${imageId}/set-primary`,
    UPDATE_STOCK: (id) => `/api/Products/${id}/stock`,
  },

  // ============ Product Variants ============  ✅ جديد كلياً
  VARIANTS: {
    // Attributes
    ATTRIBUTES: (productId) => `/api/products/${productId}/variants/attributes`,
    ATTRIBUTE_BY_ID: (productId, attributeId) => `/api/products/${productId}/variants/attributes/${attributeId}`,
    ATTRIBUTE_VALUES: (productId, attributeId) => `/api/products/${productId}/variants/attributes/${attributeId}/values`,
    ATTRIBUTE_VALUE_BY_ID: (productId, attributeId, valueId) => `/api/products/${productId}/variants/attributes/${attributeId}/values/${valueId}`,
    // Variants
    BASE: (productId) => `/api/products/${productId}/variants`,
    BY_ID: (productId, variantId) => `/api/products/${productId}/variants/${variantId}`,
  },

  // ============ Categories ============
  CATEGORIES: {
    BASE: '/api/Categories',
    BY_ID: (id) => `/api/Categories/${id}`,
    CHILDREN: (parentId) => `/api/Categories/children/${parentId}`,
    ROOT: '/api/Categories/root',
    BY_NAME: (name) => `/api/Categories/name/${name}`,
    BY_ARABIC_NAME: (name) => `/api/Categories/Arbicname/${name}`,
    ICON: (id) => `/api/Categories/${id}/icon`,
    PAGED: '/api/Categories/paged',
  },

  // ============ Vendors ============
  // ============ TikTok ============
  TIKTOK: {
    STATUS: '/api/tiktok/status',
    CONNECT_URL: '/api/tiktok/connect-url',
    SYNC: '/api/tiktok/sync',
    VIDEOS: '/api/tiktok/videos',
    VIDEO: (id) => `/api/tiktok/videos/${id}`,
    SETTINGS: '/api/tiktok/settings',
    CONNECTION: '/api/tiktok/connection',
    STORE_FEED: (vendorId) => `/api/tiktok/stores/${vendorId}/videos`,
    STORE_FEED_REFRESH: (vendorId) => `/api/tiktok/stores/${vendorId}/videos/refresh`,
    REELS: '/api/tiktok/reels',
    REELS_REFRESH: '/api/tiktok/reels/refresh',
  },

  VENDORS: {
    BASE: '/api/Vendors',
    BY_ID: (id) => `/api/Vendors/${id}`,
    BY_PHONE: (phone) => `/api/Vendors/phone/${phone}`,
    LOGO: (id) => `/api/Vendors/${id}/logo`,
    PAGED: '/api/Vendors/paged',
  },

  // ============ Vendor Dashboard ============  ✅ جديد كلياً
  VENDOR_DASHBOARD: {
    BASE: (vendorId) => `/api/vendors/${vendorId}/dashboard`,
    SALES: (vendorId) => `/api/vendors/${vendorId}/dashboard/sales`,
    ORDERS: (vendorId) => `/api/vendors/${vendorId}/dashboard/orders`,
    ORDER_BY_ID: (vendorId, subOrderId) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}`,
    CONFIRM_ORDER: (vendorId, subOrderId) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/confirm`,
    REJECT_ORDER: (vendorId, subOrderId) => `/api/vendors/${vendorId}/dashboard/orders/${subOrderId}/reject`,
    PRODUCTS: (vendorId) => `/api/vendors/${vendorId}/dashboard/products`,
  },

  // ============ Cart ============
  CART: {
    BASE: '/api/Cart',
    ADD: '/api/Cart/add',
    UPDATE: '/api/Cart/update',
    REMOVE: (productId) => `/api/Cart/remove/${productId}`,
    CLEAR: '/api/Cart/clear',
  },

  // ============ Orders ============
  ORDERS: {
    BASE: '/api/Orders',
    BY_ID: (id) => `/api/Orders/${id}`,
    BY_NUMBER: (orderNumber) => `/api/Orders/number/${orderNumber}`,
    BY_CUSTOMER: (customerId) => `/api/Orders/customer/${customerId}`,
    PAGED: '/api/Orders/paged',
    STATUS_COUNTS: '/api/Orders/status-counts',
    TRACKING: (id) => `/api/Orders/${id}/tracking`,         // ✅ جديد
    CANCEL: (id) => `/api/Orders/${id}/cancel`,             // ✅ جديد
  },

  // ============ Order Rating ============  ✅ جديد كلياً
  ORDER_RATING: {
    CREATE: (orderId) => `/api/orders/${orderId}/rating`,
    GET: (orderId) => `/api/orders/${orderId}/rating`,
    STATUS: (orderId) => `/api/orders/${orderId}/rating/status`,
    STORES: (orderId) => `/api/orders/${orderId}/rating/stores`,
  },

  // ============ Wishlist ============
  WISHLIST: {
    BASE: '/api/Wishlist',
    COUNT: '/api/Wishlist/count',
    CHECK: (productId) => `/api/Wishlist/check/${productId}`,
    REMOVE: (productId) => `/api/Wishlist/${productId}`,
    TOGGLE: '/api/Wishlist/toggle',
    CLEAR: '/api/Wishlist/clear',
  },

  // ============ Addresses ============
  DELIVERY_ZONES: {
    BASE: '/api/delivery-zones',
    ADMIN: '/api/delivery-zones/admin',
    MODE: '/api/delivery-zones/mode',
    QUOTE: '/api/delivery-zones/quote',
    BY_ID: (id) => `/api/delivery-zones/${id}`,
  },

  PROFILE: {
    AVATAR: '/api/profile/avatar',
  },

  ADDRESSES: {
    BASE: '/api/Addresses',
    BY_ID: (id) => `/api/Addresses/${id}`,
    BY_USER: (userId) => `/api/Addresses/user/${userId}`,
  },

  // ============ Reviews ============  ✅ جديد كلياً
  REVIEWS: {
    BASE: '/api/Reviews',
    BY_ID: (id) => `/api/Reviews/${id}`,
    PRODUCT_SUMMARY: (productId) => `/api/Reviews/product/${productId}/summary`,
    VENDOR_SUMMARY: (vendorId) => `/api/Reviews/vendor/${vendorId}/summary`,
    HELPFUL: (id) => `/api/Reviews/${id}/helpful`,
    REPORT: (id) => `/api/Reviews/${id}/report`,
    // Admin
    REPORTED: '/api/Reviews/reported',
    APPROVE: (id) => `/api/Reviews/${id}/approve`,
    REJECT: (id) => `/api/Reviews/${id}/reject`,
  },

  // ============ Notifications ============  ✅ جديد كلياً
  NOTIFICATIONS: {
    BASE: '/api/Notifications',
    UNREAD_COUNT: '/api/Notifications/unread-count',
    MARK_READ: (id) => `/api/Notifications/${id}/read`,
    MARK_ALL_READ: '/api/Notifications/read-all',
    DELETE: (id) => `/api/Notifications/${id}`,
    DELETE_READ: '/api/Notifications/read',
    LINK: (id) => `/api/Notifications/${id}/link`,
  },

  // ============ Coupons ============  ✅ جديد كلياً
  COUPONS: {
    BASE: '/api/Coupons',
    PAGED: '/api/Coupons/paged',
    BY_ID: (id) => `/api/Coupons/${id}`,
    VALIDATE: '/api/Coupons/validate',
  },

  // ============ Home ============  ✅ جديد كلياً
  HOME: {
    BASE: '/api/Home',
    // Banners
    BANNERS: '/api/Home/banners',
    BANNER_BY_ID: (id) => `/api/Home/banners/${id}`,
    // Sections
    SECTIONS: '/api/Home/sections',
    SECTION_BY_ID: (id) => `/api/Home/sections/${id}`,
    SECTION_ITEMS: (id) => `/api/Home/sections/${id}/items`,
    SECTION_ITEM_DELETE: (sectionId, productId) => `/api/Home/sections/${sectionId}/items/${productId}`,
  },

  // ============ Loyalty ============  ✅ جديد كلياً
  LOYALTY: {
    ACCOUNT: '/api/Loyalty/account',
    TRANSACTIONS: '/api/Loyalty/transactions',
    ESTIMATE: '/api/Loyalty/estimate',
    REDEEM: '/api/Loyalty/redeem',
    // Admin
    SETTINGS: '/api/Loyalty/settings',
    ADMIN_ADJUST: '/api/Loyalty/admin/adjust',
    ADMIN_USER: (userId) => `/api/Loyalty/admin/users/${userId}`,
  },

  // ============ Promotions ============  ✅ جديد كلياً
  PROMOTIONS: {
    BASE: '/api/Promotions',
    PAGED: '/api/Promotions/paged',
    BY_ID: (id) => `/api/Promotions/${id}`,
    ACTIVE: '/api/Promotions/active',
    BY_PRODUCT: (productId) => `/api/Promotions/product/${productId}`,
  },

  // ============ Returns ============  ✅ جديد كلياً
  RETURNS: {
    BASE: '/api/Returns',
    MY: '/api/Returns/my',
    PAGED: '/api/Returns/paged',
    BY_ID: (id) => `/api/Returns/${id}`,
    REVIEW: (id) => `/api/Returns/${id}/review`,
    RESTOCK: (id) => `/api/Returns/${id}/restock`,
  },

  // ============ Invoice ============  ✅ جديد كلياً
  INVOICE: {
    GET: (orderId) => `/api/Invoice/${orderId}`,
    PREVIEW: (orderId) => `/api/Invoice/${orderId}/preview`,
  },

  // ============ Rating Admin ============  ✅ جديد كلياً
  RATING_ADMIN: {
    STATS: '/api/admin/ratings/stats',
    ALL: '/api/admin/ratings',
    BY_VENDOR: (vendorId) => `/api/admin/ratings/vendors/${vendorId}`,
    BY_DRIVER: (driverId) => `/api/admin/ratings/drivers/${driverId}`,
  },

  // ============ Admin ============
  ADMIN: {
    DASHBOARD_STATS: '/api/Admin/dashboard/stats',
    USERS: '/api/Admin/users',
    SEARCH_USERS: '/api/Admin/users/search',
    CREATE_OPS_USER: '/api/Admin/users/ops',
    TOGGLE_USER_STATUS: (id) => `/api/Admin/users/${id}/toggle-status`,
    DELETE_USER: (id) => `/api/Admin/users/${id}`,
    VENDORS: '/api/Admin/vendors',
    TOGGLE_VENDOR_STATUS: (id) => `/api/Admin/vendors/${id}/toggle-status`,
    PRODUCTS: '/api/Admin/products',
    TOGGLE_PRODUCT_STATUS: (id) => `/api/Admin/products/${id}/toggle-status`,
    BULK_UPDATE_STATUS: '/api/Admin/products/bulk-update-status',
    REPORTS: {
      SALES: '/api/Admin/reports/sales',
      TOP_VENDORS: '/api/Admin/reports/top-vendors',
      TOP_PRODUCTS: '/api/Admin/reports/top-products',
    },
  },

  // ============ Operations ============
  OPS: {
    PENDING_SUBORDERS: '/api/Ops/suborders/pending',
    SUBORDERS_PAGED: '/api/Ops/suborders/paged',
    SUBORDER_BY_ID: (id) => `/api/Ops/suborders/${id}`,
    CONFIRM_SUBORDER: (id) => `/api/Ops/suborders/${id}/confirm`,
    CANCEL_SUBORDER: (id) => `/api/Ops/suborders/${id}/cancel`,
    UPDATE_SUBORDER_STATUS: (id) => `/api/Ops/suborders/${id}/status`,
    ASSIGN_DRIVER: (id) => `/api/Ops/suborders/${id}/assign-driver`,
    ASSIGN_DRIVER_TO_ORDER: (orderId) => `/api/Ops/orders/${orderId}/assign-driver`, // ✅ جديد
    DASHBOARD_STATS: '/api/Ops/dashboard/stats',
    TRACKING: '/api/ops/tracking',
    TRACKING_LINK: (driverId) => `/api/ops/drivers/${driverId}/tracking-link`,
    REPORTS: '/api/ops/reports',
  },

  // ============ صفحة السائق (رابط مشاركة الموقع — بلا تسجيل دخول) ============
  // مستحقات المتاجر
  FINANCE: {
    BALANCES: '/api/finance/vendors',
    STATEMENT: (vendorId) => `/api/finance/vendors/${vendorId}/statement`,
    PAYOUT: (vendorId) => `/api/finance/vendors/${vendorId}/payouts`,
    ADJUST: (vendorId) => `/api/finance/vendors/${vendorId}/adjustments`,
    VENDOR_COMMISSION: (vendorId) => `/api/finance/vendors/${vendorId}/commission`,
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
  },

  // كم استغرق الطلب للوصول
  ORDER_TIMING: {
    BY_ID: (orderId) => `/api/order-timing/${orderId}`,
    LIST: '/api/order-timing',
  },

  // إشعارات الدفع (Web Push)
  PUSH: {
    PUBLIC_KEY: '/api/push/public-key',
    SUBSCRIBE: '/api/push/subscribe',
    UNSUBSCRIBE: '/api/push/unsubscribe',
    TEST: '/api/push/test',
  },

  // لوحة السائق (حساب بدور DRIVER)
  DRIVER_APP: {
    ME: '/api/driver/me',
    WORK_STATUS: '/api/driver/me/work-status',
    LOCATION: '/api/driver/me/location',
    ORDERS: '/api/driver/orders',
    PICKED_UP: (subOrderId) => `/api/driver/stops/${subOrderId}/picked-up`,
    DELIVERED: (orderId) => `/api/driver/orders/${orderId}/delivered`,
    FAILED: (orderId) => `/api/driver/orders/${orderId}/failed`,
  },

  DRIVER_TRACKING: {
    INFO: (token) => `/api/driver-tracking/${token}`,
    LOCATION: (token) => `/api/driver-tracking/${token}/location`,
  },

  // ============ Drivers ============
  DRIVERS: {
    PAGED: '/api/Drivers/paged',
    AVAILABLE: '/api/Drivers/available',
    BY_ID: (id) => `/api/Drivers/${id}`,
    CREATE: '/api/Drivers',
    UPDATE: (id) => `/api/Drivers/${id}`,
    TOGGLE_STATUS: (id) => `/api/Drivers/${id}/toggle-status`,
    UPDATE_WORK_STATUS: (id) => `/api/Drivers/${id}/work-status`,
    ORDERS: (id) => `/api/Drivers/${id}/orders`,
    STATS: (id) => `/api/Drivers/${id}/stats`,
    ACCOUNT: (id) => `/api/ops/drivers/${id}/account`,
    CASH: (id) => `/api/ops/drivers/${id}/cash`,
    SETTLE_CASH: (id) => `/api/ops/drivers/${id}/cash/settle`,
    DELIVERY_SETTINGS: '/api/ops/drivers/settings',
  },
};

export default API_ENDPOINTS;