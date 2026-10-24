import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  fetchLoyaltyAccount,
  fetchLoyaltySettings,
  fetchLoyaltyTransactions,
  fetchReferral,
  fetchStockAlert,
  fetchWishlist,
  toggleStockAlert,
  toggleWishlist,
  useSessionStore,
  withoutWishlistProduct,
  type WishlistItem,
} from '@wasit/shared';

const WISHLIST_KEY = ['wishlist'] as const;

export const useWishlist = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: WISHLIST_KEY, queryFn: fetchWishlist, enabled: signedIn });
};

// الزائر يُحوَّل لتسجيل الدخول، والمسجّل يبدّل فوراً (متفائلاً) ثم يُصحَّح من الخادم
export const useWishlistToggle = () => {
  const queryClient = useQueryClient();
  const signedIn = useSessionStore((s) => s.signedIn);
  const { data } = useWishlist();
  const ids = useMemo(() => new Set((data ?? []).map((i) => i.productId)), [data]);

  const mutation = useMutation({
    mutationFn: toggleWishlist,
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = queryClient.getQueryData<WishlistItem[]>(WISHLIST_KEY);
      // الحذف متفائل. الإضافة تحتاج بيانات المنتج فتُجلب القائمة بعد النجاح
      if (previous?.some((i) => i.productId === productId)) {
        queryClient.setQueryData(WISHLIST_KEY, withoutWishlistProduct(previous, productId));
      }
      return { previous };
    },
    onError: (_e, _id, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });

  const toggle = useCallback(
    (productId: string) => {
      if (!signedIn) {
        router.push('/login');
        return;
      }
      mutation.mutate(productId);
    },
    [signedIn, mutation],
  );

  return { isWishlisted: (productId: string) => ids.has(productId), toggle };
};

export const useLoyaltyAccount = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['loyalty-account'], queryFn: fetchLoyaltyAccount, enabled: signedIn });
};

export const useReferral = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['referral'], queryFn: fetchReferral, enabled: signedIn });
};

export const useLoyaltyTransactions = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useInfiniteQuery({
    queryKey: ['loyalty-transactions'],
    queryFn: ({ pageParam }) => fetchLoyaltyTransactions(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasNext ? last.pagination.currentPage + 1 : undefined),
    enabled: signedIn,
  });
};

export const useStockAlert = (productId: string, variantId?: string | null) => {
  const signedIn = useSessionStore((s) => s.signedIn);
  const queryClient = useQueryClient();
  const key = ['stock-alert', productId, variantId ?? null];
  const status = useQuery({ queryKey: key, queryFn: () => fetchStockAlert(productId, variantId), enabled: signedIn && !!productId });
  const toggle = useMutation({
    mutationFn: () => toggleStockAlert(productId, variantId, !!status.data),
    onSuccess: (subscribed) => queryClient.setQueryData(key, subscribed),
  });
  return { subscribed: !!status.data, toggle };
};

export const useLoyaltySettings = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['loyalty-settings'], queryFn: fetchLoyaltySettings, enabled: signedIn, staleTime: 10 * 60 * 1000 });
};
