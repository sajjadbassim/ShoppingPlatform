// src/pages/operations/OperationsOrders.jsx
// إدارة الطلبات للعمليات: قائمة مختصرة تُظهر «الخطوة التالية» لكل طلب + لوحة تفاصيل فيها كل الإجراءات
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, Truck, Package, Clock, CheckCircle, XCircle, MapPin, RefreshCw, AlertCircle, Store,
  Phone, FileText, X, ChevronLeft, MessageCircle, Bike, Car, Timer, User,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Pagination from '../../components/common/Pagination'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import {
  useOrdersPaged, useOrder, useConfirmSubOrder, useCancelSubOrder, useUpdateSubOrderStatus,
  useAssignDriverToOrder, useAvailableDrivers,
} from '../../hooks/useOrders'
import { DurationChip, OrderTimingCard } from '../../components/common/OrderTiming'
import { useOrderTimings } from '../../hooks/useOrderTiming'

// ===========================
// الحالات
// ===========================
const STATUS = {
  PENDING_CONFIRMATION: { label: 'بانتظار التأكيد', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', icon: Clock },
  CONFIRMED: { label: 'مؤكد', chip: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', icon: CheckCircle },
  PARTIALLY_CONFIRMED: { label: 'مؤكد جزئياً', chip: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500', icon: CheckCircle },
  PREPARING: { label: 'قيد التحضير', chip: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500', icon: Package },
  OUT_FOR_DELIVERY: { label: 'مع السائق', chip: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', icon: Truck },
  DELIVERED: { label: 'تم التوصيل', chip: 'bg-green-100 text-green-800', dot: 'bg-green-500', icon: CheckCircle },
  CANCELLED: { label: 'ملغي', chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', icon: XCircle },
  DELIVERY_FAILED: { label: 'تعذّر التسليم', chip: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', icon: XCircle },
}
const st = (s) => STATUS[s] || { label: s || '—', chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', icon: Package }

const FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'PENDING_CONFIRMATION', label: 'بانتظار التأكيد' },
  { value: 'CONFIRMED', label: 'مؤكد' },
  { value: 'PARTIALLY_CONFIRMED', label: 'مؤكد جزئياً' },
  { value: 'PREPARING', label: 'قيد التحضير' },
  { value: 'OUT_FOR_DELIVERY', label: 'مع السائق' },
  { value: 'DELIVERED', label: 'تم التوصيل' },
  { value: 'DELIVERY_FAILED', label: 'تعذّر التسليم' },
  { value: 'CANCELLED', label: 'ملغي' },
]

const CANCEL_REASONS = ['المتجر لم يرد', 'المنتج غير متوفر', 'طلب الزبون الإلغاء', 'تعذّر الوصول للزبون']

const money = (n) => `${(n || 0).toLocaleString()} د.ع`
const timeAgo = (d) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `منذ ${min} د`
  const h = Math.round(min / 60)
  if (h < 24) return `منذ ${h} س`
  return new Date(d).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })
}
const waLink = (phone) => {
  const d = (phone || '').replace(/\D/g, '')
  return d ? `https://wa.me/${d.startsWith('0') ? '964' + d.slice(1) : d}` : null
}
const cleanAddress = (a) => (a || '').split(',').map(x => x.trim()).filter(Boolean).join('، ')

// ===========================
// «الخطوة التالية» — ما يجب فعله بالطلب الآن
// ===========================
const nextStep = (order) => {
  const subs = (order.subOrders || []).filter(s => s.status !== 'CANCELLED')
  if (!subs.length) return order.status === 'CANCELLED' ? { text: 'ملغي', tone: 'text-red-600' } : { text: '—', tone: 'text-gray-400' }
  const count = (s) => subs.filter(x => x.status === s).length
  const pending = count('PENDING_CONFIRMATION')
  if (pending) {
    const mins = Math.min(...subs.filter(x => x.status === 'PENDING_CONFIRMATION').map(x => x.minutesRemaining ?? 99))
    return { text: `بانتظار تأكيد ${pending === 1 ? 'متجر' : pending + ' متاجر'}${mins < 99 ? ` · ${mins > 0 ? `باقي ${mins} د` : 'انتهت المهلة'}` : ''}`, tone: mins <= 0 ? 'text-red-600' : 'text-amber-700', urgent: true }
  }
  if (count('DELIVERY_FAILED')) return { text: 'تعذّر التسليم — أعد المحاولة أو ألغِ', tone: 'text-orange-700', urgent: true }
  if (count('CONFIRMED')) return { text: 'ابدأ التحضير', tone: 'text-blue-700', urgent: true }
  if (subs.every(x => x.status === 'PREPARING')) return { text: 'جاهز — عيّن سائقاً', tone: 'text-primary', urgent: true }
  if (count('PREPARING')) return { text: 'قيد التحضير', tone: 'text-indigo-700' }
  if (count('OUT_FOR_DELIVERY')) {
    const d = subs.find(x => x.driverName)?.driverName
    return { text: d ? `مع ${d}` : 'في الطريق', tone: 'text-purple-700' }
  }
  if (subs.every(x => x.status === 'DELIVERED')) return { text: 'اكتمل', tone: 'text-green-700' }
  return { text: st(order.status).label, tone: 'text-gray-600' }
}

const StatusChip = ({ status, small }) => {
  const s = st(status)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap ${s.chip} ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  )
}

// ===========================
// صف الطلب في القائمة
// ===========================
const OrderRow = ({ order, active, onOpen, timing }) => {
  const step = nextStep(order)
  const subs = order.subOrders || []
  const area = cleanAddress(order.deliveryAddress).split('، ').slice(-2).join('، ')
  return (
    <button onClick={onOpen}
      className={`w-full text-right p-3.5 sm:p-4 transition-colors border-r-4 ${active ? 'bg-primary/5 border-primary' : step.urgent ? 'border-amber-400 hover:bg-gray-50' : 'border-transparent hover:bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900 text-sm" dir="ltr">{order.orderNumber?.replace(/^ORD-\d{4}(\d{4})-(\d+)$/, '$1-$2')}</span>
        <span className="text-xs text-gray-400">{timeAgo(order.createdAt)}</span>
        <span className="mr-auto flex items-center gap-1">
          {order.status === 'DELIVERED' && <DurationChip timing={timing} small />}
          <StatusChip status={order.status} small />
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-gray-900 truncate">{order.customerName || 'زبون'}</span>
          <span className="block text-xs text-gray-500 truncate">{area || '—'} · {subs.length} {subs.length === 1 ? 'متجر' : 'متاجر'}</span>
        </span>
        <span className="font-bold text-gray-900 text-sm flex-shrink-0">{money(order.totalAmount)}</span>
      </div>
      <p className={`mt-2 text-xs font-bold flex items-center gap-1 ${step.tone}`}>
        {step.urgent && <span className="w-1.5 h-1.5 rounded-full bg-current motion-safe:animate-pulse" />}{step.text}
      </p>
    </button>
  )
}

// ===========================
// طلب فرعي (متجر) داخل لوحة التفاصيل
// ===========================
const SubOrderBlock = ({ sub, onConfirm, onCancel, onStatus, busy }) => {
  const pending = sub.status === 'PENDING_CONFIRMATION'
  const late = pending && (sub.minutesRemaining ?? 1) <= 0
  return (
    <div className={`rounded-2xl border ${pending ? (late ? 'border-red-300' : 'border-amber-300') : 'border-gray-200'} bg-white overflow-hidden`}>
      <div className="flex items-center gap-2.5 p-3 border-b border-gray-100">
        <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Store size={17} className="text-gray-500" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{sub.vendorNameAr || sub.vendorName}</p>
          {sub.vendorPhone && <a href={`tel:${sub.vendorPhone}`} className="text-xs text-primary" dir="ltr">{sub.vendorPhone}</a>}
        </div>
        <StatusChip status={sub.status} />
      </div>

      {pending && (
        <p className={`px-3 pt-2.5 text-xs font-bold flex items-center gap-1 ${late ? 'text-red-600' : 'text-amber-700'}`}>
          <Timer size={13} />{late ? 'انتهت مهلة تأكيد المتجر — اتصل به أو ألغِ طلبه' : `مهلة تأكيد المتجر: باقي ${sub.minutesRemaining} دقيقة`}
        </p>
      )}

      <div className="p-3 space-y-2">
        {(sub.items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="relative w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
              {it.productImageUrl && <img src={getImageUrl(it.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
              <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">{it.quantity}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-gray-800 truncate">{it.productNameAr || it.productName}</span>
              {it.variantAttributes?.length > 0 && (
                <span className="block text-[11px] text-gray-500 truncate">{it.variantAttributes.map(a => `${a.attributeNameAr}: ${a.valueAr}`).join(' · ')}</span>
              )}
            </span>
            <span className="text-xs text-gray-600 flex-shrink-0">{money(it.subtotal)}</span>
          </div>
        ))}
      </div>

      {sub.driverName && (
        <p className="mx-3 mb-3 flex items-center gap-2 text-xs text-purple-800 bg-purple-50 rounded-lg p-2">
          <Truck size={14} /><span className="font-bold">{sub.driverName}</span>
          {sub.driverPhone && <a href={`tel:${sub.driverPhone}`} className="mr-auto" dir="ltr">{sub.driverPhone}</a>}
        </p>
      )}
      {sub.cancellationReason && <p className="mx-3 mb-3 text-xs text-red-700 bg-red-50 rounded-lg p-2">سبب الإلغاء: {sub.cancellationReason}</p>}
      {sub.status === 'DELIVERY_FAILED' && (
        <p className="mx-3 mb-3 text-xs text-orange-800 bg-orange-50 rounded-lg p-2">
          تعذّر التسليم: <b>{sub.failureReasonAr || '—'}</b>{sub.failureNote ? ` — ${sub.failureNote}` : ''}
          <span className="block mt-0.5 text-orange-700">البضاعة رجعت مع السائق. إعادة المحاولة تعيده للتحضير لتعيين سائق، والإلغاء يعيد القطع للمخزون.</span>
        </p>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-t border-gray-100">
        <span className="text-sm font-bold text-gray-900 flex-1">{money(sub.total)}</span>
        {pending && (
          <>
            <button onClick={() => onCancel(sub)} disabled={busy} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-bold disabled:opacity-50">إلغاء</button>
            <button onClick={() => onConfirm(sub)} disabled={busy} className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-bold inline-flex items-center gap-1 disabled:opacity-50"><CheckCircle size={15} />تأكيد</button>
          </>
        )}
        {sub.status === 'CONFIRMED' && (
          <button onClick={() => onStatus(sub, 'PREPARING')} disabled={busy} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-bold inline-flex items-center gap-1 disabled:opacity-50"><Package size={15} />بدء التحضير</button>
        )}
        {sub.status === 'DELIVERY_FAILED' && (
          <>
            <button onClick={() => onCancel(sub)} disabled={busy} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-bold disabled:opacity-50">إلغاء</button>
            {sub.failureReason !== 'customer_refused' && (
              <button onClick={() => onStatus(sub, 'PREPARING')} disabled={busy} className="h-9 px-4 rounded-lg bg-orange-600 text-white text-sm font-bold inline-flex items-center gap-1 disabled:opacity-50"><Truck size={15} />إعادة المحاولة</button>
            )}
          </>
        )}
        {sub.status === 'OUT_FOR_DELIVERY' && (
          <button onClick={() => onStatus(sub, 'DELIVERED')} disabled={busy} className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-bold inline-flex items-center gap-1 disabled:opacity-50"><CheckCircle size={15} />تم التوصيل</button>
        )}
      </div>
    </div>
  )
}

// ===========================
// لوحة تفاصيل الطلب
// ===========================
const OrderPanel = ({ orderId, fallback, onClose, actions }) => {
  const { data: detail, isLoading } = useOrder(orderId)
  const order = detail ? { ...fallback, ...detail } : fallback
  const subs = order?.subOrders || []
  const active = subs.filter(s => s.status !== 'CANCELLED')
  const readyForDriver = active.length > 0 && active.every(s => s.status === 'PREPARING')
  const wa = waLink(order?.customerPhone || order?.deliveryPhone)
  const phone = order?.deliveryPhone || order?.customerPhone

  // فُتح من رابط (إشعار) ولم تصل التفاصيل بعد
  if (!order?.orderNumber) return (
    <div className="p-5 space-y-3">
      <Skeleton className="h-6 w-48" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" />
    </div>
  )
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900" dir="ltr">{order.orderNumber}</p>
          <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <StatusChip status={order.status} />
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {readyForDriver && (
          <button onClick={() => actions.assign(order)}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-primary text-white text-right shadow-md shadow-primary/30">
            <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Truck size={20} /></span>
            <span className="flex-1"><span className="block font-bold">الطلب جاهز — عيّن سائقاً</span><span className="block text-xs text-white/80">كل المتاجر أنهت التحضير</span></span>
            <ChevronLeft size={20} />
          </button>
        )}

        <OrderTimingCard orderId={order.id} />

        {/* الزبون والتوصيل */}
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><User size={17} className="text-gray-500" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{order.customerName || 'زبون'}</p>
              {phone && <p className="text-xs text-gray-500" dir="ltr">{phone}</p>}
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">{order.paymentMethod === 'COD' ? 'دفع عند الاستلام' : order.paymentMethod || '—'}</span>
          </div>
          {order.deliveryAddress && (
            <p className="mt-3 text-sm text-gray-700 flex items-start gap-1.5"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />{cleanAddress(order.deliveryAddress)}</p>
          )}
          {order.customerNotes && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 rounded-lg p-2 flex items-start gap-1.5"><FileText size={14} className="mt-0.5 flex-shrink-0" />{order.customerNotes}</p>
          )}
          {phone && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <a href={`tel:${phone}`} className="h-10 rounded-xl border border-gray-200 text-sm font-medium inline-flex items-center justify-center gap-1.5"><Phone size={15} />اتصال</a>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium inline-flex items-center justify-center gap-1.5"><MessageCircle size={15} />واتساب</a>}
            </div>
          )}
        </div>

        {/* المتاجر */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">المتاجر ({subs.length})</p>
          {isLoading && !subs.length ? <Skeleton className="h-40 rounded-2xl" /> : (
            <div className="space-y-3">
              {subs.map(sub => (
                <SubOrderBlock key={sub.id} sub={sub} busy={actions.busy}
                  onConfirm={actions.confirm} onCancel={actions.cancel} onStatus={actions.status} />
              ))}
            </div>
          )}
        </div>

        {/* المجموع */}
        <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>المنتجات</span><span>{money(order.subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>التوصيل</span><span>{money(order.deliveryFees)}</span></div>
          {order.discountAmount > 0 && <div className="flex justify-between text-green-700"><span>الخصم{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>-{money(order.discountAmount)}</span></div>}
          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100"><span>المطلوب من الزبون</span><span className="text-primary">{money(order.totalAmount)}</span></div>
        </div>
      </div>
    </div>
  )
}

// ===========================
// نوافذ الإجراءات
// ===========================
const Sheet = ({ children, onClose, busy }) => (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
    <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto">{children}</div>
  </div>
)

const CancelSheet = ({ sub, onClose, onSubmit, busy }) => {
  const [reason, setReason] = useState('')
  const [custom, setCustom] = useState('')
  const final = reason === 'other' ? custom.trim() : reason
  return (
    <Sheet onClose={onClose} busy={busy}>
      <h3 className="font-bold text-gray-900">إلغاء طلب {sub.vendorNameAr || sub.vendorName}</h3>
      <p className="text-sm text-gray-500 mt-1">بقية متاجر الطلب لا تتأثر. السبب يظهر للزبون.</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {[...CANCEL_REASONS, 'other'].map(r => (
          <button key={r} onClick={() => setReason(r)}
            className={`h-9 px-3.5 rounded-full text-sm border ${reason === r ? 'bg-red-50 border-red-300 text-red-700 font-bold' : 'border-gray-200 text-gray-700'}`}>{r === 'other' ? 'سبب آخر' : r}</button>
        ))}
      </div>
      {reason === 'other' && <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={2} autoFocus placeholder="اكتب السبب..." className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-sm" />}
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-gray-200 font-bold text-gray-700">تراجع</button>
        <button onClick={() => onSubmit(final)} disabled={!final || busy} className="h-11 rounded-xl bg-red-600 text-white font-bold disabled:opacity-40">تأكيد الإلغاء</button>
      </div>
    </Sheet>
  )
}

const vehicle = (t) => t === 'car' ? { Icon: Car, label: 'سيارة' } : t === 'motorcycle' ? { Icon: Bike, label: 'دراجة نارية' } : { Icon: Bike, label: 'دراجة' }

const AssignSheet = ({ order, drivers, onClose, onSubmit, busy }) => {
  const [driverId, setDriverId] = useState('')
  return (
    <Sheet onClose={onClose} busy={busy}>
      <h3 className="font-bold text-gray-900">تعيين سائق للطلب <span dir="ltr">{order.orderNumber}</span></h3>
      <p className="text-sm text-gray-500 mt-1">السائق يستلم من كل متاجر الطلب ويوصل للزبون</p>
      {drivers.length === 0 ? (
        <p className="mt-4 p-4 rounded-2xl bg-amber-50 text-amber-800 text-sm text-center">لا يوجد سائق متاح الآن</p>
      ) : (
        <div className="mt-4 space-y-2">
          {drivers.map(d => {
            const v = vehicle(d.vehicleType)
            return (
              <button key={d.id} onClick={() => setDriverId(d.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-right ${driverId === d.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><v.Icon size={18} className="text-gray-600" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-gray-900 text-sm truncate">{d.fullName}</span>
                  <span className="block text-xs text-gray-500">{v.label}{d.phone && <> · <span dir="ltr">{d.phone}</span></>}</span>
                </span>
                {driverId === d.id && <CheckCircle size={20} className="text-primary" />}
              </button>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-gray-200 font-bold text-gray-700">إلغاء</button>
        <button onClick={() => onSubmit(driverId)} disabled={!driverId || busy} className="h-11 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
          {busy && <RefreshCw size={16} className="animate-spin" />}تعيين
        </button>
      </div>
    </Sheet>
  )
}

// ===========================
// الصفحة
// ===========================
const OperationsOrders = () => {
  const { success, error: toastError } = useToast()
  const { user } = useAuthStore()
  const opsUserId = user?.userId || user?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const currentPage = parseInt(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || 'all'

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(t) }, [searchInput])

  const [opened, setOpened] = useState(null) // يبقى مفتوحاً حتى لو خرج الطلب من الفلتر بعد إجراء
  // ?order=<id> (من الإشعارات): فتح الطلب مباشرة حتى لو لم يكن في الصفحة المعروضة
  const orderParam = searchParams.get('order')
  useEffect(() => { if (orderParam) setOpened(o => o?.id === orderParam ? o : { id: orderParam }) }, [orderParam])
  const closeOrder = () => {
    setOpened(null)
    if (orderParam) { const p = new URLSearchParams(searchParams); p.delete('order'); setSearchParams(p, { replace: true }) }
  }
  const openId = opened?.id
  const [cancelSub, setCancelSub] = useState(null)
  const [assignOrder, setAssignOrder] = useState(null)

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useOrdersPaged({
    PageNumber: currentPage, PageSize: 20,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    orderNumber: search || undefined,
  })
  const { data: counts = {}, refetch: refetchCounts } = useQuery({
    queryKey: ['orders-status-counts'],
    queryFn: async () => (await apiGet(API_ENDPOINTS.ORDERS.STATUS_COUNTS)).data.data || {},
    refetchInterval: 30000,
  })
  // الطلبات الجديدة تظهر وحدها
  useEffect(() => { const t = setInterval(() => refetch(), 30000); return () => clearInterval(t) }, [refetch])

  const { data: drivers = [] } = useAvailableDrivers()
  const orders = data?.items || []
  // مدة الوصول للطلبات المُسلَّمة في هذه الصفحة
  const { data: timings } = useOrderTimings((orders || []).filter(o => o.status === 'DELIVERED').map(o => o.id))
  const totalPages = data?.totalPages || 1
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const openOrder = opened && (orders.find(o => o.id === openId) || opened)

  const { mutateAsync: confirmSub, isPending: confirming } = useConfirmSubOrder()
  const { mutateAsync: cancelSubOrder, isPending: cancelling } = useCancelSubOrder()
  const { mutateAsync: updateStatus, isPending: updating } = useUpdateSubOrderStatus()
  const { mutateAsync: assignDriver, isPending: assigning } = useAssignDriverToOrder()
  const busy = confirming || cancelling || updating || assigning

  const after = (msg) => { success(msg); refetch(); refetchCounts() }
  const actions = {
    busy,
    confirm: async (sub) => {
      try { await confirmSub({ id: sub.id, data: { opsUserId, notes: '' } }); after(`تم تأكيد ${sub.vendorNameAr || sub.vendorName}`) }
      catch (e) { toastError(e.message || 'فشل التأكيد') }
    },
    cancel: (sub) => setCancelSub(sub),
    status: async (sub, newStatus) => {
      try { await updateStatus({ id: sub.id, data: { opsUserId, newStatus } }); after(newStatus === 'DELIVERED' ? 'تم تسجيل التوصيل' : 'بدأ التحضير') }
      catch (e) { toastError(e.message || 'فشل تحديث الحالة') }
    },
    assign: (order) => setAssignOrder(order),
  }

  const setStatus = (v) => {
    const p = new URLSearchParams(searchParams)
    v === 'all' ? p.delete('status') : p.set('status', v)
    p.delete('page')
    setSearchParams(p)
  }

  if (isError) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
      <p className="text-red-700">{error?.message || 'فشل تحميل الطلبات'}</p>
      <button onClick={() => refetch()} className="mt-4 h-10 px-5 rounded-xl border border-gray-300 font-medium">إعادة المحاولة</button>
    </div>
  )

  const urgentCount = (counts.PENDING_CONFIRMATION || 0) + (counts.CONFIRMED || 0)

  return (
    <div className="space-y-4">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {allCount} طلب · تحديث تلقائي كل 30 ثانية
            {dataUpdatedAt ? ` · آخر تحديث ${new Date(dataUpdatedAt).toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <button onClick={() => { refetch(); refetchCounts() }} disabled={isFetching} aria-label="تحديث"
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ما يحتاج تدخلاً */}
      {urgentCount > 0 && statusFilter === 'all' && (
        <div className="grid sm:grid-cols-2 gap-2">
          {counts.PENDING_CONFIRMATION > 0 && (
            <button onClick={() => setStatus('PENDING_CONFIRMATION')} className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-right">
              <Clock size={20} className="text-amber-600" />
              <span className="flex-1 text-sm"><b className="text-amber-900">{counts.PENDING_CONFIRMATION}</b> <span className="text-amber-800">بانتظار تأكيد المتاجر</span></span>
              <ChevronLeft size={18} className="text-amber-600" />
            </button>
          )}
          {counts.CONFIRMED > 0 && (
            <button onClick={() => setStatus('CONFIRMED')} className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-right">
              <Package size={20} className="text-blue-600" />
              <span className="flex-1 text-sm"><b className="text-blue-900">{counts.CONFIRMED}</b> <span className="text-blue-800">مؤكدة تنتظر بدء التحضير</span></span>
              <ChevronLeft size={18} className="text-blue-600" />
            </button>
          )}
        </div>
      )}

      {/* التصفية والبحث */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {FILTERS.map(f => {
          const n = f.value === 'all' ? allCount : counts[f.value] || 0
          const on = statusFilter === f.value
          if (f.value === 'PARTIALLY_CONFIRMED' && !n && !on) return null
          return (
            <button key={f.value} onClick={() => setStatus(f.value)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 border ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {f.value !== 'all' && <span className={`w-2 h-2 rounded-full ${st(f.value).dot}`} />}
              {f.label}
              <span className={`text-[11px] min-w-5 px-1.5 rounded-full ${on ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{n}</span>
            </button>
          )
        })}
      </div>
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          placeholder="ابحث برقم الطلب أو اسم الزبون أو هاتفه..."
          className="w-full h-10 pr-9 pl-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary" />
      </div>

      {/* القائمة + التفاصيل */}
      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-4 lg:items-start">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-100">{[1, 2, 3, 4].map(i => <div key={i} className="p-4"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-3 w-40" /></div>)}</div>
          ) : orders.length === 0 ? (
            <div className="py-14 text-center text-gray-400"><Package size={34} className="mx-auto mb-2 opacity-40" /><p className="text-sm">{search ? 'لا توجد نتائج' : 'لا توجد طلبات هنا'}</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map(o => <OrderRow key={o.id} order={o} active={o.id === openId} onOpen={() => setOpened(o)} timing={timings?.[o.id]} />)}
            </div>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="p-3 border-t border-gray-100 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages}
                onPageChange={p => { const ps = new URLSearchParams(searchParams); ps.set('page', String(p)); setSearchParams(ps) }} />
            </div>
          )}
        </div>

        {/* لوحة التفاصيل: جانبية على الكمبيوتر، ملء الشاشة على الهاتف */}
        <div className="hidden lg:block sticky top-24 h-[calc(100dvh-7.5rem)] rounded-2xl border border-gray-200 overflow-hidden bg-white">
          {openOrder
            ? <OrderPanel orderId={openId} fallback={openOrder} onClose={closeOrder} actions={actions} />
            : <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2"><Package size={36} className="opacity-40" /><p className="text-sm">اختر طلباً لعرض تفاصيله وإجراءاته</p></div>}
        </div>
      </div>
      {openOrder && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white animate-slide-up">
          <OrderPanel orderId={openId} fallback={openOrder} onClose={closeOrder} actions={actions} />
        </div>
      )}

      {cancelSub && (
        <CancelSheet sub={cancelSub} busy={cancelling} onClose={() => setCancelSub(null)}
          onSubmit={async (reason) => {
            try { await cancelSubOrder({ id: cancelSub.id, data: { opsUserId, cancellationReason: reason } }); setCancelSub(null); after('تم إلغاء طلب المتجر') }
            catch (e) { toastError(e.message || 'فشل الإلغاء') }
          }} />
      )}
      {assignOrder && (
        <AssignSheet order={assignOrder} drivers={drivers} busy={assigning} onClose={() => setAssignOrder(null)}
          onSubmit={async (driverId) => {
            try { await assignDriver({ orderId: assignOrder.id, data: { driverId, opsUserId } }); setAssignOrder(null); after('تم تعيين السائق') }
            catch (e) { toastError(e.message || 'فشل تعيين السائق') }
          }} />
      )}
    </div>
  )
}

export default OperationsOrders
