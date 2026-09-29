import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI Store - إدارة حالة واجهة المستخدم
 */
export const useUIStore = create(
  persist(
    (set, get) => ({
      // الحالة
      sidebarOpen: true,
      theme: 'light',
      language: 'ar',
      notifications: [],

      // فتح/إغلاق الشريط الجانبي
      toggleSidebar: () => {
        set({ sidebarOpen: !get().sidebarOpen });
      },

      setSidebarOpen: (isOpen) => {
        set({ sidebarOpen: isOpen });
      },

      // تغيير الثيم
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      // تغيير اللغة
      setLanguage: (language) => {
        set({ language });
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      },

      // إدارة الإشعارات
      addNotification: (notification) => {
        const id = Date.now();
        set({
          notifications: [
            ...get().notifications,
            { id, ...notification },
          ],
        });
        
        // إزالة الإشعار تلقائياً بعد 5 ثواني
        if (notification.autoClose !== false) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration || 5000);
        }
        
        return id;
      },

      removeNotification: (id) => {
        set({
          notifications: get().notifications.filter(n => n.id !== id),
        });
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // إشعارات مختصرة
      showSuccess: (message) => {
        return get().addNotification({ type: 'success', message });
      },

      showError: (message) => {
        return get().addNotification({ type: 'error', message });
      },

      showWarning: (message) => {
        return get().addNotification({ type: 'warning', message });
      },

      showInfo: (message) => {
        return get().addNotification({ type: 'info', message });
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);

export default useUIStore;
