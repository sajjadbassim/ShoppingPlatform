import { apiGet, apiPatch, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Notifications Service - خدمة الإشعارات
 */
export const notificationsService = {
  /**
   * جلب إشعارات المستخدم الحالي
   * @param {number} take
   */
  getAll: async (take = 20) => {
    const response = await apiGet(API_ENDPOINTS.NOTIFICATIONS.BASE, { take });
    return response.data.data ?? response.data;
  },

  /**
   * عدد الإشعارات غير المقروءة
   */
  getUnreadCount: async () => {
    const response = await apiGet(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
    return response.data.data?.unreadCount ?? 0;
  },

  /**
   * تحديد إشعار كمقروء
   * @param {string} id
   */
  markAsRead: async (id) => {
    const response = await apiPatch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
    return response.data.data ?? response.data;
  },

  /**
   * تحديد كل الإشعارات كمقروءة
   */
  markAllAsRead: async () => {
    const response = await apiPatch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
    return response.data.data ?? response.data;
  },

  /**
   * حذف إشعار محدد
   * @param {string} id
   */
  remove: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id));
    return response.data.data ?? response.data;
  },

  /**
   * حذف كل الإشعارات المقروءة
   */
  deleteAllRead: async () => {
    const response = await apiDelete(API_ENDPOINTS.NOTIFICATIONS.DELETE_READ);
    return response.data.data ?? response.data;
  },
};

export default notificationsService;
