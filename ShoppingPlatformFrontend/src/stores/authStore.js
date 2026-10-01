import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';
import { detachPush } from '../utils/push';

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

      // جلسة جاهزة من الخادم (الدخول بـ Google) — نفس شكل login
      setSession: (data) => {
        localStorage.setItem('accessToken', data.token);
        const user = {
          id: data.userId,
          userId: data.userId,
          vendorId: data.vendorId || null,
          phone: data.phone,
          fullName: data.fullName,
          email: data.email,
          role: data.role,
        };
        set({ user, token: data.token, isAuthenticated: true, isLoading: false, error: null });
        return user;
      },

      // تسجيل الخروج
      logout: () => {
        detachPush(localStorage.getItem('accessToken'));
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

// ===== مزامنة الحساب بين التبويبات =====
// التوكن في localStorage مشترك بين كل تبويبات الموقع، لكن المستخدم المعروض محفوظ في ذاكرة كل تبويب.
// إن دخل حساب آخر (أو خرج) من تبويب ثانٍ، يصير هذا التبويب يرسل طلباته بحساب غير الذي يعرضه
// (مثلاً: عنوان الحساب الأول مع توكن الحساب الثاني ← «هذا العنوان غير مسجل باسمك»).
// لذلك نعيد تحميل التبويب ليأخذ الحساب الصحيح. تجديد التوكن لنفس الحساب لا يسبب إعادة تحميل.
const tokenUserId = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const id = payload.userId || payload.nameid
      || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
    return String(id || '').toLowerCase() || null;
  } catch {
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'accessToken' || e.oldValue === e.newValue) return;
    const current = String(useAuthStore.getState().user?.id || '').toLowerCase() || null;
    const next = e.newValue ? tokenUserId(e.newValue) : null;
    if (current !== next) window.location.reload();
  });
}

export default useAuthStore;