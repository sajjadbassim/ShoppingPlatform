// src/hooks/useOpsNotifications.js
// اتصال لحظي بشاشات العمليات/الإدارة (OpsHub): أي تغيير في الطلبات أو السائقين يحدّث
// الشاشات المفتوحة فوراً بدل انتظار التحديث اليدوي. يُشغَّل مرة واحدة من DashboardLayout.
import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/common/Toast'
import { useAuthStore } from '../stores/authStore'

// كل ما تعرضه شاشات العمليات من طلبات وسائقين وتتبع
const LIVE_KEYS = [['ops'], ['orders'], ['orders-status-counts'], ['drivers'], ['ops-tracking'], ['admin']]

export const useOpsNotifications = (enabled = true) => {
  const queryClient = useQueryClient()
  const { success } = useToast()
  const { token } = useAuthStore()
  const connectionRef = useRef(null)
  const refreshTimer = useRef(null)

  useEffect(() => {
    if (!enabled || !token || connectionRef.current) return

    // عدة أحداث متتالية (تسليم ← حالة الطلب ← حالة السائق) = تحديث واحد
    const refresh = () => {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        LIVE_KEYS.forEach(queryKey => queryClient.invalidateQueries({ queryKey }))
      }, 300)
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5010'}/hubs/ops`, {
        accessTokenFactory: () => useAuthStore.getState().token || token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build()
    connectionRef.current = connection

    connection.on('NewSubOrder', (order) => {
      success(`🛍️ طلب جديد #${order.subOrderNumber} يحتاج تأكيد`)
      refresh()
    })
    ;['NewOrder', 'SubOrderConfirmed', 'SubOrderCancelled', 'OrderStatusChanged', 'DriverUpdated']
      .forEach(event => connection.on(event, refresh))

    // بعد انقطاع الاتصال قد تكون فاتتنا أحداث
    connection.onreconnected(refresh)

    connection.start().catch(() => { connectionRef.current = null })

    return () => {
      clearTimeout(refreshTimer.current)
      connection.stop()
      connectionRef.current = null
    }
  }, [enabled, token, queryClient, success])
}
