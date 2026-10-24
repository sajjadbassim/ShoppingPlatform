import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  addToCart,
  clearCart,
  countPieces,
  fetchCart,
  removeCartItem,
  updateCartItem,
  useSessionStore,
  type Cart,
} from '@wasit/shared';

const CART_KEY = ['cart'] as const;

// تفريغ السلة في الذاكرة فوراً (بعد إتمام الطلب أو إفراغها). invalidate/remove وحدهما لا يكفيان:
// شاشة السلة تبقى مفتوحة تحت الشاشات الأخرى ولا تعيد الجلب عند الرجوع إليها فتعرض القطع القديمة
export const emptyCartInMemory = (queryClient: QueryClient) => {
  queryClient.setQueryData<Cart>(CART_KEY, (old) =>
    old && {
      ...old,
      items: [],
      totalItems: 0,
      subtotal: 0,
      totalDeliveryFees: 0,
      totalAmount: 0,
      vendorsSummary: [],
      warnings: [],
      hasGroceryItems: false,
    },
  );
  queryClient.invalidateQueries({ queryKey: CART_KEY });
};

// السلة للزبون المسجّل فقط (الخادم يرفض غيره)
export const useCart = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: CART_KEY, queryFn: fetchCart, enabled: signedIn });
};

// عدد القطع في شارة السلة
export const useCartCount = (): number => {
  const { data } = useCart();
  return countPieces(data?.items);
};

// كل عملية تعيد السلة كاملة محسوبة من الخادم، فنضعها في الذاكرة مباشرة بلا طلب إضافي
export const useCartActions = () => {
  const queryClient = useQueryClient();
  const setCart = (cart: Cart) => queryClient.setQueryData(CART_KEY, cart);

  return {
    add: useMutation({ mutationFn: addToCart, onSuccess: setCart }),
    update: useMutation({ mutationFn: updateCartItem, onSuccess: setCart }),
    remove: useMutation({ mutationFn: removeCartItem, onSuccess: setCart }),
    clear: useMutation({ mutationFn: clearCart, onSuccess: () => emptyCartInMemory(queryClient) }),
  };
};
