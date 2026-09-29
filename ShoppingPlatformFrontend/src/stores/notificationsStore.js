import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { notificationsService } from '../services';

/**
 * Notifications Store - متجر الإشعارات
 * ✅ مدفوع بالـ API الحقيقي (NotificationsController)، وليس محليًا فقط.
 * addNotification تُستخدم فقط لإدخال إشعار وصل لحظيًا عبر SignalR.
 */
export const useNotificationsStore = create(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,

      // جلب الإشعارات من الخادم
      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          const data = await notificationsService.getAll(30);
          set({
            notifications: (data?.notifications ?? []).map(formatNotification),
            unreadCount: data?.unreadCount ?? 0,
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      // إدخال إشعار وصل لحظيًا عبر SignalR (محفوظ بالفعل بقاعدة البيانات من الخادم)
      addNotification: (notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        }));
        return notification;
      },

      // تحديد إشعار كمقروء
      markAsRead: async (notificationId) => {
        set((state) => {
          const notifications = state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          );
          const unreadCount = notifications.filter(n => !n.isRead).length;
          return { notifications, unreadCount };
        });
        try {
          await notificationsService.markAsRead(notificationId);
        } catch {
          get().fetchNotifications();
        }
      },

      // تحديد جميع الإشعارات كمقروءة
      markAllAsRead: async () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
        try {
          await notificationsService.markAllAsRead();
        } catch {
          get().fetchNotifications();
        }
      },

      // حذف إشعار
      removeNotification: async (notificationId) => {
        const previous = get().notifications;
        set((state) => {
          const notification = state.notifications.find(n => n.id === notificationId);
          const unreadDelta = notification && !notification.isRead ? -1 : 0;
          return {
            notifications: state.notifications.filter(n => n.id !== notificationId),
            unreadCount: Math.max(0, state.unreadCount + unreadDelta),
          };
        });
        try {
          await notificationsService.remove(notificationId);
        } catch {
          set({ notifications: previous });
        }
      },

      // مسح كل الإشعارات (المقروءة تُحذف فعليًا من الخادم، والباقي محليًا)
      clearAll: async () => {
        set({ notifications: [], unreadCount: 0 });
        try {
          await notificationsService.deleteAllRead();
        } catch {
          get().fetchNotifications();
        }
      },

      // الحصول على الإشعارات غير المقروءة
      getUnreadNotifications: () => {
        return get().notifications.filter(n => !n.isRead);
      },
    }),
    {
      name: 'wasit-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);

// أنواع الإشعارات — مطابقة لثوابت NotificationType في الباك اند (Core/Constants/NotificationType.cs)
export const NotificationTypes = {
  ORDER_STATUS: 'order_status',
  NEW_ORDER: 'new_order',
  SUB_ORDER: 'sub_order',
  RETURN: 'return',
  PROMOTION: 'promotion',
  REVIEW: 'review',
  LOW_STOCK: 'low_stock',
  NEW_USER: 'new_user',
  NEW_VENDOR: 'new_vendor',
  GENERAL: 'general',
};

const TYPE_META = {
  [NotificationTypes.REVIEW]: { title: 'تقييم جديد', icon: '⭐' },
  [NotificationTypes.LOW_STOCK]: { title: 'نقص المخزون', icon: '📉' },
  [NotificationTypes.NEW_USER]: { title: 'مستخدم جديد', icon: '👤' },
  [NotificationTypes.NEW_VENDOR]: { title: 'متجر جديد', icon: '🏪' },
  [NotificationTypes.ORDER_STATUS]: { title: 'تحديث الطلب', icon: '📦' },
  [NotificationTypes.NEW_ORDER]: { title: 'طلب جديد', icon: '🛍️' },
  [NotificationTypes.SUB_ORDER]: { title: 'طلب فرعي', icon: '📋' },
  [NotificationTypes.RETURN]: { title: 'طلب إرجاع', icon: '↩️' },
  [NotificationTypes.PROMOTION]: { title: 'عرض جديد', icon: '🎉' },
  [NotificationTypes.GENERAL]: { title: 'إشعار', icon: '🔔' },
};

/**
 * يحوّل إشعارًا واردًا من الخادم (REST أو SignalR) لشكل قابل للعرض بالواجهة
 */
export const formatNotification = (raw) => {
  const meta = TYPE_META[raw.type] || TYPE_META[NotificationTypes.GENERAL];
  return {
    id: raw.id,
    type: raw.type,
    title: meta.title,
    icon: meta.icon,
    message: raw.message,
    data: raw.data,
    isRead: raw.isRead ?? false,
    createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
  };
};

export default useNotificationsStore;
