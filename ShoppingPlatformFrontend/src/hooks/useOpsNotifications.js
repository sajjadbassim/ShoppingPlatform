// src/hooks/useOpsNotifications.js
import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/common/Toast'
import { useAuthStore } from '../stores/authStore'

export const useOpsNotifications = () => {
  const queryClient = useQueryClient()
  const { success } = useToast()
  const { token } = useAuthStore()
  const connectionRef = useRef(null)
  const isMounted = useRef(false)

  useEffect(() => {
    if (!token) return
    if (isMounted.current) return  // ← منع التشغيل مرتين
    isMounted.current = true

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5010'}/hubs/ops`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.None) // ← أوقف الـ logs
      .build()

    connectionRef.current = connection

    connection.on('NewSubOrder', (order) => {
      success(`🛍️ طلب جديد #${order.subOrderNumber} يحتاج تأكيد`)
      queryClient.invalidateQueries({ queryKey: ['ops'] })
    })

    connection.on('OrderStatusUpdated', () => {
      queryClient.invalidateQueries({ queryKey: ['ops'] })
    })

    connection.onclose(() => {
      isMounted.current = false
      connectionRef.current = null
    })

    connection.start()
      .then(() => console.log('✅ OpsHub connected'))
      .catch((err) => {
        console.error('❌ OpsHub error:', err)
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