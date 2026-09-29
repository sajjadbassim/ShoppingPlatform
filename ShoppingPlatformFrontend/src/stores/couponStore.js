import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCouponStore = create(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
      clear: () => set({ code: null }),
    }),
    {
      name: 'coupon-storage',
    }
  )
);

export default useCouponStore;
