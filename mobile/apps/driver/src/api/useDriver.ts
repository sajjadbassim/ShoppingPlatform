import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collectReturn,
  deliverOrder,
  failOrder,
  failReturnPickup,
  fetchDriverCash,
  fetchDriverOrders,
  fetchDriverProfile,
  fetchDriverReturns,
  pickUpStop,
  setWorkStatus,
  useSessionStore,
  type DeliverPayload,
  type FailPayload,
  type WorkStatus,
} from '@wasit/shared';

// الطلبات والمرتجعات تتجدد كل نصف دقيقة والتطبيق مفتوح؛ والإشعار الفوري يستدعي invalidate من المستمع
const POLL_MS = 30 * 1000;

export const useDriverProfile = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['driver-me'], queryFn: fetchDriverProfile, enabled: signedIn, refetchInterval: POLL_MS });
};

export const useDriverOrders = (history = false) => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({
    queryKey: ['driver-orders', history],
    queryFn: () => fetchDriverOrders(history),
    enabled: signedIn,
    refetchInterval: history ? false : POLL_MS,
  });
};

export const useDriverReturns = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['driver-returns'], queryFn: fetchDriverReturns, enabled: signedIn, refetchInterval: POLL_MS });
};

export const useDriverCash = () => {
  const signedIn = useSessionStore((s) => s.signedIn);
  return useQuery({ queryKey: ['driver-cash'], queryFn: fetchDriverCash, enabled: signedIn });
};

// أي عملية تغيّر الطلبات والملف والنقد معاً
export const useRefreshDriver = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['driver-me', 'driver-orders', 'driver-returns', 'driver-cash'])
      queryClient.invalidateQueries({ queryKey: [key] });
  };
};

export const useDriverActions = () => {
  const queryClient = useQueryClient();
  const refresh = useRefreshDriver();
  return {
    workStatus: useMutation({
      mutationFn: (status: WorkStatus) => setWorkStatus(status),
      onSuccess: (profile) => queryClient.setQueryData(['driver-me'], profile),
    }),
    pickUp: useMutation({ mutationFn: pickUpStop, onSuccess: refresh }),
    deliver: useMutation({ mutationFn: (v: { orderId: string; payload: DeliverPayload }) => deliverOrder(v.orderId, v.payload), onSuccess: refresh }),
    fail: useMutation({ mutationFn: (v: { orderId: string; payload: FailPayload }) => failOrder(v.orderId, v.payload), onSuccess: refresh }),
    collectReturn: useMutation({ mutationFn: collectReturn, onSuccess: refresh }),
    failReturn: useMutation({ mutationFn: (v: { returnId: string; note?: string }) => failReturnPickup(v.returnId, v.note), onSuccess: refresh }),
  };
};
