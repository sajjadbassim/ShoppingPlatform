import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartService } from '../services';
import { useAuthStore } from './authStore';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      cartData: null,
      isLoading: false,
      error: null,

      fetchCart: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await cartService.get();
          set({ items: data.items || [], cartData: data, isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      addItem: async (productId, quantity = 1, variantId = null) => {
        set({ isLoading: true, error: null });
        try {
          const payload = { productId, quantity };
          if (variantId) payload.variantId = variantId;
          const data = await cartService.addItem(payload);
          set({ items: data.items || [], cartData: data, isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      updateQuantity: async (productId, quantity, variantId = null) => {
        set({ isLoading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.userId || useAuthStore.getState().user?.id;
          const payload = { productId, quantity };
          if (variantId) payload.variantId = variantId;
          const data = await cartService.updateItem(payload, userId);
          set({ items: data.items || [], cartData: data, isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      // ✅ يقبل الآن variantId لحذف المنتج الصحيح
      removeItem: async (productId, variantId = null) => {
        set({ isLoading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.userId || useAuthStore.getState().user?.id;

          // ✅ إذا لم يُمرر variantId، ابحث عنه في الـ items الحالية
          let resolvedVariantId = variantId
          if (!resolvedVariantId) {
            const currentItems = get().items
            const item = currentItems.find(i => i.productId === productId)
            resolvedVariantId = item?.variantId || null
          }

          await cartService.removeItem(productId, userId, resolvedVariantId);
          const data = await cartService.get();
          set({ items: data.items || [], cartData: data, isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      clearCart: async () => {
        set({ isLoading: true, error: null });
        try {
          const userId = useAuthStore.getState().user?.userId || useAuthStore.getState().user?.id;
          await cartService.clear(userId);
          set({ items: [], cartData: null, isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      clearLocalCart: () => set({ items: [], cartData: null, error: null }),

      getTotal: () =>
        get().items.reduce((total, item) => total + (item.price * item.quantity), 0),

      getItemsCount: () =>
        get().items.reduce((count, item) => count + item.quantity, 0),

      isInCart: (productId) =>
        get().items.some(item => item.productId === productId),

      getItemQuantity: (productId) => {
        const item = get().items.find(i => i.productId === productId);
        return item ? item.quantity : 0;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export default useCartStore;