import api, { apiGet, apiPost } from '../api/axios';
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

  /**
   * فتح فاتورة PDF في تبويب جديد (الزبون والعمليات والأدمن).
   * الفاتورة تحتاج التوكن فلا يكفي رابط مباشر: تُجلب ثم تُفتح من الذاكرة.
   * التبويب يُفتح فوراً عند النقر كي لا يمنعه المتصفح كنافذة منبثقة.
   */
  openInvoice: async (orderId) => {
    const win = window.open('', '_blank');
    try {
      const res = await api.get(API_ENDPOINTS.INVOICE.PREVIEW(orderId), { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (e) {
      win?.close();
      // رسالة الخطأ تصل كـ Blob مع responseType: 'blob'
      if (e?.status && typeof Blob !== 'undefined') e.message = e.status === 400 ? 'الفاتورة متاحة فقط للطلبات المسلّمة' : 'تعذّر فتح الفاتورة';
      throw e;
    }
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
    { value: 'READY',                label: 'جاهز للاستلام', color: 'teal' },
    { value: 'OUT_FOR_DELIVERY',     label: 'قيد التوصيل',   color: 'purple' },
    { value: 'DELIVERED',            label: 'تم التوصيل',    color: 'green'  },
    { value: 'DELIVERY_FAILED',      label: 'تعذّر التسليم',  color: 'orange' },
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
      READY:                'teal',
      OUT_FOR_DELIVERY:     'purple',
      DELIVERED:            'green',
      CANCELLED:            'red',
      DELIVERY_FAILED:      'orange',
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
      READY:                'جاهز للاستلام',
      OUT_FOR_DELIVERY:     'قيد التوصيل',
      DELIVERED:            'تم التوصيل',
      CANCELLED:            'ملغي',
      DELIVERY_FAILED:      'تعذّر التسليم',
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