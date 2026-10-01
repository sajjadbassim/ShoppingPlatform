// src/hooks/useOrderTiming.js
// كم استغرق الطلب للوصول ومراحله
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data

export const useOrderTiming = (orderId) => useQuery({
  queryKey: ['orders', 'timing', orderId],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.ORDER_TIMING.BY_ID(orderId))),
  enabled: !!orderId,
})

// مدد قائمة طلبات دفعة واحدة → { [orderId]: { totalMinutes, elapsedMinutes, speed, slowestStage } }
export const useOrderTimings = (orderIds = []) => {
  const ids = [...new Set(orderIds.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['orders', 'timings', ids.join(',')],
    queryFn: async () => {
      const list = unwrap(await apiGet(API_ENDPOINTS.ORDER_TIMING.LIST, { ids: ids.join(',') })) || []
      return Object.fromEntries(list.map(t => [t.orderId, t]))
    },
    enabled: ids.length > 0,
    staleTime: 60000,
  })
}
