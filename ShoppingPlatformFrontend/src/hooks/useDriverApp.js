// src/hooks/useDriverApp.js
// لوحة السائق + إدارة حسابات السائقين ونقدهم من العمليات
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data

export const driverKeys = {
  me: ['driver-app', 'me'],
  orders: (history) => ['driver-app', 'orders', history ? 'history' : 'active'],
  cash: (driverId) => ['drivers', 'cash', driverId],
}

export const useDriverProfile = () => useQuery({
  queryKey: driverKeys.me,
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVER_APP.ME)),
  refetchInterval: 30000,
})

// بضاعة مرتجعة معه لم تُسلَّم لمتاجرها — محطة لكل متجر
export const useMyReturnTrips = (enabled) => useQuery({
  queryKey: [...driverKeys.me, 'returns'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVER_APP.MY_RETURNS)),
  enabled,
  refetchInterval: 60000,
})

// تفصيل النقد الذي بعهدة السائق لكل طلب — يُحمَّل عند فتحه فقط
export const useMyDriverCash = (enabled) => useQuery({
  queryKey: [...driverKeys.me, 'cash'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVER_APP.MY_CASH)),
  enabled,
})

// الطلبات الحالية تتحدث كل 20 ثانية ليرى السائق الطلبات الجديدة دون تحديث الصفحة
export const useMyDriverOrders = (history = false) => useQuery({
  queryKey: driverKeys.orders(history),
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVER_APP.ORDERS, { history })) || [],
  refetchInterval: history ? false : 20000,
})

const useDriverMutation = (fn) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-app'] }),
  })
}

export const useSetDriverWorkStatus = () =>
  useDriverMutation(async (workStatus) => unwrap(await apiPut(API_ENDPOINTS.DRIVER_APP.WORK_STATUS, { workStatus })))

export const usePickUpStop = () =>
  useDriverMutation(async (subOrderId) => unwrap(await apiPost(API_ENDPOINTS.DRIVER_APP.PICKED_UP(subOrderId))))

// مرتجع بعد الاستلام: أخذ القطع من الزبون، أو تعذّر أخذها
export const useCollectReturn = () =>
  useDriverMutation(async (returnId) => unwrap(await apiPost(API_ENDPOINTS.DRIVER_APP.RETURN_PICKED_UP(returnId))))

export const useFailReturnPickup = () =>
  useDriverMutation(async ({ returnId, note }) => unwrap(await apiPost(API_ENDPOINTS.DRIVER_APP.RETURN_PICKUP_FAILED(returnId), { note })))

export const useDeliverOrder = () =>
  useDriverMutation(async ({ orderId, ...body }) =>
    unwrap(await apiPost(API_ENDPOINTS.DRIVER_APP.DELIVERED(orderId), body)))

export const useFailOrder = () =>
  useDriverMutation(async ({ orderId, ...body }) =>
    unwrap(await apiPost(API_ENDPOINTS.DRIVER_APP.FAILED(orderId), body)))

// ===== للعمليات =====
export const useDeliverySettings = () => useQuery({
  queryKey: ['delivery-settings'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVERS.DELIVERY_SETTINGS)),
})

export const useUpdateDeliverySettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data) => unwrap(await apiPut(API_ENDPOINTS.DRIVERS.DELIVERY_SETTINGS, data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-settings'] }),
  })
}

export const useSetDriverAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ driverId, password }) => unwrap(await apiPut(API_ENDPOINTS.DRIVERS.ACCOUNT(driverId), { password })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  })
}

export const useDriverCash = (driverId) => useQuery({
  queryKey: driverKeys.cash(driverId),
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVERS.CASH(driverId))),
  enabled: !!driverId,
})

export const useSettleDriverCash = () => {
  const qc = useQueryClient()
  return useMutation({
    // المبلغ المعروض يُرسل مع الطلب: إن تغيّر نقد السائق أثناء فتح النافذة يرفض الخادم (409)
    mutationFn: async ({ driverId, expectedAmount }) => unwrap(await apiPost(API_ENDPOINTS.DRIVERS.SETTLE_CASH(driverId), { expectedAmount })),
    onError: (_, { driverId }) => qc.invalidateQueries({ queryKey: driverKeys.cash(driverId) }),
    onSuccess: (_, { driverId }) => {
      qc.invalidateQueries({ queryKey: driverKeys.cash(driverId) })
      qc.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}
