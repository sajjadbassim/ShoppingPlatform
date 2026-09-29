import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { wishlistService } from '../services';

/**
 * Wishlist Store - إدارة قائمة المفضلة
 * ✅ إصلاح: wishlistService الآن يرجع البيانات مباشرة (بعد توحيد الـ return)
 *    لذا نقرأ data مباشرة بدون .data إضافية
 */
export const useWishlistStore = create(
  persist(
    (set, get) => ({
      // الحالة
      items: [],
      isLoading: false,
      error: null,

      // جلب المفضلات من الـ API
      fetchWishlist: async () => {
        set({ isLoading: true, error: null });
        try {
          // ✅ إصلاح: wishlistService.getAll() يرجع البيانات مباشرة
          const data = await wishlistService.getAll();
          set({ items: data || [], isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // إضافة منتج للمفضلة
      addItem: async (productId) => {
        set({ isLoading: true, error: null });
        try {
          await wishlistService.addItem(productId);
          await get().fetchWishlist();
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // إزالة منتج من المفضلة
      removeItem: async (productId) => {
        set({ isLoading: true, error: null });
        try {
          await wishlistService.removeItem(productId);
          await get().fetchWishlist();
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // تبديل حالة المنتج في المفضلة
      toggleItem: async (productId) => {
        set({ isLoading: true, error: null });
        try {
          await wishlistService.toggleItem(productId);
          await get().fetchWishlist();
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // التحقق إذا كان المنتج في المفضلة
      isInWishlist: (productId) => {
        return get().items.some(item => item.productId === productId);
      },

      // إفراغ المفضلة
      clearWishlist: async () => {
        set({ isLoading: true, error: null });
        try {
          await wishlistService.clear();
          set({ items: [], isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // الحصول على عدد العناصر
      getCount: () => get().items.length,

      // مسح الخطأ
      clearError: () => set({ error: null }),
    }),
    {
      name: 'wishlist-storage',
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);

export default useWishlistStore;