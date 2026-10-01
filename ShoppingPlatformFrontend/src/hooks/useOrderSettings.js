// src/hooks/useOrderSettings.js
// مهلة تأكيد المتجر + الطلبات المتأخرة عنها
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data

// تحت ['ops'] حتى يتحدث مع أحداث العمليات اللحظية، ومع ذلك نفحص كل 30 ثانية لأن تجاوز المهلة لا يطلق حدثاً
export const useOverdueConfirmations = () => useQuery({
  queryKey: ['ops', 'overdue-confirmations'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.ORDER_SETTINGS.OVERDUE)) || [],
  refetchInterval: 30000,
})

export const useOrderSettings = () => useQuery({
  queryKey: ['order-settings'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.ORDER_SETTINGS.GET)),
})

export const useSetDeliveryThresholds = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fastMinutes, slowMinutes }) =>
      unwrap(await apiPut(API_ENDPOINTS.ORDER_SETTINGS.THRESHOLDS, { fastMinutes, slowMinutes })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order-settings'] })
      qc.invalidateQueries({ queryKey: ['orders', 'timings'] })
      qc.invalidateQueries({ queryKey: ['orders', 'timing'] })
    },
  })
}

export const useSetConfirmationTimeout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (minutes) => unwrap(await apiPut(API_ENDPOINTS.ORDER_SETTINGS.TIMEOUT, { minutes })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order-settings'] }),
  })
}
