import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activityFrom,
  confirmOrder,
  deleteCoupon,
  deletePromotion,
  fetchActivity,
  fetchAllCategories,
  fetchCoupons,
  fetchMyEarnings,
  fetchOrderCounts,
  fetchProductSales,
  fetchPromotions,
  fetchSalesStats,
  fetchStaff,
  fetchVendorDashboard,
  fetchVendorOrder,
  fetchVendorOrders,
  fetchVendorProducts,
  fetchVendorProfile,
  fetchVendorReturnTrips,
  fetchVendorReviewSummary,
  fetchVendorReviews,
  markReady,
  markReturnTripReceived,
  rejectOrder,
  startPreparing,
  type SalesPeriod,
  type UnavailableItem,
} from '@wasit/shared';
import { useVendorId } from '../lib/vendor';

// طلبات المتجر الجديدة تظهر وحدها: لا يوجد إشعار فوري للتاجر بعد (الخادم يسجّل جهاز الزبون والمندوب فقط)، فنحدّث كل دقيقة
const POLL_MS = 60 * 1000;

export const useProfile = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-profile', vendorId], queryFn: () => fetchVendorProfile(vendorId), enabled: !!vendorId, staleTime: 5 * 60 * 1000 });
};

export const useDashboard = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-dashboard', vendorId], queryFn: () => fetchVendorDashboard(vendorId), enabled: !!vendorId, refetchInterval: POLL_MS });
};

export const useOrderCounts = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-orders', vendorId, 'counts'], queryFn: () => fetchOrderCounts(vendorId), enabled: !!vendorId, refetchInterval: POLL_MS });
};

export const useOrders = (status: string, search: string) => {
  const vendorId = useVendorId();
  return useInfiniteQuery({
    queryKey: ['v-orders', vendorId, 'list', status, search],
    queryFn: ({ pageParam }) => fetchVendorOrders(vendorId, { status: status === 'all' ? undefined : status, search: search || undefined, pageNumber: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
    enabled: !!vendorId,
    refetchInterval: POLL_MS,
  });
};

export const useOrder = (subOrderId: string) => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-orders', vendorId, 'one', subOrderId], queryFn: () => fetchVendorOrder(vendorId, subOrderId), enabled: !!vendorId && !!subOrderId, refetchInterval: POLL_MS });
};

export const useReturnTrips = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-return-trips', vendorId], queryFn: () => fetchVendorReturnTrips(vendorId), enabled: !!vendorId, refetchInterval: POLL_MS });
};

// أي عملية على طلب تغيّر القوائم والأعداد والرئيسية والأرباح
export const useRefreshOrders = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['v-orders', 'v-dashboard', 'v-return-trips', 'v-earnings', 'v-products'])
      queryClient.invalidateQueries({ queryKey: [key] });
  };
};

export const useOrderActions = () => {
  const vendorId = useVendorId();
  const refresh = useRefreshOrders();
  const opts = { onSuccess: refresh };
  return {
    confirm: useMutation({ mutationFn: (v: { id: string; unavailable?: UnavailableItem[] }) => confirmOrder(vendorId, v.id, v.unavailable), ...opts }),
    reject: useMutation({ mutationFn: (v: { id: string; reason: string }) => rejectOrder(vendorId, v.id, v.reason), ...opts }),
    preparing: useMutation({ mutationFn: (id: string) => startPreparing(vendorId, id), ...opts }),
    ready: useMutation({ mutationFn: (id: string) => markReady(vendorId, id), ...opts }),
    received: useMutation({ mutationFn: (tripId: string) => markReturnTripReceived(vendorId, tripId), ...opts }),
  };
};

export const useProducts = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-products', vendorId], queryFn: () => fetchVendorProducts(vendorId), enabled: !!vendorId, staleTime: 2 * 60 * 1000 });
};

export const useProductSales = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-product-sales', vendorId], queryFn: () => fetchProductSales(vendorId), enabled: !!vendorId, staleTime: 5 * 60 * 1000 });
};

export const useCategories = () => useQuery({ queryKey: ['categories-all'], queryFn: fetchAllCategories, staleTime: 30 * 60 * 1000 });

export const useSales = (period: SalesPeriod, range?: { from: string; to: string }) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['v-sales', vendorId, period, period === 'custom' ? range : null],
    queryFn: () => fetchSalesStats(vendorId, period, range),
    enabled: !!vendorId && (period !== 'custom' || (!!range && range.from <= range.to)),
    staleTime: 3 * 60 * 1000,
  });
};

export const useEarnings = () => useQuery({ queryKey: ['v-earnings'], queryFn: fetchMyEarnings });

export const useReviewSummary = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-review-summary', vendorId], queryFn: () => fetchVendorReviewSummary(vendorId), enabled: !!vendorId });
};

export const useReviews = (unanswered: boolean) => {
  const vendorId = useVendorId();
  return useInfiniteQuery({
    queryKey: ['v-reviews', vendorId, unanswered],
    queryFn: ({ pageParam }) => fetchVendorReviews(vendorId, { unanswered: unanswered || undefined, pageNumber: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
    enabled: !!vendorId,
  });
};

export const usePromotions = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-promotions', vendorId], queryFn: () => fetchPromotions(vendorId), enabled: !!vendorId });
};

export const useCoupons = () => {
  const vendorId = useVendorId();
  return useQuery({ queryKey: ['v-coupons', vendorId], queryFn: () => fetchCoupons(vendorId), enabled: !!vendorId });
};

export const useDeleteMarketing = () => {
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: 'promotion' | 'coupon'; id: string }) => (v.kind === 'promotion' ? deletePromotion(vendorId, v.id) : deleteCoupon(vendorId, v.id)),
    onSuccess: () => {
      for (const key of ['v-promotions', 'v-coupons', 'v-products']) queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
};

export const useStaff = () => useQuery({ queryKey: ['v-staff'], queryFn: fetchStaff });

export const useActivity = (opts: { kind?: 'AUTH' | 'ACTION'; failedLoginsOnly?: boolean; days: number | null; mine: boolean; search: string }) =>
  useInfiniteQuery({
    queryKey: ['v-activity', opts],
    queryFn: ({ pageParam }) =>
      fetchActivity({ page: pageParam, kind: opts.kind, failedLoginsOnly: opts.failedLoginsOnly || undefined, from: activityFrom(opts.days), mine: opts.mine || undefined, search: opts.search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length + 1 : undefined),
  });
