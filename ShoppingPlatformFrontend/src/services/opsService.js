// src/services/opsService.js
import { apiGet, apiPost, apiPut } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const opsService = {

  // ===========================
  // SubOrders
  // ===========================

  /**
   * جلب الطلبات الفرعية المعلقة
   */
  getPendingSubOrders: async () => {
    const response = await apiGet(API_ENDPOINTS.OPS.PENDING_SUBORDERS);
    return response.data.data;
  },

  /**
   * جلب الطلبات الفرعية مع فلتر وpaging
   * @param {Object} params - { pageNumber, pageSize, status }
   */
  getSubOrdersPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.OPS.SUBORDERS_PAGED, params);
    return response.data.data;
  },

  /**
   * جلب طلب فرعي بالمعرف
   * @param {string} id
   */
  getSubOrderById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.OPS.SUBORDER_BY_ID(id));
    return response.data.data;
  },

  /**
   * تأكيد طلب فرعي
   * @param {string} id
   * @param {Object} data - { opsUserId, notes? }
   */
  confirmSubOrder: async (id, data) => {
    const response = await apiPut(API_ENDPOINTS.OPS.CONFIRM_SUBORDER(id), data);
    return response.data.data;
  },

  /**
   * إلغاء طلب فرعي
   * @param {string} id
   * @param {Object} data - { opsUserId, cancellationReason }
   */
  cancelSubOrder: async (id, data) => {
    const response = await apiPut(API_ENDPOINTS.OPS.CANCEL_SUBORDER(id), data);
    return response.data.data;
  },

  /**
   * تحديث حالة الطلب الفرعي
   * @param {string} id
   * @param {Object} data - { opsUserId, newStatus, notes? }
   */
  updateSubOrderStatus: async (id, data) => {
    const response = await apiPut(API_ENDPOINTS.OPS.UPDATE_SUBORDER_STATUS(id), data);
    return response.data.data;
  },

  /**
   * تعيين سائق للطلب الفرعي
   * @param {string} id
   * @param {Object} data - { driverId, opsUserId }
   */
  assignDriver: async (id, data) => {
    const response = await apiPut(API_ENDPOINTS.OPS.ASSIGN_DRIVER(id), data);
    return response.data.data;
  },
/**
   * تعيين سائق لكامل الطلب (كل الطلبات الفرعية دفعة وحدة)
   * @param {string} orderId
   * @param {Object} data - { driverId, opsUserId }
   */
  assignDriverToOrder: async (orderId, data) => {
    const response = await apiPut(API_ENDPOINTS.OPS.ASSIGN_DRIVER_TO_ORDER(orderId), data);
    return response.data.data;
  },
  // ===========================
  // Dashboard
  // ===========================

  /**
   * جلب إحصائيات لوحة التشغيل
   */
  getDashboardStats: async () => {
    const response = await apiGet(API_ENDPOINTS.OPS.DASHBOARD_STATS);
    return response.data.data;
  },

  // ===========================
  // Drivers
  // ===========================

  /**
   * جلب السائقين مع فلتر وpaging
   * @param {Object} params - { pageNumber, pageSize, status?, workStatus? }
   */
  getDriversPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.DRIVERS.PAGED, params);
    return response.data.data;
  },

  /**
   * جلب السائقين المتاحين
   */
  getAvailableDrivers: async () => {
    const response = await apiGet(API_ENDPOINTS.DRIVERS.AVAILABLE);
    return response.data.data;
  },

  /**
   * جلب سائق بالمعرف
   * @param {string} id
   */
  getDriverById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.DRIVERS.BY_ID(id));
    return response.data.data;
  },

  /**
   * إضافة سائق جديد
   * @param {Object} data - { fullName, phone, email?, vehicleType, workArea? }
   */
  createDriver: async (data) => {
    const response = await apiPost(API_ENDPOINTS.DRIVERS.CREATE, data);
    return response.data.data;
  },

  /**
   * تعديل بيانات سائق
   * @param {string} id
   * @param {Object} data - { fullName?, phone?, email?, vehicleType?, workArea? }
   */
  updateDriver: async (id, data) => {
    const response = await apiPut(API_ENDPOINTS.DRIVERS.UPDATE(id), data);
    return response.data.data;
  },

  /**
   * تفعيل / إيقاف سائق
   * @param {string} id
   */
  toggleDriverStatus: async (id) => {
    const response = await apiPut(API_ENDPOINTS.DRIVERS.TOGGLE_STATUS(id));
    return response.data.data;
  },

  /**
   * تحديث حالة عمل السائق
   * @param {string} id
   * @param {string} workStatus - available | delivering | break | offline
   */
  updateDriverWorkStatus: async (id, workStatus) => {
    const response = await apiPut(
      API_ENDPOINTS.DRIVERS.UPDATE_WORK_STATUS(id),
      { workStatus }
    );
    return response.data.data;
  },

  // ===========================
  // Helpers
  // ===========================

  /**
   * قائمة حالات الطلب الفرعي
   */
  getSubOrderStatuses: () => [
    { value: 'PENDING_CONFIRMATION', label: 'قيد الانتظار', color: 'yellow' },
    { value: 'CONFIRMED',            label: 'مؤكد',          color: 'blue'   },
    { value: 'PARTIALLY_CONFIRMED',  label: 'مؤكد جزئياً',   color: 'cyan'   },
    { value: 'PREPARING',            label: 'قيد التحضير',   color: 'indigo' },
    { value: 'OUT_FOR_DELIVERY',     label: 'قيد التوصيل',   color: 'purple' },
    { value: 'DELIVERED',            label: 'تم التوصيل',    color: 'green'  },
    { value: 'CANCELLED',            label: 'ملغي',           color: 'red'    },
  ],

  /**
   * لون حالة الطلب الفرعي
   * @param {string} status
   */
  getSubOrderStatusColor: (status) => {
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
   * نص حالة الطلب الفرعي بالعربي
   * @param {string} status
   */
  getSubOrderStatusLabel: (status) => {
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
   * قائمة حالات عمل السائق
   */
  getDriverWorkStatuses: () => [
    { value: 'available',  label: 'متاح',        color: 'green'  },
    { value: 'delivering', label: 'يوصل',         color: 'yellow' },
    { value: 'break',      label: 'استراحة',      color: 'gray'   },
    { value: 'offline',    label: 'غير متصل',     color: 'red'    },
  ],

  /**
   * نص حالة عمل السائق بالعربي
   * @param {string} workStatus
   */
  getDriverWorkStatusLabel: (workStatus) => {
    const labels = {
      available:  'متاح',
      delivering: 'يوصل',
      break:      'استراحة',
      offline:    'غير متصل',
    };
    return labels[workStatus] || workStatus;
  },

  /**
   * لون حالة عمل السائق
   * @param {string} workStatus
   */
  getDriverWorkStatusColor: (workStatus) => {
    const colors = {
      available:  'green',
      delivering: 'yellow',
      break:      'gray',
      offline:    'red',
    };
    return colors[workStatus] || 'gray';
  },
  getDriverOrders: async (driverId, params = {}) => {
  const response = await apiGet(API_ENDPOINTS.DRIVERS.ORDERS(driverId), params)
  return response.data.data
  },

  getDriverStats: async (driverId) => {
  const response = await apiGet(API_ENDPOINTS.DRIVERS.STATS(driverId))
  return response.data.data
  },


};

export default opsService;