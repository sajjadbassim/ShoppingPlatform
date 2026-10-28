// src/hooks/useNotificationsRealtime.js
import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { getFreshAccessToken } from '../api/session'
import { useNotificationsStore, formatNotification } from '../stores/notificationsStore'
import { orderKeys } from './useOrders'

const HUB_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5010'}/hubs/notifications`

/**
 * يتصل بـ NotificationHub ليصل الإشعار لحظيًا (بلا تحديث للصفحة)
 * مبني لكل مستخدم مسجّل دخول (زبون/بائع/أدمن/عمليات)، على عكس useOpsNotifications
 * المخصص فقط للوحة العمليات.
 */
export const useNotificationsRealtime = () => {
  // الاتصال يتبع حالة الدخول لا قيمة التوكن: التجديد كل ساعة لا يعيد الاتصال (accessTokenFactory يجلب الحالي)
  const signedIn = useAuthStore((s) => !!s.token)
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const queryClient = useQueryClient()
  const connectionRef = useRef(null)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!signedIn) return
    if (isMounted.current) return
    isMounted.current = true

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: getFreshAccessToken,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.None)
      .build()

    connectionRef.current = connection

    const handleIncoming = (payload) => {
      addNotification(
        formatNotification({
          id: payload.id || Date.now().toString(),
          type: payload.type || 'general',
          message: payload.message,
          data: payload.data,
          isRead: false,
          createdAt: payload.timestamp,
        })
      )
    }

    connection.on('Notification', handleIncoming)
    // تغيّر حالة الطلب (تأكيد المتجر، التحضير، التوصيل…): نحدّث صفحة التفاصيل والتتبع والقوائم فوراً
    // بدل انتظار دورة الدقيقتين، ولا يكتفي الجرس بعرض الإشعار
    const refreshOrders = () => queryClient.invalidateQueries({ queryKey: orderKeys.all })
    connection.on('OrderStatusChanged', (payload) => {
      handleIncoming({ ...payload, type: 'order_status' })
      refreshOrders()
    })

    // بعد انقطاع الاتصال قد تكون فاتتنا أحداث
    connection.onreconnected(refreshOrders)

    connection.onclose(() => {
      isMounted.current = false
      connectionRef.current = null
    })

    connection.start().catch((err) => {
      console.error('❌ NotificationHub error:', err)
      isMounted.current = false
      connectionRef.current = null
    })

    return () => {
      connection.stop()
      isMounted.current = false
      connectionRef.current = null
    }
  }, [signedIn, queryClient])
}

export default useNotificationsRealtime
