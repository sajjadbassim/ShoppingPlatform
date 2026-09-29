// src/hooks/useNotificationsRealtime.js
import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../stores/authStore'
import { useNotificationsStore, formatNotification } from '../stores/notificationsStore'

const HUB_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5010'}/hubs/notifications`

/**
 * يتصل بـ NotificationHub ليصل الإشعار لحظيًا (بلا تحديث للصفحة)
 * مبني لكل مستخدم مسجّل دخول (زبون/بائع/أدمن/عمليات)، على عكس useOpsNotifications
 * المخصص فقط للوحة العمليات.
 */
export const useNotificationsRealtime = () => {
  const { token } = useAuthStore()
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const connectionRef = useRef(null)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!token) return
    if (isMounted.current) return
    isMounted.current = true

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
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
    connection.on('OrderStatusChanged', (payload) =>
      handleIncoming({ ...payload, type: 'order_status' })
    )

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
  }, [token])
}

export default useNotificationsRealtime
