// src/hooks/useDeliveryZones.js
// مناطق التوصيل: إدارة المناطق (الأدمن)، واختيارها في العنوان وحساب الرسوم (الزبون)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data
const Z = API_ENDPOINTS.DELIVERY_ZONES

// المناطق المفعّلة + المتاجر المشمولة — { enabled, mode, vendorIds, zones }
export const usePublicZones = () => useQuery({
  queryKey: ['zones', 'public'],
  queryFn: async () => unwrap(await apiGet(Z.BASE)) || { enabled: false, zones: [], vendorIds: [] },
  staleTime: 5 * 60 * 1000,
})

// هل يتبع هذا المتجر سعر المنطقة؟
export const vendorUsesZones = (config, vendorId) =>
  !!config?.enabled && (config.mode === 'ALL' || (config.mode === 'SELECTED' && config.vendorIds?.includes(vendorId)))

// رسوم توصيل السلة لعنوان محفوظ أو لمنطقة (عنوان جديد)
export const useDeliveryQuote = ({ addressId, zoneId, enabled = true }) => useQuery({
  queryKey: ['zones', 'quote', addressId || null, zoneId || null],
  queryFn: async () => {
    const qs = addressId ? `addressId=${addressId}` : zoneId ? `zoneId=${zoneId}` : ''
    return unwrap(await apiGet(`${Z.QUOTE}${qs ? `?${qs}` : ''}`))
  },
  enabled,
})

export const useZonesAdmin = () => useQuery({
  queryKey: ['zones', 'admin'],
  queryFn: async () => unwrap(await apiGet(Z.ADMIN)),
})

const useZonesMutation = (fn) => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }) })
}

export const useSetZonesMode = () => useZonesMutation(async (body) => unwrap(await apiPut(Z.MODE, body)))
export const useCreateZone = () => useZonesMutation(async (body) => unwrap(await apiPost(Z.BASE, body)))
export const useUpdateZone = () => useZonesMutation(async ({ id, ...body }) => unwrap(await apiPut(Z.BY_ID(id), body)))
export const useDeleteZone = () => useZonesMutation(async (id) => unwrap(await apiDelete(Z.BY_ID(id))))
