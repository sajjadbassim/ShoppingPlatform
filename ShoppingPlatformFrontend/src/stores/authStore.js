import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';

/**
 * Auth Store - إدارة حالة المصادقة
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // الحالة
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // تسجيل الدخول
login: async (credentials) => {
  set({ isLoading: true, error: null });
  try {
    const data = await authService.login(credentials);
    localStorage.setItem('accessToken', data.token) // ← تأكد موجود

    // ✅ الحل: data نفسه يحتوي على بيانات المستخدم
    const user = {
      id: data.userId,
      userId: data.userId,
      vendorId: data.vendorId || null,
      phone: data.phone,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
    };
    
    set({
      user: user,           // ← user المعدّل
      token: data.token,
      isAuthenticated: true,
      isLoading: false,
    });
    return { user, token: data.token };
  } catch (error) {
    set({ isLoading: false, error: error.message });
    throw error;
  }
},


      // تسجيل حساب جديد
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authService.register(userData);
          localStorage.setItem('accessToken', data.token) // ← أضف هذا
                    
          // ✅ data يحتوي على بيانات المستخدم مباشرة (مثل login)
          const user = {
            id: data.userId,
            userId: data.userId,
            phone: data.phone,
            fullName: data.fullName,
            email: data.email,
            role: data.role,
          };
          
          set({
            user: user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return { user, token: data.token };
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // تسجيل الخروج
      logout: () => {
        localStorage.removeItem('accessToken');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // تحديث بيانات المستخدم
      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },

      // جلب بيانات المستخدم الحالي
      fetchCurrentUser: async () => {
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({ user, isLoading: false });
          return user;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // تغيير كلمة المرور
      changePassword: async (passwords) => {
        set({ isLoading: true, error: null });
        try {
          await authService.changePassword(passwords);
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // مسح الخطأ
      clearError: () => set({ error: null }),

      // التحقق من الدور
      hasRole: (role) => get().user?.role === role,
      
      // التحقق من أدوار متعددة
      hasAnyRole: (roles) => roles.includes(get().user?.role),
    }),
    {
      name: 'user',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;