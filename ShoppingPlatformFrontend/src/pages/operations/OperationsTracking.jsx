// src/pages/operations/OperationsTracking.jsx
// التتبع المباشر: خريطة بمواقع السائقين (من رابط المشاركة) ووجهات الطلبات + قوائم التوصيلات والسائقين.
// المواقع تصل لحظياً عبر OpsHub، والقوائم تتحدث كل 20 ثانية.
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as signalR from '@microsoft/signalr'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Truck, Package, Store, Phone, Link2, X, Copy, MessageCircle, MapPin, Clock, Radio, Unlink,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiGet, apiPost, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const KUT = [32.5128, 45.8182] // مركز افتراضي: الكوت
const LIVE_MS = 2 * 60 * 1000   // موقع أحدث من دقيقتين = مباشر
const STALE_MS = 15 * 60 * 1000

const STAGES = {
  OUT_FOR_DELIVERY: { label: 'في الطريق', chip: 'bg-purple-100 text-purple-800', lateAfter: 45 },
  READY_FOR_DRIVER: { label: 'جاهز — ينتظر سائقاً', chip: 'bg-primary/10 text-primary', lateAfter: 15 },
  WAITING_STORES: { label: 'عند المتاجر', chip: 'bg-amber-100 text-amber-800', lateAfter: 30 },
}

const minutesSince = (d) => d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : null
const fmtMin = (m) => m == null ? '—' : m < 60 ? `${m} د` : `${Math.floor(m / 60)} س ${m % 60} د`
const shortNum = (n) => (n || '').replace(/^ORD-\d{4}(\d{4})-(\d+)$/, '$1-$2')
const waLink = (phone, text) => {
  const d = (phone || '').replace(/\D/g, '')
  const intl = d.startsWith('0') ? '964' + d.slice(1) : d
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}

const freshness = (at) => {
  if (!at) return { key: 'none', label: 'لم يشارك موقعه', dot: 'bg-gray-300', color: '#9ca3af' }
  const age = Date.now() - new Date(at).getTime()
  if (age < LIVE_MS) return { key: 'live', label: 'مباشر', dot: 'bg-green-500', color: '#16a34a' }
  if (age < STALE_MS) return { key: 'recent', label: `منذ ${Math.round(age / 60000)} د`, dot: 'bg-amber-400', color: '#f59e0b' }
  return { key: 'stale', label: `آخر ظهور ${fmtMin(Math.round(age / 60000))}`, dot: 'bg-gray-400', color: '#6b7280' }
}

// علامات الخريطة بـ HTML (بلا صور — تجنباً لمشكلة أيقونات Leaflet مع Vite)
const driverIcon = (driver) => L.divIcon({
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `<div style="width:40px;height:40px;border-radius:9999px;background:${freshness(driver.lastLocationAt).color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px">${(driver.fullName || '?').trim().charAt(0)}</div>`,
})
const destinationIcon = (label) => L.divIcon({
  className: '',
  iconSize: [56, 28],
  iconAnchor: [28, 28],
  html: `<div style="background:#111827;color:#fff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);direction:ltr">📦 ${label}</div>`,
})

// تحريك الخريطة لعنصر مختار
const FlyTo = ({ target }) => {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target, 15, { duration: 0.8 }) }, [target, map])
  return null
}

// ضبط الخريطة لتشمل كل النقاط أول مرة فقط
const FitOnce = ({ points }) => {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || points.length === 0) return
    done.current = true
    if (points.length === 1) map.setView(points[0], 14)
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
  }, [points, map])
  return null
}

// ===========================
// نافذة رابط التتبع للسائق
// ===========================
const LinkSheet = ({ driver, onClose, onChanged }) => {
  const { success, error: showError } = useToast()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const r = await apiPost(API_ENDPOINTS.OPS.TRACKING_LINK(driver.id))
      const token = (r.data?.data ?? r.data).token
      setUrl(`${window.location.origin}/driver/track/${token}`)
      onChanged()
    } catch (e) { showError(e.message || 'تعذّر إنشاء الرابط') }
    finally { setBusy(false) }
  }

  const revoke = async () => {
    if (!confirm(`إيقاف مشاركة موقع ${driver.fullName}؟ الرابط الحالي سيتوقف عن العمل.`)) return
    setBusy(true)
    try { await apiDelete(API_ENDPOINTS.OPS.TRACKING_LINK(driver.id)); success('تم إيقاف الرابط'); onChanged(); onClose() }
    catch (e) { showError(e.message || 'تعذّر الإيقاف') }
    finally { setBusy(false) }
  }

  const message = `مرحباً ${driver.fullName}، افتح هذا الرابط أثناء العمل واضغط «ابدأ المشاركة» حتى نرى موقعك ونوزع عليك الطلبات:\n${url}`

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="font-bold text-gray-900">رابط تتبع {driver.fullName}</p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mt-1">يفتحه السائق على هاتفه ويضغط «ابدأ المشاركة» — يظهر موقعه هنا مباشرة.</p>

        {url ? (
          <>
            <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 break-all" dir="ltr">{url}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => { navigator.clipboard?.writeText(url); success('تم نسخ الرابط') }}
                className="h-11 rounded-xl border border-gray-200 font-bold text-sm inline-flex items-center justify-center gap-1.5"><Copy size={15} />نسخ</button>
              <a href={waLink(driver.phone, message)} target="_blank" rel="noopener noreferrer"
                className="h-11 rounded-xl bg-green-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"><MessageCircle size={15} />إرسال بواتساب</a>
            </div>
            <p className="text-xs text-amber-700 mt-3">احتفظ بالرابط الآن — لا يمكن عرضه لاحقاً. إنشاء رابط جديد يُبطل هذا.</p>
          </>
        ) : (
          <button onClick={create} disabled={busy}
            className="w-full mt-4 h-12 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw size={17} className="animate-spin" /> : <Link2 size={17} />}
            {driver.hasTrackingLink ? 'إنشاء رابط جديد (يُبطل القديم)' : 'إنشاء الرابط'}
          </button>
        )}

        {driver.hasTrackingLink && (
          <button onClick={revoke} disabled={busy} className="w-full mt-2 h-10 text-sm text-red-600 font-medium inline-flex items-center justify-center gap-1.5">
            <Unlink size={14} />إيقاف المشاركة نهائياً
          </button>
        )}
      </div>
    </div>
  )
}

// ===========================
// الصفحة
// ===========================
const OperationsTracking = () => {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const [tab, setTab] = useState('deliveries')
  const [flyTarget, setFlyTarget] = useState(null)
  const [linkDriver, setLinkDriver] = useState(null)
  const [live, setLive] = useState(false)
  const [, setTick] = useState(0)

  const { data: board, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ops-tracking'],
    queryFn: async () => (await apiGet(API_ENDPOINTS.OPS.TRACKING)).data.data,
    refetchInterval: 20000,
  })
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  // المواقع لحظياً
  useEffect(() => {
    if (!token) return
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? ''}/hubs/ops`, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.None)
      .build()
    connection.on('DriverLocation', (loc) => {
      queryClient.setQueryData(['ops-tracking'], (b) => b && {
        ...b,
        drivers: b.drivers.map(d => d.id === loc.driverId
          ? { ...d, latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, lastLocationAt: loc.at }
          : d),
      })
    })
    connection.onreconnecting(() => setLive(false))
    connection.onreconnected(() => setLive(true))
    connection.onclose(() => setLive(false))
    connection.start().then(() => setLive(true)).catch(() => setLive(false))
    return () => { connection.stop() }
  }, [token, queryClient])

  const drivers = board?.drivers || []
  const deliveries = board?.deliveries || []
  const located = drivers.filter(d => d.latitude != null && d.longitude != null)
  const mappedDeliveries = deliveries.filter(d => d.latitude != null && d.longitude != null)
  const points = useMemo(() => [
    ...located.map(d => [d.latitude, d.longitude]),
    ...mappedDeliveries.map(d => [d.latitude, d.longitude]),
  ], [located, mappedDeliveries])
  const liveCount = drivers.filter(d => freshness(d.lastLocationAt).key === 'live').length
  const lateCount = deliveries.filter(d => minutesSince(d.stageSince) > STAGES[d.stage]?.lateAfter).length

  return (
    <div className="space-y-4">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            التتبع المباشر
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <Radio size={11} className={live ? 'motion-safe:animate-pulse' : ''} />{live ? 'متصل' : 'غير متصل'}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {liveCount} سائق مباشر · {deliveries.length} طلب نشط{lateCount > 0 && <span className="text-red-600 font-bold"> · {lateCount} متأخر</span>}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} aria-label="تحديث" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:gap-4 space-y-4 lg:space-y-0">
        {/* الخريطة */}
        <div className="relative h-[45dvh] lg:h-[calc(100dvh-10.5rem)] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 z-0">
          <MapContainer center={KUT} zoom={13} className="w-full h-full" zoomControl={false} attributionControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' maxZoom={19} />
            <FitOnce points={points} />
            <FlyTo target={flyTarget} />
            {located.map(d => (
              <Marker key={d.id} position={[d.latitude, d.longitude]} icon={driverIcon(d)}>
                <Tooltip direction="top" offset={[0, -18]}>{d.fullName} — {freshness(d.lastLocationAt).label}</Tooltip>
              </Marker>
            ))}
            {mappedDeliveries.map(d => (
              <Marker key={d.orderId} position={[d.latitude, d.longitude]} icon={destinationIcon(shortNum(d.orderNumber))}>
                <Tooltip direction="top" offset={[0, -26]}>{d.customerName} — {STAGES[d.stage]?.label}</Tooltip>
              </Marker>
            ))}
          </MapContainer>
          {!isLoading && located.length === 0 && (
            <div className="absolute bottom-3 inset-x-3 z-[500] rounded-xl bg-white/95 shadow-lg p-3 text-sm text-gray-700 flex items-start gap-2">
              <MapPin size={17} className="text-primary flex-shrink-0 mt-0.5" />
              <span>لا يوجد سائق يشارك موقعه الآن. من تبويب «السائقون» أرسل لكل سائق رابط التتبع ليظهر هنا.</span>
            </div>
          )}
        </div>

        {/* القوائم */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden lg:h-[calc(100dvh-10.5rem)] flex flex-col">
          <div className="grid grid-cols-2 p-1.5 gap-1.5 border-b border-gray-100">
            {[
              { key: 'deliveries', label: 'التوصيلات', n: deliveries.length },
              { key: 'drivers', label: 'السائقون', n: drivers.length },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`h-9 rounded-xl text-sm font-bold ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {t.label} ({t.n})
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : tab === 'deliveries' ? (
              deliveries.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400"><Package size={30} className="mx-auto mb-2 opacity-40" />لا توجد طلبات نشطة</p>
              ) : deliveries.map(d => {
                const stage = STAGES[d.stage] || STAGES.WAITING_STORES
                const mins = minutesSince(d.stageSince)
                const late = mins > stage.lateAfter
                const hasPin = d.latitude != null
                return (
                  <div key={d.orderId} className={`p-3.5 ${late ? 'bg-red-50/60' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900" dir="ltr">{shortNum(d.orderNumber)}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stage.chip}`}>{stage.label}</span>
                      <span className={`mr-auto text-xs font-bold inline-flex items-center gap-1 ${late ? 'text-red-600' : 'text-gray-500'}`}>
                        <Clock size={12} />{fmtMin(mins)}{late && ' · متأخر'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mt-1.5 truncate">{d.customerName || 'زبون'}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1"><MapPin size={11} className="flex-shrink-0" />{d.zoneName && <b className="text-gray-700">{d.zoneName} ·</b>}{d.address || '—'}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5"><Store size={11} className="flex-shrink-0" />{d.stores.join('، ')}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {d.driverName && <span className="text-xs text-purple-800 bg-purple-50 rounded-lg px-2 py-1 inline-flex items-center gap-1"><Truck size={12} />{d.driverName}</span>}
                      <span className="mr-auto flex items-center gap-1">
                        {hasPin && <button onClick={() => setFlyTarget([d.latitude, d.longitude])} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" title="على الخريطة"><MapPin size={15} className="text-primary" /></button>}
                        {d.customerPhone && <a href={`tel:${d.customerPhone}`} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" title="اتصال بالزبون"><Phone size={15} className="text-gray-600" /></a>}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              drivers.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">لا يوجد سائقون نشطون</p>
              ) : drivers.map(d => {
                const f = freshness(d.lastLocationAt)
                return (
                  <div key={d.id} className="p-3.5 flex items-center gap-3">
                    <button onClick={() => d.latitude != null && setFlyTarget([d.latitude, d.longitude])} disabled={d.latitude == null}
                      className="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 flex-shrink-0 disabled:cursor-default">
                      {d.fullName?.charAt(0)}
                      <span className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${f.dot}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{d.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {f.label}{d.activeDeliveries > 0 && ` · ${d.activeDeliveries} توصيل`}
                      </p>
                    </div>
                    <a href={`tel:${d.phone}`} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" title="اتصال"><Phone size={15} className="text-gray-600" /></a>
                    <button onClick={() => setLinkDriver(d)}
                      className={`h-8 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${d.hasTrackingLink ? 'bg-gray-100 text-gray-700' : 'bg-primary text-white'}`}>
                      <Link2 size={13} />{d.hasTrackingLink ? 'الرابط' : 'إرسال رابط'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {linkDriver && (
        <LinkSheet driver={linkDriver} onClose={() => setLinkDriver(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['ops-tracking'] })} />
      )}
    </div>
  )
}

export default OperationsTracking
