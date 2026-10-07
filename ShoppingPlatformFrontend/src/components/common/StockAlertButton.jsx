import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from './Toast'

// «أعلمني عند التوفر» لمنتج نافد (أو خيار محدد منه) — يصل إشعار مرة واحدة حين يعود للمخزون
const StockAlertButton = ({ productId, variantId = null, className = '', size = 'lg' }) => {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const params = variantId ? { variantId } : undefined
  const key = ['stock-alert', productId, variantId]

  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => (await apiGet(API_ENDPOINTS.PRODUCTS.STOCK_ALERT(productId), params)).data.data,
    enabled: isAuthenticated && !!productId,
  })
  const subscribed = !!data?.subscribed

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const url = API_ENDPOINTS.PRODUCTS.STOCK_ALERT(productId) + (variantId ? `?variantId=${variantId}` : '')
      return (subscribed ? await apiDelete(url) : await apiPost(url)).data
    },
    onSuccess: (res) => {
      queryClient.setQueryData(key, res.data)
      success(res.data?.subscribed ? 'سنُعلمك فور توفره 🔔' : 'تم إلغاء التنبيه')
    },
    onError: (err) => error(err.message || 'تعذّر حفظ التنبيه'),
  })

  const onClick = () => {
    if (!isAuthenticated) { navigate('/login', { state: { from: location.pathname } }); return }
    mutate()
  }

  const height = size === 'lg' ? 'h-12' : 'h-10 text-sm'
  return (
    <button type="button" onClick={onClick} disabled={isPending} aria-pressed={subscribed}
      className={`${height} px-5 rounded-full font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
        subscribed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-900 text-white hover:bg-gray-800'} ${className}`}>
      {subscribed ? <BellRing size={18} /> : <Bell size={18} />}
      {subscribed ? 'سنُعلمك عند التوفر — إلغاء' : 'أعلمني عند التوفر'}
    </button>
  )
}

export default StockAlertButton
