import { apiGet, apiPut, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * User Service - خدمة المستخدمين
 */
export const userService = {
  /**
   * الحصول على جميع المستخدمين
   */
  getAll: async () => {
    const response = await apiGet(API_ENDPOINTS.USERS.BASE);
    return response.data.data;
  },

  /**
   * الحصول على المستخدمين مع التصفح
   * @param {Object} params - معاملات البحث
   * @param {string} [params.role] - الدور
   * @param {string} [params.searchTerm] - نص البحث
   * @param {boolean} [params.isActive] - نشط
   * @param {number} [params.pageNumber=1] - رقم الصفحة
   * @param {number} [params.pageSize=20] - حجم الصفحة
   */
  getPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.USERS.PAGED, params);
    return response.data.data;
  },

  /**
   * الحصول على مستخدم بالمعرف
   * @param {string} id - معرف المستخدم
   */
 getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.USERS.BY_ID(id));
    return response.data.data;
  },

  /**
   * الحصول على مستخدم برقم الهاتف
   * @param {string} phone - رقم الهاتف
   */
  getByPhone: async (phone) => {
    const response = await apiGet(API_ENDPOINTS.USERS.BY_PHONE(phone));
    return response.data.data;
  },

  /**
   * الحصول على مستخدمين بدور معين
   * @param {string} role - الدور
   */
  getByRole: async (role) => {
    const response = await apiGet(API_ENDPOINTS.USERS.BY_ROLE(role));
    return response.data.data;
  },

  /**
   * تحديث بيانات مستخدم
   * @param {string} id - معرف المستخدم
   * @param {Object} userData - البيانات المحدثة
   * @param {string} [userData.fullName] - الاسم الكامل
   * @param {string} [userData.email] - البريد الإلكتروني
   */
  update: async (id, userData) => {
    const response = await apiPut(API_ENDPOINTS.USERS.BY_ID(id), userData);
    return response.data.data;
  },

  /**
   * تفضيلات المستخدم الحالي (اللغة، المظهر، العملة، الإشعارات) — محفوظة في قاعدة البيانات
   */
  getMyPreferences: async () => {
    const response = await apiGet(API_ENDPOINTS.USERS.MY_PREFERENCES);
    return response.data.data;
  },

  /**
   * تحديث جزئي لتفضيلات المستخدم الحالي — الحقول غير المُرسلة لا تتغير
   * @param {Object} preferences - مثال: { theme: 'dark', notifyNewOrders: false }
   */
  updateMyPreferences: async (preferences) => {
    const response = await apiPut(API_ENDPOINTS.USERS.MY_PREFERENCES, preferences);
    return response.data.data;
  },

  /**
   * حذف مستخدم
   * @param {string} id - معرف المستخدم
   */
  delete: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.USERS.BY_ID(id));
    return response.data.data;
  },

  /**
   * الحصول على الأدوار المتاحة
   */
  getRoles: () => {
    return [
      { value: 'Customer', label: 'عميل' },
      { value: 'Vendor', label: 'بائع' },
      { value: 'Admin', label: 'مدير' },
      { value: 'Ops', label: 'عمليات' },
    ];
  },

  /**
   * الحصول على نص الدور بالعربي
   * @param {string} role - الدور
   */
  getRoleLabel: (role) => {
    const labels = {
      Customer: 'عميل',
      Vendor: 'بائع',
      Admin: 'مدير',
      Ops: 'عمليات',
    };
    return labels[role] || role;
  },
};

export default userService;
