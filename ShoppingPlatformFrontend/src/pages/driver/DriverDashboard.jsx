// src/pages/driver/DriverDashboard.jsx
// لوحة السائق: طلباته الحالية، استلام من المتجر، التسليم وتأكيد المبلغ، حالته، ومشاركة موقعه
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Phone, MapPin, Navigation, Package, CheckCircle2, Store, Banknote, LogOut,
  Bell, Radio, RefreshCw, Clock, Star, ChevronDown, ChevronUp, StickyNote,
} from 'lucide-react'
import Modal from '../../components/common/Modal'
import PushPrompt, { PushDeviceRow } from '../../components/common/PushPrompt'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiPost } from '../../api/axios'
import { getImageUrl } from '../../utils/imageHelper'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useLocationSharing } from '../../hooks/useLocationSharing'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDriverProfile, useMyDriverOrders, useSetDriverWorkStatus, usePickUpStop, useDeliverOrder, useFailOrder,
} from '../../hooks/useDriverApp'

const money = (n) => `${Math.round(n || 0).toLocaleString()} د.ع`
const time = (d) => d ? new Date(d).toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' }) : ''

const WORK_STATUSES = [
  { value: 'available', label: 'متاح', dot: 'bg-green-500' },
  { value: 'break', label: 'استراحة', dot: 'bg-amber-500' },
  { value: 'offline', label: 'غير متصل', dot: 'bg-gray-400' },
]

const mapsUrl = (o) => (o.latitude && o.longitude)
  ? `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`

// ===========================
// بطاقة طلب حالي
// ===========================
const ActiveOrderCard = ({ order, onDeliver, onFail }) => {
  const { error: showError } = useToast()
  const { mutateAsync: pickUp, isPending, variables } = usePickUpStop()
  const [open, setOpen] = useState(true)
  const allPicked = order.stores.every(s => s.pickedUpAt)
  const paid = order.amountToCollect <= 0

  const handlePickUp = async (subOrderId) => {
    try { await pickUp(subOrderId) } catch (e) { showError(e.message || 'تعذّر التحديث') }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* الرأس: رقم الطلب والمبلغ */}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 text-right">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">{order.customerName}</p>
          <p className="text-xs text-gray-500 font-mono" dir="ltr">{order.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {paid
            ? <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">مدفوع</span>
            : <span className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">اجمع {money(order.amountToCollect)}</span>}
          {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* 1) الاستلام من المتاجر */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500">١. الاستلام من {order.stores.length > 1 ? `${order.stores.length} متاجر` : 'المتجر'}</p>
            {order.stores.map(s => (
              <div key={s.subOrderId} className={`flex items-center gap-3 rounded-xl p-3 border ${s.pickedUpAt ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <Store size={18} className={s.pickedUpAt ? 'text-green-600' : 'text-gray-500'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{s.vendorName}</p>
                  <p className="text-xs text-gray-500 truncate">{s.itemsCount} قطعة{s.vendorAddress ? ` · ${s.vendorAddress}` : ''}</p>
                </div>
                {s.vendorPhone && (
                  <a href={`tel:${s.vendorPhone}`} aria-label="اتصال بالمتجر" className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700">
                    <Phone size={16} />
                  </a>
                )}
                {s.pickedUpAt
                  ? <span className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle2 size={15} /> استلمت</span>
                  : (
                    <button type="button" onClick={() => handlePickUp(s.subOrderId)} disabled={isPending && variables === s.subOrderId}
                      className="h-9 px-3 rounded-full bg-gray-900 text-white text-xs font-bold disabled:opacity-60 whitespace-nowrap">
                      {isPending && variables === s.subOrderId ? '...' : 'استلمت'}
                    </button>
                  )}
              </div>
            ))}
          </div>

          {/* 2) التوصيل للزبون */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500">٢. التوصيل للزبون</p>
            <div className="rounded-xl border border-gray-200 p-3 space-y-1.5">
              <p className="text-sm text-gray-900 flex items-start gap-2">
                <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <span>{order.address}{order.addressDetails ? ` — ${order.addressDetails}` : ''}</span>
              </p>
              {order.latitude && order.longitude
                ? <p className="text-[11px] font-bold text-green-700 flex items-center gap-1"><CheckCircle2 size={12} /> موقع دقيق على الخريطة</p>
                : <p className="text-[11px] font-bold text-amber-700">لا يوجد موقع على الخريطة — اتصل بالزبون قبل الوصول</p>}
              {(order.addressNotes || order.customerNotes) && (
                <p className="text-xs text-gray-600 flex items-start gap-2">
                  <StickyNote size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{[order.addressNotes, order.customerNotes].filter(Boolean).join(' · ')}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {order.customerPhone
                ? <a href={`tel:${order.customerPhone}`} className="h-11 rounded-xl border border-gray-300 text-gray-800 text-sm font-bold flex items-center justify-center gap-2"><Phone size={16} /> اتصال</a>
                : <span className="h-11 rounded-xl border border-gray-200 text-gray-400 text-sm flex items-center justify-center">لا يوجد رقم</span>}
              <a href={mapsUrl(order)} target="_blank" rel="noreferrer" className="h-11 rounded-xl border border-gray-300 text-gray-800 text-sm font-bold flex items-center justify-center gap-2">
                <Navigation size={16} /> {order.latitude && order.longitude ? 'الملاحة' : 'بحث بالخريطة'}
              </a>
            </div>
          </div>

          <button type="button" onClick={() => onDeliver(order)}
            className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم التسليم
          </button>
          {!allPicked && <p className="text-[11px] text-gray-400 text-center -mt-2">يمكنك التسليم مباشرة — سيُسجّل الاستلام تلقائياً</p>}
          <button type="button" onClick={() => onFail(order)}
            className="w-full h-10 rounded-xl border border-orange-300 text-orange-700 text-sm font-bold">
            تعذّر التسليم
          </button>
        </div>
      )}
    </div>
  )
}

// ===========================
// نافذة تأكيد التسليم (+ المبلغ، + رفض جزئي عند الباب)
// ===========================
const REFUSAL_REASONS = [
  { value: 'not_as_described', label: 'لا يطابق الوصف' },
  { value: 'wrong_item', label: 'منتج خاطئ' },
  { value: 'defective', label: 'تالف' },
  { value: 'changed_mind', label: 'غيّر رأيه' },
  { value: 'other', label: 'أخرى' },
]

const Stepper = ({ value, max, onChange }) => (
  <div className="flex items-center gap-1 flex-shrink-0">
    <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}
      className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold disabled:opacity-30">−</button>
    <span className={`w-6 text-center font-bold ${value ? 'text-red-600' : 'text-gray-400'}`}>{value}</span>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
      className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold disabled:opacity-30">+</button>
  </div>
)

const DeliverSheet = ({ order, onClose, onFullRefusal }) => {
  const { success, error: showError } = useToast()
  const { mutateAsync: deliver, isPending } = useDeliverOrder()
  const [cash, setCash] = useState(false)
  const [refuseMode, setRefuseMode] = useState(false)
  const [refused, setRefused] = useState({})   // subOrderItemId → الكمية المرفوضة
  const [reason, setReason] = useState('')

  useEffect(() => { setCash(false); setRefuseMode(false); setRefused({}); setReason('') }, [order?.orderId])

  const items = (order?.stores || []).flatMap(s => s.items.map(i => ({ ...i, vendorName: s.vendorName })))
  const refusedLines = Object.entries(refused).filter(([, q]) => q > 0)
  const refusedValue = refusedLines.reduce((sum, [id, q]) => sum + (items.find(i => i.subOrderItemId === id)?.unitPrice || 0) * q, 0)
  const remainingPieces = items.reduce((n, i) => n + i.quantity - i.refusedQuantity, 0) - refusedLines.reduce((n, [, q]) => n + q, 0)
  const refusesAll = refusedLines.length > 0 && remainingPieces <= 0
  const hasRefusal = refuseMode && refusedLines.length > 0

  // أجرة التوصيل عند الرفض حسب إعداد المنصة: على الزبون (تبقى ضمن المبلغ) أو على المتجر/لا أحد (تُخصم)
  const partialPayer = order?.partialRefusalFeePayer || order?.refusalFeePayer
  const feeWaived = hasRefusal && partialPayer !== 'CUSTOMER' ? (order?.deliveryFee || 0) : 0
  const amount = order?.amountToCollect > 0 ? Math.max(0, order.amountToCollect - (hasRefusal ? refusedValue + feeWaived : 0)) : 0
  const needsCash = amount > 0
  const blocked = (needsCash && !cash) || refusesAll || (hasRefusal && !reason)

  // تغيّر المبلغ ← يجب تأكيد الاستلام من جديد
  useEffect(() => { setCash(false) }, [amount])

  const confirm = async () => {
    try {
      await deliver({
        orderId: order.orderId,
        cashCollected: needsCash ? cash : false,
        ...(hasRefusal ? {
          refusedItems: refusedLines.map(([subOrderItemId, quantity]) => ({ subOrderItemId, quantity })),
          refusalReason: reason,
        } : {}),
      })
      success(hasRefusal ? 'تم التسليم وتسجيل القطع المرفوضة — أعدها للمتجر' : 'تم تسليم الطلب — أحسنت!')
      onClose()
    } catch (e) {
      showError(e.message || 'تعذّر تسجيل التسليم')
    }
  }

  return (
    <Modal isOpen={!!order} onClose={onClose} title="تأكيد التسليم" size="sm">
      {order && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">سلّمت طلب <b>{order.customerName}</b>؟ سيصل للزبون إشعار بالتسليم.</p>

          {/* رفض جزئي */}
          <button type="button" onClick={() => { setRefuseMode(m => !m); setRefused({}); setReason('') }}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${refuseMode ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700'}`}>
            <span>الزبون رفض بعض القطع؟</span>
            {refuseMode ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {refuseMode && (
            <div className="space-y-3">
              <div className="max-h-56 overflow-y-auto space-y-2">
                {items.map(i => {
                  const max = i.quantity - i.refusedQuantity
                  return (
                    <div key={i.subOrderItemId} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2">
                      {i.imageUrl
                        ? <img src={getImageUrl(i.imageUrl)} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                        : <span className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-gray-400" /></span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{i.name}</p>
                        <p className="text-xs text-gray-500 truncate">{[i.variant, `${i.quantity} × ${money(i.unitPrice)}`].filter(Boolean).join(' · ')}</p>
                      </div>
                      <Stepper value={refused[i.subOrderItemId] || 0} max={max}
                        onChange={v => setRefused(r => ({ ...r, [i.subOrderItemId]: v }))} />
                    </div>
                  )
                })}
              </div>

              {refusedLines.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {REFUSAL_REASONS.map(r => (
                    <button key={r.value} type="button" onClick={() => setReason(r.value)}
                      className={`h-8 px-3 rounded-full text-xs font-bold border ${reason === r.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              {refusesAll
                ? (
                  <button type="button" onClick={() => onFullRefusal(order)}
                    className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 p-3 text-right">
                    <span className="block text-sm font-bold text-orange-800">رفض الزبون الطلب كاملاً</span>
                    <span className="block text-xs text-orange-700 mt-0.5">اضغط هنا لتسجيله «تعذّر التسليم» وإعادة الطلب ←</span>
                  </button>
                )
                : refusedLines.length > 0 && (
                  <p className="text-xs text-gray-600">
                    تُخصم {money(refusedValue)}{feeWaived > 0 ? ` + أجرة التوصيل ${money(feeWaived)}` : ''} وترجع القطع للمتجر معك{!reason && <b className="text-red-600"> · اختر السبب</b>}
                  </p>
                )}
            </div>
          )}

          {needsCash && !refusesAll && (
            <label className={`flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${cash ? 'border-green-500 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
              <input type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} className="w-5 h-5 accent-green-600" />
              <span className="flex-1">
                <span className="block text-sm text-gray-700">استلمت من الزبون نقداً</span>
                <span className="block text-xl font-extrabold text-gray-900">{money(amount)}</span>
                {hasRefusal && <span className="block text-xs text-gray-500 line-through">{money(order.amountToCollect)}</span>}
              </span>
              <Banknote className={cash ? 'text-green-600' : 'text-amber-600'} />
            </label>
          )}
          {!refusesAll && (
            <button type="button" onClick={confirm} disabled={isPending || blocked}
              className="w-full h-12 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50">
              {isPending ? 'جاري التسجيل...' : hasRefusal ? 'تأكيد التسليم الجزئي' : 'تأكيد التسليم'}
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

// ===========================
// نافذة «تعذّر التسليم»
// ===========================
const FAIL_REASONS = [
  { value: 'customer_refused', label: 'رفض الزبون الطلب' },
  { value: 'no_answer', label: 'الزبون لا يرد' },
  { value: 'wrong_address', label: 'العنوان خاطئ' },
  { value: 'other', label: 'سبب آخر' },
]

const FailSheet = ({ target, onClose }) => {
  const { success, error: showError } = useToast()
  const { mutateAsync: fail, isPending } = useFailOrder()
  const order = target?.order
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [feeCollected, setFeeCollected] = useState(false)

  useEffect(() => { setReason(target?.reason || ''); setNote(''); setFeeCollected(false) }, [target])

  const refused = reason === 'customer_refused'
  const fee = order?.deliveryFee || 0
  const unpaid = order?.amountToCollect > 0
  const customerPays = refused && order?.refusalFeePayer === 'CUSTOMER' && fee > 0 && unpaid
  const needsNote = reason === 'other' && !note.trim()

  const confirm = async () => {
    try {
      await fail({ orderId: order.orderId, reason, note: note.trim() || undefined, feeCollected: customerPays && feeCollected })
      success('سُجّل «تعذّر التسليم» — أعد البضاعة للمتجر حسب توجيه العمليات')
      onClose()
    } catch (e) {
      showError(e.message || 'تعذّر التسجيل')
    }
  }

  return (
    <Modal isOpen={!!order} onClose={onClose} title="تعذّر التسليم" size="sm">
      {order && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">طلب <b>{order.customerName}</b> لن يُسلَّم. ستُبلَّغ العمليات والمتجر، وتعود متاحاً لطلبات جديدة.</p>
          <div className="grid grid-cols-2 gap-2">
            {FAIL_REASONS.map(r => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)}
                className={`h-11 rounded-xl text-sm font-bold border ${reason === r.value ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-300 text-gray-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300}
            placeholder={reason === 'other' ? 'اكتب السبب (مطلوب)' : 'ملاحظة للعمليات (اختياري)'}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />

          {refused && fee > 0 && (
            order?.refusalFeePayer === 'CUSTOMER' && unpaid ? (
              <label className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer ${feeCollected ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <input type="checkbox" checked={feeCollected} onChange={e => setFeeCollected(e.target.checked)} className="w-5 h-5 accent-green-600" />
                <span className="flex-1">
                  <span className="block text-sm text-gray-700">استلمت أجرة التوصيل من الزبون</span>
                  <span className="block text-lg font-extrabold text-gray-900">{money(fee)}</span>
                  <span className="block text-[11px] text-gray-500">اتركها إن رفض الزبون الدفع</span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                أجرة التوصيل ({money(fee)}) {order?.refusalFeePayer === 'VENDOR' ? 'يتحمّلها المتجر' : 'تتحمّلها المنصة'} — لا تجمع من الزبون شيئاً.
              </p>
            )
          )}

          <button type="button" onClick={confirm} disabled={isPending || !reason || needsNote}
            className="w-full h-12 rounded-xl bg-orange-600 text-white font-bold disabled:opacity-50">
            {isPending ? 'جاري التسجيل...' : 'تأكيد: لم يُسلَّم'}
          </button>
        </div>
      )}
    </Modal>
  )
}

// ===========================
// الصفحة
// ===========================
const DriverDashboard = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { success, error: showError, info } = useToast()
  const [tab, setTab] = useState('active')
  const [delivering, setDelivering] = useState(null)
  const [failing, setFailing] = useState(null)   // { order, reason? }

  const { data: me, isError: meError, error: meErr } = useDriverProfile()
  const { data: active = [], isLoading, refetch, isFetching } = useMyDriverOrders(false)
  const { data: history = [], isLoading: historyLoading } = useMyDriverOrders(true)
  const { mutateAsync: setStatus, isPending: settingStatus } = useSetDriverWorkStatus()

  const location = useLocationSharing((body) => apiPost(API_ENDPOINTS.DRIVER_APP.LOCATION, body))
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 5000); return () => clearInterval(t) }, [])

  // الإشعار يصل لحظياً عبر SignalR (مفعّل للتطبيق كله) — نحدّث الطلبات فوراً بدل انتظار الفحص الدوري
  const queryClient = useQueryClient()
  const latestNotificationId = useNotificationsStore((st) => st.notifications[0]?.id)
  const seenNotificationRef = useRef(latestNotificationId)
  useEffect(() => {
    if (latestNotificationId && latestNotificationId !== seenNotificationRef.current) {
      queryClient.invalidateQueries({ queryKey: ['driver-app'] })
    }
    seenNotificationRef.current = latestNotificationId
  }, [latestNotificationId, queryClient])

  // عند العودة للصفحة (فتح الشاشة) نحدّث مباشرة
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') queryClient.invalidateQueries({ queryKey: ['driver-app'] }) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [queryClient])

  // تنبيه عند وصول طلب جديد (بعد التحميل الأول فقط)
  const knownRef = useRef(null)
  useEffect(() => {
    if (isLoading) return
    const ids = new Set(active.map(o => o.orderId))
    if (knownRef.current && [...ids].some(id => !knownRef.current.has(id))) {
      info('وصلك طلب جديد!')
      navigator.vibrate?.([200, 100, 200])
    }
    knownRef.current = ids
  }, [active, isLoading, info])

  const changeStatus = async (value) => {
    if (value === me?.workStatus) return
    try { await setStatus(value); success('تم تحديث حالتك') } catch (e) { showError(e.message || 'تعذّر التحديث') }
  }

  const handleLogout = () => { location.stop(); logout(); navigate('/login', { replace: true }) }

  if (meError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-bold text-gray-900">{meErr?.message || 'تعذّر تحميل لوحة السائق'}</p>
        <button onClick={handleLogout} className="text-sm text-primary font-bold">تسجيل الخروج</button>
      </div>
    )
  }

  const delivering_ = active.length > 0
  const ago = location.lastSent ? Math.round((Date.now() - location.lastSent.getTime()) / 1000) : null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">لوحة السائق</p>
            <p className="font-bold text-gray-900 truncate">{me ? `أهلاً ${me.fullName}` : '...'}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/notifications" aria-label="الإشعارات" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"><Bell size={20} /></Link>
            <button onClick={handleLogout} aria-label="تسجيل الخروج" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <PushPrompt dismissible={false} text="فعّلها لتصلك الطلبات الجديدة والشاشة مطفأة" />

        {/* الحالة */}
        <section className="bg-white rounded-2xl border border-gray-200 p-3">
          {delivering_ ? (
            <p className="text-sm font-bold text-blue-700 flex items-center justify-center gap-2 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" /> قيد التوصيل — سلّم طلباتك لتغيير حالتك
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 bg-gray-100 rounded-xl p-1">
              {WORK_STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => changeStatus(s.value)} disabled={settingStatus || !me}
                  className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${(me?.workStatus === 'delivering' ? 'available' : me?.workStatus) === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* الأرقام */}
        <section className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-extrabold text-gray-900">{active.length}</p>
            <p className="text-xs text-gray-500">طلبات حالية</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-extrabold text-gray-900">{me?.deliveredToday ?? '—'}</p>
            <p className="text-xs text-gray-500">سلّمت اليوم</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-base font-extrabold text-gray-900 leading-8 truncate">{me ? money(me.cashInHand) : '—'}</p>
            <p className="text-xs text-gray-500">نقد معك</p>
          </div>
        </section>

        {/* مشاركة الموقع */}
        <section className={`rounded-2xl border p-3 flex items-center gap-3 ${location.sharing ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <Radio size={20} className={location.sharing ? 'text-green-600' : 'text-gray-400'} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{location.sharing ? 'موقعك يظهر للعمليات' : 'مشاركة موقعك متوقفة'}</p>
            <p className="text-xs text-gray-500 truncate">
              {location.error || (location.sharing ? (ago != null ? `آخر إرسال منذ ${ago} ث · أبقِ الصفحة مفتوحة` : 'جاري تحديد موقعك...') : 'شغّلها أثناء العمل ليسهل توزيع الطلبات عليك')}
            </p>
          </div>
          <button type="button" onClick={location.sharing ? location.stop : location.start}
            className={`h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap ${location.sharing ? 'border border-gray-300 text-gray-700 bg-white' : 'bg-primary text-white'}`}>
            {location.sharing ? 'إيقاف' : 'تشغيل'}
          </button>
        </section>

        {/* التبويبات */}
        <div className="flex items-center gap-2">
          <div className="flex-1 grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
            {[['active', `الحالية${active.length ? ` (${active.length})` : ''}`], ['history', 'السجل']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`h-9 rounded-lg text-sm font-bold ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={() => refetch()} aria-label="تحديث" className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600">
            <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {tab === 'active' ? (
          isLoading ? (
            <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-200 animate-pulse" />)}</div>
          ) : active.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
              <Package size={36} className="mx-auto text-gray-300" />
              <p className="mt-3 font-bold text-gray-900">لا توجد طلبات حالياً</p>
              <p className="mt-1 text-sm text-gray-500">
                {me?.workStatus === 'available' || me?.workStatus === 'delivering' ? 'ستظهر هنا الطلبات فور إسنادها إليك' : 'غيّر حالتك إلى «متاح» لتستقبل الطلبات'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(o => <ActiveOrderCard key={o.orderId} order={o} onDeliver={setDelivering} onFail={(order) => setFailing({ order })} />)}
            </div>
          )
        ) : historyLoading ? (
          <div className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
        ) : history.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">لا توجد توصيلات في آخر 7 أيام</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {history.map(o => (
              <div key={o.orderId} className="flex items-center gap-3 p-3">
                {o.status === 'DELIVERY_FAILED'
                  ? <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">!</span>
                  : <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{o.customerName}{o.status === 'DELIVERY_FAILED' && <span className="text-xs font-medium text-orange-600"> · تعذّر التسليم</span>}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={11} />
                    {o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time(o.deliveredAt) : '—'}
                    <span className="font-mono" dir="ltr">· {o.orderNumber}</span>
                  </p>
                </div>
                {o.cashCollectedAmount > 0 && <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{money(o.cashCollectedAmount)}</span>}
              </div>
            ))}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-200"><PushDeviceRow /></section>

        {me && (
          <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-3 pt-2">
            <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /> {Number(me.rating || 0).toFixed(1)}</span>
            <span>{me.totalDeliveries} توصيلة منذ البداية</span>
          </p>
        )}
      </main>

      <DeliverSheet order={delivering} onClose={() => setDelivering(null)}
        onFullRefusal={(order) => { setDelivering(null); setFailing({ order, reason: 'customer_refused' }) }} />
      <FailSheet target={failing} onClose={() => setFailing(null)} />
    </div>
  )
}

export default DriverDashboard
