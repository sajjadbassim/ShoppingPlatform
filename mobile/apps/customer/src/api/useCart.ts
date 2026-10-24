import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    clear: useMutation({ mutationFn: clearCart, onSuccess: () => queryClient.removeQueries({ queryKey: CART_KEY }) }),
  };
};
