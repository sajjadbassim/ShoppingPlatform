import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NOTIFICATION_RECEIVED, NotificationTypes } from '../stores/notificationsStore'
import { playChime } from '../utils/orderAlerts'

// إشعارات تغيّر طلبات المتجر أو أرقامه
const ORDER_TYPES = new Set([
  NotificationTypes.NEW_ORDER, NotificationTypes.ORDER_STATUS, NotificationTypes.SUB_ORDER, NotificationTypes.RETURN,
])

// لوحة التاجر: الإشعار اللحظي (SignalR) يحدّث الطلبات والأرقام فوراً بدل انتظار التحديث الدوري،
// والطلب الجديد يُنبَّه له بصوت — مهلة القبول دقائق قليلة
export const useVendorLiveOrders = (enabled) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const onNotification = (e) => {
      const n = e.detail
      if (!ORDER_TYPES.has(n?.type)) return
      queryClient.invalidateQueries({ queryKey: ['vendor-orders'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-dashboard'] })
      if (n.type === NotificationTypes.NEW_ORDER) playChime()
    }
    window.addEventListener(NOTIFICATION_RECEIVED, onNotification)
    return () => window.removeEventListener(NOTIFICATION_RECEIVED, onNotification)
  }, [enabled, queryClient])
}
