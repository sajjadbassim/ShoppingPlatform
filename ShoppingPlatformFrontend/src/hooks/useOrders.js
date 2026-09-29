import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService, opsService } from '../services';
import { apiGet, apiPost } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

// ===========================
// Query Keys
// ===========================

export const orderKeys = {
  all: ['orders'],
  lists: () => [...orderKeys.all, 'list'],
  list: (filters) => [...orderKeys.lists(), filters],
  details: () => [...orderKeys.all, 'detail'],
  detail: (id) => [...orderKeys.details(), id],
  byCustomer: (customerId) => [...orderKeys.all, 'customer', customerId],
  tracking: (id) => [...orderKeys.all, 'tracking', id],   // ✅ جديد
  invoice: (id) => [...orderKeys.all, 'invoice', id],     // ✅ جديد
};

export const opsKeys = {
  all: ['ops'],
  suborders: () => [...opsKeys.all, 'suborders'],
  subordersList: (filters) => [...opsKeys.suborders(), filters],
  suborderDetail: (id) => [...opsKeys.suborders(), id],
  pending: () => [...opsKeys.suborders(), 'pending'],
  dashboard: () => [...opsKeys.all, 'dashboard'],
};

export const driverKeys = {
  all: ['drivers'],
  lists: (filters) => [...driverKeys.all, 'list', filters],
  detail: (id) => [...driverKeys.all, id],
  available: () => [...driverKeys.all, 'available'],
};

// ===========================
// Orders Hooks
// ===========================

/**
 * جلب الطلبات مع التصفح
 */
export const useOrdersPaged = (params = {}) => {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => orderService.getPaged(params),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useOrders = useOrdersPaged;

/**
 * جلب طلب بالمعرف
 */
export const useOrder = (id) => {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orderService.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * جلب طلب برقم الطلب
 */
export const useOrderByNumber = (orderNumber) => {
  return useQuery({
    queryKey: [...orderKeys.all, 'number', orderNumber],
    queryFn: () => orderService.getByNumber(orderNumber),
    enabled: !!orderNumber,
  });
};

/**
 * جلب طلبات عميل معين
 */
export const useCustomerOrders = (customerId) => {
  return useQuery({
    queryKey: orderKeys.byCustomer(customerId),
    queryFn: () => orderService.getByCustomer(customerId),
    enabled: !!customerId,
  });
};

/**
 * إنشاء طلب جديد
 */
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderData) => orderService.create(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
};

// ===========================
// ✅ جديد — إلغاء الطلب
// ===========================

/**
 * إلغاء طلب من قبل العميل
 * الاستخدام:
 *   const { mutateAsync: cancelOrder, isPending } = useCancelOrder()
 *   await cancelOrder({ orderId: order.id, reason: 'سبب الإلغاء' })
 */
export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }) => orderService.cancel(orderId, reason),
    onSuccess: (_, { orderId }) => {
      // تحديث بيانات الطلب المحدد + قائمة الطلبات
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

// ===========================
// ✅ جديد — تتبع الطلب
// ===========================

/**
 * جلب بيانات تتبع الطلب من الـ API
 * الاستخدام:
 *   const { data: tracking, isLoading } = useOrderTracking(order.id)
 */
export const useOrderTracking = (orderId) => {
  return useQuery({
    queryKey: orderKeys.tracking(orderId),
    queryFn: () => orderService.getTracking(orderId),
    enabled: !!orderId,
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // تحديث كل دقيقتين تلقائياً
    refetchOnWindowFocus: true,
  });
};

// ===========================
// ✅ جديد — الفاتورة
// ===========================

/**
 * جلب بيانات الفاتورة
 * الاستخدام:
 *   const { data: invoice, isLoading } = useInvoice(order.id)
 */
export const useInvoice = (orderId) => {
  return useQuery({
    queryKey: orderKeys.invoice(orderId),
    queryFn: () => orderService.getInvoice(orderId),
    enabled: !!orderId,
    staleTime: 5 * 60 * 1000, // الفاتورة لا تتغير كثيراً
    refetchOnWindowFocus: false,
  });
};

// ===========================
// Ops SubOrders Hooks
// ===========================

/**
 * جلب الطلبات الفرعية المعلقة
 */
export const usePendingSubOrders = () => {
  return useQuery({
    queryKey: opsKeys.pending(),
    queryFn: () => opsService.getPendingSubOrders(),
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 2 * 60 * 1000,
  });
};

/**
 * جلب الطلبات الفرعية مع فلتر وpaging
 */
export const useSubOrdersPaged = (params = {}) => {
  return useQuery({
    queryKey: opsKeys.subordersList(params),
    queryFn: () => opsService.getSubOrdersPaged(params),
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * جلب طلب فرعي بالمعرف
 */
export const useSubOrder = (id) => {
  return useQuery({
    queryKey: opsKeys.suborderDetail(id),
    queryFn: () => opsService.getSubOrderById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
};

/**
 * جلب إحصائيات لوحة التشغيل
 */
export const useOpsDashboardStats = () => {
  return useQuery({
    queryKey: opsKeys.dashboard(),
    queryFn: () => opsService.getDashboardStats(),
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

/**
 * تأكيد طلب فرعي
 */
export const useConfirmSubOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => opsService.confirmSubOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opsKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

/**
 * إلغاء طلب فرعي
 */
export const useCancelSubOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => opsService.cancelSubOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opsKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

/**
 * تحديث حالة الطلب الفرعي
 */
export const useUpdateSubOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => opsService.updateSubOrderStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opsKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
};

/**
 * تعيين سائق للطلب الفرعي
 */
export const useAssignDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => opsService.assignDriver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: opsKeys.all });
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};
/**
 * تعيين سائق لكامل الطلب دفعة وحدة
 */
export const useAssignDriverToOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }) => opsService.assignDriverToOrder(orderId, data),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: opsKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};
// ===========================
// Drivers Hooks
// ===========================

/**
 * جلب السائقين مع فلتر وpaging
 */
export const useDriversPaged = (params = {}) => {
  return useQuery({
    queryKey: driverKeys.lists(params),
    queryFn: () => opsService.getDriversPaged(params),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * جلب السائقين المتاحين
 */
export const useAvailableDrivers = () => {
  return useQuery({
    queryKey: driverKeys.available(),
    queryFn: () => opsService.getAvailableDrivers(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
};

/**
 * جلب سائق بالمعرف
 */
export const useDriver = (id) => {
  return useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: () => opsService.getDriverById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * إضافة سائق جديد
 */
export const useCreateDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => opsService.createDriver(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};

/**
 * تعديل بيانات سائق
 */
export const useUpdateDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => opsService.updateDriver(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: driverKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};

/**
 * تفعيل / إيقاف سائق
 */
export const useToggleDriverStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => opsService.toggleDriverStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};

/**
 * تحديث حالة عمل السائق
 */
export const useUpdateDriverWorkStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workStatus }) => opsService.updateDriverWorkStatus(id, workStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
};

/**
 * جلب طلبات سائق معين
 */
export const useDriverOrders = (driverId, params = {}) => {
  return useQuery({
    queryKey: [...driverKeys.all, driverId, 'orders', params],
    queryFn: () => opsService.getDriverOrders(driverId, params),
    enabled: !!driverId,
    staleTime: 1 * 60 * 1000,
  });
};

/**
 * جلب إحصائيات سائق معين
 */
export const useDriverStats = (driverId) => {
  return useQuery({
    queryKey: [...driverKeys.all, driverId, 'stats'],
    queryFn: () => opsService.getDriverStats(driverId),
    enabled: !!driverId,
    staleTime: 1 * 60 * 1000,
  });
};

// ===========================
// Order Rating Hooks
// ===========================

/**
 * جلب حالة تقييم الطلب (هل تم التقييم أم لا)
 */
export const useOrderRatingStatus = (orderId) => {
  return useQuery({
    queryKey: [...orderKeys.all, 'rating-status', orderId],
    queryFn: async () => {
      const response = await apiGet(API_ENDPOINTS.ORDER_RATING.STATUS(orderId))
      return response.data.data || response.data
    },
    enabled: !!orderId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * جلب تقييم الطلب
 */
export const useOrderRating = (orderId) => {
  return useQuery({
    queryKey: [...orderKeys.all, 'rating', orderId],
    queryFn: async () => {
      const response = await apiGet(API_ENDPOINTS.ORDER_RATING.GET(orderId))
      return response.data.data || response.data
    },
    enabled: !!orderId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * إنشاء تقييم للطلب
 * data: { deliveryRating, speedRating, packagingRating, wouldRecommend, deliveryComment?, subOrderRatings: [] }
 */
export const useCreateOrderRating = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, data }) => {
      const response = await apiPost(API_ENDPOINTS.ORDER_RATING.CREATE(orderId), data)
      return response.data.data || response.data
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: [...orderKeys.all, 'rating-status', orderId] })
      queryClient.invalidateQueries({ queryKey: [...orderKeys.all, 'rating', orderId] })
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}