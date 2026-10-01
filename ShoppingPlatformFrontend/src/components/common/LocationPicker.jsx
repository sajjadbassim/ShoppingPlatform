// src/components/common/LocationPicker.jsx
// تحديد موقع باب المنزل على الخريطة (مثل تطبيقات التوصيل): الدبوس ثابت في المنتصف والزبون يحرّك الخريطة تحته.
// يُحفظ مع العنوان ويُنسخ للطلب، فيفتح السائق الملاحة إليه مباشرة.
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, LocateFixed, CheckCircle2, AlertTriangle } from 'lucide-react'

const KUT = [32.5128, 45.8182] // مركز افتراضي: الكوت
const PRECISE_ZOOM = 16         // أقل من هذا = الدبوس غير دقيق بما يكفي لباب منزل

const round = (n) => Math.round(n * 1e7) / 1e7

// يتابع حركة الخريطة: بعد أول تحريك من الزبون، كل توقف = موقع جديد للدبوس
const Tracker = ({ touched, onTouch, onMove, setZoom }) => {
  const map = useMapEvents({
    dragstart: onTouch,
    zoomstart: () => {},
    moveend: () => {
      setZoom(map.getZoom())
      if (touched.current) {
        const c = map.getCenter()
        onMove({ latitude: round(c.lat), longitude: round(c.lng) })
      }
    },
  })
  return null
}

// يحرّك الخريطة من الخارج (زر «موقعي الحالي»)
const Controller = ({ mapRef }) => {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

const LocationPicker = ({ value, onChange, error, height = 240 }) => {
  const mapRef = useRef(null)
  const touched = useRef(!!value)
  const [zoom, setZoom] = useState(value ? 17 : 13)
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const hasPin = value?.latitude != null && value?.longitude != null
  const center = hasPin ? [value.latitude, value.longitude] : KUT

  const locate = () => {
    if (!('geolocation' in navigator)) { setGpsError('المتصفح لا يدعم تحديد الموقع — حرّك الخريطة يدوياً'); return }
    setLocating(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        touched.current = true
        const target = [pos.coords.latitude, pos.coords.longitude]
        mapRef.current?.flyTo(target, 18, { duration: 0.8 })
        onChange({ latitude: round(target[0]), longitude: round(target[1]) })
      },
      (err) => {
        setLocating(false)
        setGpsError(err.code === 1
          ? 'لم تسمح بالوصول للموقع — حرّك الخريطة يدوياً أو اسمح بالموقع من إعدادات المتصفح'
          : 'تعذّر تحديد موقعك — تأكد من تشغيل GPS أو حرّك الخريطة يدوياً')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  return (
    <div className="space-y-2">
      <div className={`relative rounded-2xl overflow-hidden border-2 ${error ? 'border-red-400' : hasPin ? 'border-green-400' : 'border-gray-200'}`} style={{ height }}>
        <MapContainer center={center} zoom={zoom} className="w-full h-full z-0"
          zoomControl={false} attributionControl={false}
          // التكبير حول المنتصف حتى يبقى الدبوس على نفس النقطة
          scrollWheelZoom="center" touchZoom="center" doubleClickZoom="center">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          <Tracker touched={touched} onTouch={() => { touched.current = true }} onMove={onChange} setZoom={setZoom} />
          <Controller mapRef={mapRef} />
        </MapContainer>

        {/* الدبوس الثابت: رأسه يشير لمنتصف الخريطة تماماً */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-[500] flex flex-col items-center">
          <MapPin size={40} className={`drop-shadow-lg ${hasPin ? 'text-primary fill-primary/20' : 'text-gray-700 fill-white/60'}`} strokeWidth={2.2} />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 w-2 h-1 rounded-full bg-black/30 z-[499]" />

        {!hasPin && (
          <div className="pointer-events-none absolute top-2 inset-x-2 z-[500] text-center">
            <span className="inline-block bg-gray-900/80 text-white text-xs font-medium rounded-full px-3 py-1.5">
              حرّك الخريطة ليكون الدبوس على باب منزلك
            </span>
          </div>
        )}

        <button type="button" onClick={locate} disabled={locating}
          className="absolute bottom-3 right-3 z-[500] h-10 px-3 rounded-full bg-white text-gray-900 shadow-lg border border-gray-200 text-sm font-bold flex items-center gap-1.5 disabled:opacity-70">
          <LocateFixed size={17} className={`text-primary ${locating ? 'animate-pulse' : ''}`} />
          {locating ? 'جاري التحديد...' : 'موقعي الحالي'}
        </button>
      </div>

      {gpsError && <p className="text-xs text-amber-700 flex items-start gap-1"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />{gpsError}</p>}
      {error && !hasPin && <p className="text-xs text-red-600">{error}</p>}
      {hasPin && (
        zoom < PRECISE_ZOOM
          ? <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={13} /> قرّب الخريطة أكثر وتأكد أن الدبوس على بابك بالضبط</p>
          : <p className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 size={13} /> تم تحديد الموقع — سيصل السائق إليه مباشرة</p>
      )}
    </div>
  )
}

export default LocationPicker
