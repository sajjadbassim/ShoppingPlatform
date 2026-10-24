import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelOrder,
  connectNotifications,
  fetchOrder,
  fetchCustomerOrders,
  fetchOrderTracking,
  useSessionStore,
  type AuthUser,
} from '@wasit/shared';

const ORDERS_POLL_MS = 30 * 1000;

// كل طلبات الزبون من /api/Orders/customer (كما في الويب)؛ /paged لم يكن يُحمَّل في التطبيق
export const useOrders = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  return useQuery({
    queryKey: ['orders', user?.userId],
    queryFn: () => fetchCustomerOrders(user!.userId),
    enabled: signedIn && !!user?.userId,
    // حالة الطلب تتغير من المتجر والسائق: لا نبقيها 5 دقائق كباقي البيانات، ونحدّثها دورياً والشاشة ظاهرة
    staleTime: 0,
    refetchInterval: ORDERS_POLL_MS,
  });
};

export const useOrder = (id: string) =>
  useQuery({ queryKey: ['order', id], queryFn: () => fetchOrder(id), enabled: !!id, staleTime: 0, refetchInterval: ORDERS_POLL_MS });

export const useOrderTracking = (id: string) =>
  useQuery({ queryKey: ['order-tracking', id], queryFn: () => fetchOrderTracking(id), staleTime: 0, refetchInterval: ORDERS_POLL_MS });

export const useCancelOrder = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => cancelOrder(id, reason),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', id], order);
      queryClient.invalidateQueries({ queryKey: ['order-tracking', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

// تحديث حي: كل إشعار يصل يعيد جلب الطلبات المفتوحة. يُغلق الاتصال والتطبيق في الخلفية ويُعاد عند الرجوع (حسب الخطة)
export const useOrdersRealtime = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;

    let disconnect: (() => void) | null = null;
    const open = () => {
      disconnect?.();
      disconnect = connectNotifications(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['order-tracking'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      });
    };
    const close = () => {
      disconnect?.();
      disconnect = null;
    };

    if (AppState.currentState === 'active') open();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        open();
        // ما فات أثناء الخلفية
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order'] });
      } else close();
    });

    return () => {
      sub.remove();
      close();
    };
  }, [signedIn, queryClient]);
};
