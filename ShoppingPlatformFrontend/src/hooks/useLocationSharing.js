// src/hooks/useLocationSharing.js
// مشاركة موقع السائق مع العمليات ما دامت الصفحة مفتوحة (نفس منطق صفحة الرابط)
import { useEffect, useRef, useState } from 'react'

const SEND_EVERY_MS = 10000     // أقصى معدل إرسال
const KEEPALIVE_MS = 30000      // إعادة إرسال آخر موقع حتى لو لم يتحرك السائق
const STORAGE_KEY = 'driver-share-location'

export const useLocationSharing = (sendLocation) => {
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [lastSent, setLastSent] = useState(null)
  const watchRef = useRef(null)
  const lastPosRef = useRef(null)
  const lastSentAtRef = useRef(0)
  const wakeLockRef = useRef(null)
  const sendRef = useRef(sendLocation)
  sendRef.current = sendLocation

  const send = async (pos, force = false) => {
    const now = Date.now()
    if (!force && now - lastSentAtRef.current < SEND_EVERY_MS) return
    lastSentAtRef.current = now
    try {
      await sendRef.current({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy })
      setLastSent(new Date())
      setError('')
    } catch {
      setError('تعذّر إرسال الموقع — تحقق من الإنترنت، سنحاول مجدداً')
    }
  }

  // إبقاء الشاشة مضاءة — المتصفح يوقف الموقع عندما تنطفئ الشاشة
  const keepAwake = async () => {
    try { wakeLockRef.current = await navigator.wakeLock?.request('screen') } catch { /* غير مدعوم */ }
  }

  const start = () => {
    if (!('geolocation' in navigator)) { setError('هذا المتصفح لا يدعم تحديد الموقع'); return }
    setError('')
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { lastPosRef.current = pos; send(pos) },
      (err) => {
        setError(err.code === 1
          ? 'لم تسمح بالوصول للموقع. اسمح للموقع من إعدادات المتصفح ثم شغّل المشاركة مجدداً.'
          : 'تعذّر تحديد موقعك — تأكد من تشغيل GPS')
        if (err.code === 1) stop()
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    setSharing(true)
    keepAwake()
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* */ }
  }

  function stop() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
    setSharing(false)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
  }

  // استئناف المشاركة تلقائياً إن كانت مفعّلة قبل إعادة فتح اللوحة
  useEffect(() => {
    let wanted = false
    try { wanted = localStorage.getItem(STORAGE_KEY) === '1' } catch { /* */ }
    if (wanted) start()
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      wakeLockRef.current?.release?.().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sharing) return
    const t = setInterval(() => { if (lastPosRef.current) send(lastPosRef.current, true) }, KEEPALIVE_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') keepAwake() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing])

  return { sharing, error, lastSent, start, stop }
}
