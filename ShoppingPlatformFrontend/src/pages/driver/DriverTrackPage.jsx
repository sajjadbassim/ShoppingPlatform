// src/pages/driver/DriverTrackPage.jsx
// صفحة السائق: يفتح الرابط الذي أرسلته العمليات ويشارك موقعه ما دامت الصفحة مفتوحة.
// بلا تسجيل دخول — الرمز في الرابط هو الصلاحية.
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Navigation, Square, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const SEND_EVERY_MS = 10000     // أقصى معدل إرسال
const KEEPALIVE_MS = 30000      // إعادة إرسال آخر موقع حتى لو لم يتحرك السائق

const DriverTrackPage = () => {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [invalid, setInvalid] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [lastSent, setLastSent] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [, setTick] = useState(0)

  const watchRef = useRef(null)
  const lastPosRef = useRef(null)
  const lastSentAtRef = useRef(0)
  const wakeLockRef = useRef(null)

  useEffect(() => {
    apiGet(API_ENDPOINTS.DRIVER_TRACKING.INFO(token))
      .then(r => setInfo(r.data?.data ?? r.data))
      .catch(() => setInvalid(true))
  }, [token])

  // تحديث نص "منذ ..." كل 5 ثوانٍ
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 5000); return () => clearInterval(t) }, [])

  const send = async (pos, force = false) => {
    const now = Date.now()
    if (!force && now - lastSentAtRef.current < SEND_EVERY_MS) return
    lastSentAtRef.current = now
    try {
      await apiPost(API_ENDPOINTS.DRIVER_TRACKING.LOCATION(token), {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy,
      })
      setLastSent(new Date())
      setError('')
    } catch (err) {
      if (err?.response?.status === 404 || err?.status === 404) { stop(); setInvalid(true) }
      else setError('تعذّر الإرسال — تحقق من الإنترنت، سنحاول مجدداً')
    }
  }

  // إبقاء الشاشة مضاءة — المتصفح يوقف الموقع عندما تنطفئ الشاشة أو تُغلق الصفحة
  const keepAwake = async () => {
    try { wakeLockRef.current = await navigator.wakeLock?.request('screen') } catch { /* غير مدعوم */ }
  }

  const start = () => {
    if (!('geolocation' in navigator)) { setError('هذا المتصفح لا يدعم تحديد الموقع'); return }
    setError('')
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { lastPosRef.current = pos; setAccuracy(Math.round(pos.coords.accuracy)); send(pos) },
      (err) => {
        setError(err.code === 1
          ? 'لم تسمح بالوصول للموقع. من إعدادات المتصفح اسمح لهذا الموقع بالوصول للموقع ثم اضغط «ابدأ» مجدداً.'
          : 'تعذّر تحديد موقعك — تأكد من تشغيل GPS')
        if (err.code === 1) stop()
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    setSharing(true)
    keepAwake()
  }

  function stop() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
    setSharing(false)
  }

  // إعادة الإرسال الدوري + استعادة إبقاء الشاشة عند العودة للصفحة
  useEffect(() => {
    if (!sharing) return
    const t = setInterval(() => { if (lastPosRef.current) send(lastPosRef.current, true) }, KEEPALIVE_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') keepAwake() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing])

  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const ago = lastSent ? Math.round((Date.now() - lastSent.getTime()) / 1000) : null

  if (invalid) return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
      <AlertTriangle size={44} className="text-amber-500" />
      <p className="mt-4 text-lg font-bold text-gray-900">الرابط غير صالح أو تم إيقافه</p>
      <p className="mt-1 text-sm text-gray-500">اطلب رابطاً جديداً من فريق العمليات</p>
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col p-5 pt-[max(1.25rem,env(safe-area-inset-top))]" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center font-bold">و</span>
        <div>
          <p className="text-xs text-gray-500">مشاركة الموقع مع العمليات</p>
          <p className="font-bold text-gray-900">{info ? `أهلاً ${info.driverName}` : '...'}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-8">
        <button onClick={sharing ? stop : start} disabled={!info}
          className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 text-white font-bold text-lg shadow-2xl transition-transform active:scale-95 disabled:opacity-50 ${
            sharing ? 'bg-green-600 shadow-green-600/40' : 'bg-primary shadow-primary/40'}`}>
          {sharing && <span className="absolute inset-0 rounded-full bg-green-500 motion-safe:animate-soft-ping" aria-hidden="true" />}
          <span className="relative flex flex-col items-center gap-2">
            {sharing ? <Navigation size={44} /> : <MapPin size={44} />}
            {sharing ? 'موقعك يُرسل' : 'ابدأ المشاركة'}
          </span>
        </button>

        {sharing ? (
          <div className="space-y-1.5">
            <p className="text-sm text-green-700 font-bold flex items-center justify-center gap-1.5">
              {lastSent ? <><CheckCircle2 size={16} />آخر إرسال {ago < 5 ? 'الآن' : `منذ ${ago} ثانية`}</> : <><RefreshCw size={15} className="animate-spin" />جاري تحديد موقعك...</>}
            </p>
            {accuracy != null && <p className="text-xs text-gray-500">دقة الموقع ± {accuracy} م</p>}
            <button onClick={stop} className="mt-3 inline-flex items-center gap-1.5 h-10 px-5 rounded-full border border-gray-300 text-gray-700 text-sm font-bold">
              <Square size={14} />إيقاف المشاركة
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 max-w-xs">اضغط الزر واسمح بالوصول للموقع. العمليات ترى موقعك على الخريطة لتوزيع الطلبات عليك.</p>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 max-w-sm">{error}</p>}
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
        <p className="font-bold">مهم</p>
        <p>• أبقِ هذه الصفحة مفتوحة أثناء العمل — إن أغلقتها أو أطفأت الشاشة يتوقف الإرسال.</p>
        <p>• يُحفظ آخر موقع فقط، ولا يُسجَّل مسارك.</p>
      </div>
    </div>
  )
}

export default DriverTrackPage
