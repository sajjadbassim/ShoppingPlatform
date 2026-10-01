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
    mutationFn: async (driverId) => unwrap(await apiPost(API_ENDPOINTS.DRIVERS.SETTLE_CASH(driverId))),
    onSuccess: (_, driverId) => {
      qc.invalidateQueries({ queryKey: driverKeys.cash(driverId) })
      qc.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}
