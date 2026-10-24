import { create } from 'zustand';

// الكوبون المطبَّق في السلة يُستعاد تلقائياً في إتمام الطلب (couponStore في الويب). في الذاكرة فقط
interface CouponState {
  code: string;
  setCode: (code: string) => void;
  clear: () => void;
}

export const useCouponStore = create<CouponState>((set) => ({
  code: '',
  setCode: (code) => set({ code }),
  clear: () => set({ code: '' }),
}));
