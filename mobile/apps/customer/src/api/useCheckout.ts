import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAddress,
  deleteAddress,
  updateAddress,
  fetchAddresses,
  fetchDeliveryQuote,
  fetchDeliverySlots,
  fetchLoyaltyEstimate,
  fetchZonesConfig,
  useSessionStore,
  type AddressInput,
  type AuthUser,
} from '@wasit/shared';

const ADDRESSES_KEY = ['addresses'] as const;

export const useAddresses = () => {
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  return useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: () => fetchAddresses(user!.userId),
    enabled: !!user?.userId,
  });
};

export const useCreateAddress = () => {
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => createAddress(user!.userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
};

export const useUpdateAddress = () => {
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddressInput }) => updateAddress(id, user!.userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
};

export const useDeleteAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
};

// المواعيد تتبع أوقات متاجر السوبرماركت في السلة، فتُجلب عند الحاجة فقط
export const useDeliverySlots = (enabled: boolean) =>
  useQuery({ queryKey: ['delivery-slots'], queryFn: fetchDeliverySlots, enabled, staleTime: 60 * 1000 });

export const useLoyaltyEstimate = (orderAmount: number, enabled: boolean) =>
  useQuery({
    queryKey: ['loyalty-estimate', orderAmount],
    queryFn: () => fetchLoyaltyEstimate(orderAmount),
    enabled,
  });

// رسوم التوصيل حسب منطقة العنوان (تُجلب فقط حين يتبع متجر في السلة المناطق)
export const useDeliveryQuote = (addressId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['zones', 'quote', addressId],
    queryFn: () => fetchDeliveryQuote({ addressId }),
    enabled: enabled && !!addressId,
  });

export const useZonesConfig = () =>
  useQuery({ queryKey: ['zones'], queryFn: fetchZonesConfig, staleTime: 5 * 60 * 1000 });
