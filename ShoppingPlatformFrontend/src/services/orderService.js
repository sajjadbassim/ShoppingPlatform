import { apiGet, apiPost } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const orderService = {

  // ===========================
  // Orders
  // ===========================

  /**
   * إنشاء طلب جديد — يُحدَّد المستخدم من التوكن في الباك اند، لا من الطلب
   * @param {Object} orderData - { addressId, customerNotes? }
   */
  create: async (orderData) => {
    const response = await apiPost(API_ENDPOINTS.ORDERS.BASE, orderData);
    return response.data.data || response.data;
  },

  /**
   * جلب طلب بالمعرف
   * @param {string} id
   */
  getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.ORDERS.BY_ID(id));
    return response.data.data;
  },

  /**
   * جلب طلب برقم الطلب
   * @param {string} orderNumber
   */
  getByNumber: async (orderNumber) => {
    const response = await apiGet(API_ENDPOINTS.ORDERS.BY_NUMBER(orderNumber));
    return response.data.data;
  },

  /**
   * جلب طلبات عميل معين
   * @param {string} customerId
   */
  getByCustomer: async (customerId) => {
    const response = await apiGet(API_ENDPOINTS.ORDERS.BY_CUSTOMER(customerId));
    return response.data.data;
  },

  /**
   * جلب الطلبات مع فلتر وpaging
   * @param {Object} params - { pageNumber, pageSize, customerId?, orderNumber?, status? }
   */
  getPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.ORDERS.PAGED, params)
    const raw = response.data
    // ✅ API يرجع { success, data: [...], pagination: {} }
    if (raw?.data && raw?.pagination) {
      return {
        items:       Array.isArray(raw.data) ? raw.data : [],
        totalPages:  raw.pagination.totalPages  ?? 1,
        totalCount:  raw.pagination.totalCount  ?? 0,
        currentPage: raw.pagination.currentPage ?? 1,
      }
    }
    return raw
  },

  // ===========================
  // ✅ جديد — إلغاء الطلب
  // ===========================

  /**
   * إلغاء طلب من قبل العميل
   * @param {string} orderId - معرف الطلب
   * @param {string} reason - سبب الإلغاء
   */
  cancel: async (orderId, reason) => {
    const response = await apiPost(API_ENDPOINTS.ORDERS.CANCEL(orderId), {
      reason,
    });
    return response.data.data || response.data;
  },

  // ===========================
  // ✅ جديد — تتبع الطلب
  // ===========================

  /**
   * جلب بيانات تتبع الطلب من الـ API
   * @param {string} orderId - معرف الطلب
   */
  getTracking: async (orderId) => {
    const response = await apiGet(API_ENDPOINTS.ORDERS.TRACKING(orderId));
    return response.data.data || response.data;
  },

  // ===========================
  // ✅ جديد — الفاتورة
  // ===========================

  /**
   * جلب بيانات الفاتورة
   * @param {string} orderId - معرف الطلب
   */
  getInvoice: async (orderId) => {
    const response = await apiGet(API_ENDPOINTS.INVOICE.GET(orderId));
    return response.data.data || response.data;
  },

  /**
   * معاينة الفاتورة (HTML أو PDF)
   * @param {string} orderId - معرف الطلب
   */
  getInvoicePreview: async (orderId) => {
    const response = await apiGet(API_ENDPOINTS.INVOICE.PREVIEW(orderId));
    return response.data.data || response.data;
  },

  // ===========================
  // Helpers
  // ===========================

  /**
   * قائمة حالات الطلب
   */
  getStatuses: () => [
    { value: 'PENDING_CONFIRMATION', label: 'قيد الانتظار', color: 'yellow' },
    { value: 'CONFIRMED',            label: 'مؤكد',          color: 'blue'   },
    { value: 'PARTIALLY_CONFIRMED',  label: 'مؤكد جزئياً',   color: 'cyan'   },
    { value: 'PREPARING',            label: 'قيد التحضير',   color: 'indigo' },
    { value: 'OUT_FOR_DELIVERY',     label: 'قيد التوصيل',   color: 'purple' },
    { value: 'DELIVERED',            label: 'تم التوصيل',    color: 'green'  },
    { value: 'CANCELLED',            label: 'ملغي',           color: 'red'    },
  ],

  /**
   * لون حالة الطلب
   * @param {string} status
   */
  getStatusColor: (status) => {
    const colors = {
      PENDING_CONFIRMATION: 'yellow',
      CONFIRMED:            'blue',
      PARTIALLY_CONFIRMED:  'cyan',
      PREPARING:            'indigo',
      OUT_FOR_DELIVERY:     'purple',
      DELIVERED:            'green',
      CANCELLED:            'red',
    };
    return colors[status] || 'gray';
  },

  /**
   * نص حالة الطلب بالعربي
   * @param {string} status
   */
  getStatusLabel: (status) => {
    const labels = {
      PENDING_CONFIRMATION: 'قيد الانتظار',
      CONFIRMED:            'مؤكد',
      PARTIALLY_CONFIRMED:  'مؤكد جزئياً',
      PREPARING:            'قيد التحضير',
      OUT_FOR_DELIVERY:     'قيد التوصيل',
      DELIVERED:            'تم التوصيل',
      CANCELLED:            'ملغي',
    };
    return labels[status] || status;
  },

  /**
   * هل يمكن إلغاء الطلب؟
   * @param {string} status
   */
  canCancel: (status) => {
    return ['PENDING_CONFIRMATION'].includes(status?.toUpperCase());
  },

  /**
   * هل تم توصيل الطلب؟
   * @param {string} status
   */
  isDelivered: (status) => {
    return status?.toUpperCase() === 'DELIVERED';
  },
};

export default orderService;