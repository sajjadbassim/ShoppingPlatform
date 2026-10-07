// src/pages/vendor/VendorOrders.jsx
// طلبات المتجر: ما يحتاج قراراً أولاً، قبول/رفض من البطاقة مباشرة، وتفاصيل في نافذة جانبية
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, RefreshCw, AlertCircle, Package, CheckCircle, XCircle, MapPin, Phone, X,
  MessageCircle, Clock, ChevronLeft, Printer, StickyNote, RotateCcw, Minus, Plus, Timer, Bell, BellOff,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '../../components/common/Button'
import { StatusBadge } from '../../components/common/Badge'
import Pagination from '../../components/common/Pagination'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import { printOrder } from '../../utils/printOrder'
import { RETURN_STATUS_AR, returnReasonAr } from '../../utils/returnText'
import { isOrderSoundOn, setOrderSoundOn } from '../../utils/orderAlerts'
import DeliverySlot from '../../components/common/DeliverySlot'
import { formatQuantity } from '../../utils/weight'

const PENDING = 'PENDING_CONFIRMATION'

const STATUSES = [
  { value: 'all', label: 'الكل' },
  { value: PENDING, label: 'بانتظار قرارك' },
  { value: 'CONFIRMED', label: 'مؤكد' },
  { value: 'PREPARING', label: 'قيد التحضير' },
  { value: 'READY', label: 'جاهز للاستلام' },
  { value: 'OUT_FOR_DELIVERY', label: 'في الطريق' },
  { value: 'DELIVERED', label: 'مكتمل' },
  { value: 'DELIVERY_FAILED', label: 'تعذّر التسليم' },
  { value: 'CANCELLED', label: 'ملغي' },
]

const REJECT_REASONS = [
  'نفد المخزون',
  'المنتج غير متوفر حالياً',
  'لا يمكن التوصيل لهذا العنوان',
  'خطأ في سعر المنتج',
]

const orderTotal = (o) => (o.subtotal ?? 0) + (o.deliveryFee ?? 0)
// اسم القطعة مع المتغير الذي اختاره الزبون — «قميص (المقاس: L · اللون: أحمر)»
const itemName = (it) => {
  const name = it.productNameAr || it.productName
  return it.variantLabel ? `${name} (${it.variantLabel})` : name
}
const money = (n) => `${(n ?? 0).toLocaleString()} د.ع`

const timeAgo = (date) => {
  const min = Math.round((Date.now() - new Date(date).getTime()) / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `منذ ${min} د`
  const h = Math.round(min / 60)
  if (h < 24) return `منذ ${h} س`
  return new Date(date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })
}

// رقم عراقي محلي ← دولي لروابط واتساب
const whatsappLink = (phone) => {
  const digits = (phone || '').replace(/\D/g, '')
  const intl = digits.startsWith('0') ? `964${digits.slice(1)}` : digits
  return intl ? `https://wa.me/${intl}` : null
}

const useVendorOrders = (vendorId, params = {}) => useQuery({
  queryKey: ['vendor-orders', vendorId, params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDERS(vendorId), params)
    const raw = r.data
    return {
      items: Array.isArray(raw?.data) ? raw.data : [],
      totalPages: raw?.pagination?.totalPages ?? 1,
      totalCount: raw?.pagination?.totalCount ?? (Array.isArray(raw?.data) ? raw.data.length : 0),
    }
  },
  enabled: !!vendorId,
  staleTime: 60 * 1000,
  refetchInterval: 60 * 1000, // الطلبات الجديدة تظهر وحدها
})

// أعداد كل حالة وقيمة ما ينتظر القرار — من الخادم بدل تحميل كل الطلبات
const useVendorOrderCounts = (vendorId) => useQuery({
  queryKey: ['vendor-orders', vendorId, 'counts'],
  queryFn: async () => (await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDER_COUNTS(vendorId))).data?.data,
  enabled: !!vendorId,
  staleTime: 60 * 1000,
  refetchInterval: 60 * 1000,
})

// ===========================
// صور المنتجات مصغّرة
// ===========================
const ItemThumbs = ({ items = [] }) => (
  <div className="flex items-center -space-x-2 space-x-reverse">
    {items.slice(0, 3).map((it, i) => (
      <span key={i} className="w-10 h-10 rounded-lg product-media ring-2 ring-white overflow-hidden flex-shrink-0">
        {it.productImageUrl && <img src={getImageUrl(it.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
      </span>
    ))}
    {items.length > 3 && (
      <span className="w-10 h-10 rounded-lg product-media ring-2 ring-white text-xs font-bold text-gray-500 flex items-center justify-center">+{items.length - 3}</span>
    )}
  </div>
)

// ===========================
// بطاقة طلب
// ===========================
// الخطوة التالية بعد القبول: بدء التحضير ← جاهز للاستلام (يُبلَّغ فريق التوصيل فوراً)
const NEXT_STEP = {
  CONFIRMED: { step: 'preparing', label: 'بدء التحضير', icon: Package, cls: 'bg-indigo-600 hover:bg-indigo-700' },
  PREPARING: { step: 'ready', label: 'جاهز للاستلام', icon: CheckCircle, cls: 'bg-teal-600 hover:bg-teal-700' },
}

const NextStepButton = ({ order, onAdvance, busy, big = false }) => {
  const next = NEXT_STEP[order.status]
  if (!next) return order.status === 'READY'
    ? <p className={`text-center text-teal-700 font-medium ${big ? 'text-sm py-2' : 'text-xs'}`}>✓ جاهز — بانتظار وصول السائق</p>
    : null
  const Icon = next.icon
  return (
    <button onClick={() => onAdvance(next.step)} disabled={busy}
      className={`w-full ${big ? 'h-12' : 'h-10 text-sm'} rounded-xl text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${next.cls}`}>
      {busy ? <RefreshCw size={16} className="animate-spin" /> : <Icon size={big ? 18 : 16} />}{next.label}
    </button>
  )
}

const OrderCard = ({ order, onOpen, onAccept, onReject, onAdvance, busy }) => {
  const pending = order.status === PENDING
  const count = order.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0
  const names = order.items?.map(itemName).join('، ')
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${pending ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-gray-200'}`}>
      <button onClick={onOpen} className="w-full text-right p-4 hover:bg-gray-50/60">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 text-sm" dir="ltr">#{order.subOrderNumber}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} />{timeAgo(order.createdAt)}</span>
          <span className="mr-auto flex items-center gap-1.5">
            {pending && <Countdown deadline={order.confirmationDeadline} />}
            <StatusBadge status={order.status} />
          </span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <ItemThumbs items={order.items} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{names || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{count} قطعة · {order.customerName}</p>
            {order.customerNotes && <p className="text-xs text-amber-700 mt-0.5 truncate flex items-center gap-1"><StickyNote size={11} />{order.customerNotes}</p>}
            <DeliverySlot start={order.deliverySlotStart} end={order.deliverySlotEnd} compact className="mt-1" />
          </div>
          <p className="font-bold text-gray-900 flex-shrink-0">{money(orderTotal(order))}</p>
        </div>
      </button>
      {pending && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button onClick={onReject} disabled={busy}
            className="h-10 rounded-xl border border-red-200 text-red-600 text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-red-50 disabled:opacity-50">
            <XCircle size={16} />رفض
          </button>
          <button onClick={onAccept} disabled={busy}
            className="h-10 rounded-xl bg-green-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-green-700 disabled:opacity-50">
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}قبول
          </button>
        </div>
      )}
      {!pending && (NEXT_STEP[order.status] || order.status === 'READY') && (
        <div className="px-4 pb-4"><NextStepButton order={order} onAdvance={onAdvance} busy={busy} /></div>
      )}
    </div>
  )
}

// ===========================
// الوقت المتبقي لقرار القبول — بعد انتهائه يظهر الطلب «متأخراً» لفريق العمليات (لا يُلغى تلقائياً).
// طلب السوبرماركت بموعد لاحق لمتجر مغلق تبدأ مهلته من وقت فتح المتجر
// ===========================
const useNow = (ms = 1000) => {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const Countdown = ({ deadline, big = false }) => {
  const now = useNow()
  if (!deadline) return null
  const left = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000))
  const urgent = left < 60
  const text = left === 0 ? 'انتهت المهلة'
    : left >= 3600 ? `${Math.floor(left / 3600)}س ${Math.floor((left % 3600) / 60)}د`
    : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold tabular-nums ${big ? 'h-8 px-3 text-sm' : 'h-6 px-2 text-xs'} ${
      urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`} title="الوقت المتبقي لقبول الطلب — بعده يظهر متأخراً لفريق العمليات">
      <Timer size={big ? 15 : 12} />{text}
    </span>
  )
}

// كميات خاصة لكل قطعة: مرفوضة عند الباب، مُرجعة، غير متوفرة عند القبول
const ItemNotes = ({ it, items = [] }) => {
  const replaced = it.replacesItemId && items.find(x => x.id === it.replacesItemId)
  const notes = [
    it.replacesItemId && { text: `بديل عن ${replaced ? itemName(replaced) : 'قطعة غير متوفرة'}`, cls: 'bg-emerald-50 text-emerald-700' },
    it.unavailableQuantity > 0 && { text: `${formatQuantity(it.unavailableQuantity, it.weightStepKg)} غير متوفرة — أُزيلت`, cls: 'bg-gray-100 text-gray-600' },
    it.refusedQuantity > 0 && { text: `${it.refusedQuantity} رفضها الزبون عند الباب`, cls: 'bg-orange-50 text-orange-700' },
    it.returnedQuantity > 0 && { text: `${it.returnedQuantity} أُرجعت`, cls: 'bg-rose-50 text-rose-700' },
  ].filter(Boolean)
  if (notes.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {notes.map((n, i) => <span key={i} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${n.cls}`}>{n.text}</span>)}
    </div>
  )
}

// ===========================
// تفاصيل الطلب — نافذة من الأسفل (هاتف) أو جانبية (كمبيوتر)
// ===========================
const OrderSheet = ({ order, vendorId, storeName, onClose, onAccept, onReject, onAdvance, busy }) => {
  const pending = order.status === PENDING
  const wa = whatsappLink(order.customerPhone)
  // القبول الجزئي: كم قطعة غير متوفرة من كل بند
  const [partial, setPartial] = useState(false)
  const [missing, setMissing] = useState({})
  // الزبون اختار «استبدله بمشابه»: بديل من منتجات المتجر لكل بند ناقص (لا يدفع أكثر من سعر الأصلي)
  const canReplace = order.substitutionPreference === 'SIMILAR'
  const [replacements, setReplacements] = useState({})
  const { data: storeProducts = [] } = useQuery({
    queryKey: ['vendor-replacement-products', vendorId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId))
      const list = r.data.data || r.data || []
      return list.filter(p => p.isActive !== false && p.isAvailable && p.stockQuantity > 0 && !p.hasVariants)
    },
    enabled: partial && canReplace && !!vendorId,
    staleTime: 60 * 1000,
  })
  const items = order.items || []
  const setMissingFor = (it, n) => setMissing(m => ({ ...m, [it.id]: Math.max(0, Math.min(it.quantity, n)) }))
  const missingCount = Object.values(missing).reduce((s, n) => s + n, 0)
  const allMissing = items.length > 0 && items.every(it => (missing[it.id] || 0) >= it.quantity)
  const replacementPrice = (it) => {
    const product = storeProducts.find(p => p.id === replacements[it.id])
    return product ? Math.min(product.price, it.unitPrice) * (missing[it.id] || 0) : 0
  }
  const newSubtotal = items.reduce((s, it) => s + it.unitPrice * (it.quantity - (missing[it.id] || 0)) + replacementPrice(it), 0)
  const acceptPartial = () => onAccept(Object.entries(missing).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({
    itemId, quantity, replacementProductId: canReplace && replacements[itemId] ? replacements[itemId] : undefined,
  })))
  const { error: showError } = useToast()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-start">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:w-[28rem] max-h-[92dvh] sm:max-h-none sm:h-full bg-white rounded-t-3xl sm:rounded-none flex flex-col animate-slide-up">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900" dir="ltr">#{order.subOrderNumber}</p>
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          {pending ? <Countdown deadline={order.confirmationDeadline} big /> : <StatusBadge status={order.status} />}
          <button onClick={() => { if (!printOrder(order, storeName)) showError('اسمح بالنوافذ المنبثقة لهذا الموقع لطباعة الإيصال') }}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="طباعة إيصال التجهيز" title="طباعة إيصال التجهيز">
            <Printer size={17} />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* موعد السوبرماركت وتفضيل الاستبدال */}
          <DeliverySlot start={order.deliverySlotStart} end={order.deliverySlotEnd} substitution={order.substitutionPreference} />

          {/* ملاحظة الزبون */}
          {order.customerNotes && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <StickyNote size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">ملاحظة الزبون</p>
                <p className="text-sm text-amber-900 mt-0.5 whitespace-pre-line">{order.customerNotes}</p>
              </div>
            </div>
          )}

          {/* الزبون */}
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="font-bold text-gray-900">{order.customerName}</p>
            {order.deliveryAddress && (
              <p className="text-sm text-gray-600 mt-1.5 flex items-start gap-1.5"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />{order.deliveryAddress}</p>
            )}
            {order.customerPhone && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <a href={`tel:${order.customerPhone}`} className="h-10 rounded-xl bg-white border border-gray-200 text-sm font-medium inline-flex items-center justify-center gap-1.5">
                  <Phone size={15} />اتصال
                </a>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium inline-flex items-center justify-center gap-1.5">
                    <MessageCircle size={15} />واتساب
                  </a>
                )}
              </div>
            )}
          </div>

          {/* المنتجات */}
          {partial && (
            <p className="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-xl p-3">
              حدّد عدد القطع <b>غير المتوفرة</b> من كل منتج — تُزال من الطلب ويُبلَّغ الزبون بالمبلغ الجديد.
              {canReplace && <> الزبون يقبل <b>بديلاً مشابهاً</b>: اختره من منتجاتك، ويُحسب بسعر لا يزيد عن الأصلي.</>}
            </p>
          )}
          <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {items.map((it, i) => {
              const gone = it.quantity === 0
              const m = missing[it.id] || 0
              return (
                <div key={it.id || i} className={`flex flex-wrap items-center gap-3 p-3 ${gone ? 'opacity-60' : ''}`}>
                  <span className="w-12 h-12 rounded-xl product-media overflow-hidden flex-shrink-0">
                    {it.productImageUrl && <img src={getImageUrl(it.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-gray-900 truncate ${gone ? 'line-through' : ''}`}>{it.productNameAr || it.productName}</p>
                    {it.variantLabel && (
                      <p className="text-xs font-bold text-primary mt-0.5">{it.variantLabel}{it.variantSku && <span className="font-mono font-normal text-gray-400" dir="ltr"> · {it.variantSku}</span>}</p>
                    )}
                    <p className="text-xs text-gray-500">× {formatQuantity(it.quantity, it.weightStepKg)}</p>
                    <ItemNotes it={it} items={items} />
                  </div>
                  {partial ? (
                    <span className="inline-flex items-center gap-1" aria-label="غير متوفر">
                      <button onClick={() => setMissingFor(it, m - 1)} disabled={m === 0} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center disabled:opacity-40" aria-label="إنقاص"><Minus size={14} /></button>
                      <span className={`w-7 text-center text-sm font-bold ${m > 0 ? 'text-red-600' : 'text-gray-400'}`}>{m}</span>
                      <button onClick={() => setMissingFor(it, m + 1)} disabled={m >= it.quantity} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center disabled:opacity-40" aria-label="زيادة"><Plus size={14} /></button>
                    </span>
                  ) : (
                    <p className="text-sm font-bold text-gray-900">{money(it.subtotal)}</p>
                  )}
                  {partial && canReplace && m > 0 && (
                    <select value={replacements[it.id] || ''} aria-label="البديل"
                      onChange={e => setReplacements(r => ({ ...r, [it.id]: e.target.value }))}
                      className="w-full h-10 px-3 border border-emerald-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500">
                      <option value="">بلا بديل — احذفه وأعد المبلغ</option>
                      {storeProducts.filter(p => p.id !== it.productId && p.stockQuantity >= m).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr || p.name} — {Math.min(p.price, it.unitPrice).toLocaleString()} د.ع{p.price > it.unitPrice ? ' (بسعر الأصلي)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
            <div className="p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>المجموع الفرعي</span><span>{money(partial ? newSubtotal : order.subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>التوصيل</span><span>{money(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100"><span>الإجمالي</span><span className="text-primary">{money((partial ? newSubtotal : order.subtotal ?? 0) + (order.deliveryFee ?? 0))}</span></div>
            </div>
          </div>

          {/* الإرجاعات */}
          {order.returns?.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3 space-y-2">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><RotateCcw size={14} />إرجاعات هذا الطلب</p>
              {order.returns.map(r => (
                <div key={r.id} className="text-sm bg-white rounded-xl border border-rose-100 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900" dir="ltr">{r.returnNumber}</span>
                    <span className="text-xs text-gray-500">{r.isDoorRefusal ? 'رفض عند الباب' : RETURN_STATUS_AR[r.status] || r.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{returnReasonAr(r.reason)}{r.details ? ` — ${r.details}` : ''}</p>
                </div>
              ))}
            </div>
          )}

          {order.cancellationReason && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-bold text-red-700">سبب الإلغاء</p>
              <p className="text-sm text-red-600 mt-0.5">{order.cancellationReason}</p>
            </div>
          )}

          {pending && !partial && items.length > 0 && (
            <button onClick={() => setPartial(true)} className="w-full text-sm font-medium text-gray-600 underline underline-offset-4">
              بعض القطع غير متوفرة؟ اقبل المتوفر فقط
            </button>
          )}
        </div>

        {pending && partial && (
          <div className="grid grid-cols-2 gap-2 p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={() => { setPartial(false); setMissing({}); setReplacements({}) }} disabled={busy}
              className="h-12 rounded-xl border border-gray-200 text-gray-700 font-bold disabled:opacity-50">تراجع</button>
            <button onClick={acceptPartial} disabled={busy || missingCount === 0 || allMissing}
              title={allMissing ? 'كل القطع غير متوفرة — ارفض الطلب بدلاً من ذلك' : undefined}
              className="h-12 rounded-xl bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
              {busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}قبول المتوفر
            </button>
          </div>
        )}
        {pending && !partial && (
          <div className="grid grid-cols-2 gap-2 p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={onReject} disabled={busy}
              className="h-12 rounded-xl border border-red-200 text-red-600 font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              <XCircle size={18} />رفض
            </button>
            <button onClick={() => onAccept()} disabled={busy}
              className="h-12 rounded-xl bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}قبول الطلب
            </button>
          </div>
        )}
        {!pending && (NEXT_STEP[order.status] || order.status === 'READY') && (
          <div className="p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <NextStepButton order={order} onAdvance={onAdvance} busy={busy} big />
          </div>
        )}
      </div>
    </div>
  )
}

// ===========================
// سبب الرفض — مطلوب من الخادم ويصل للزبون
// ===========================
const RejectDialog = ({ order, onClose, onSubmit, busy }) => {
  const [reason, setReason] = useState('')
  const [custom, setCustom] = useState('')
  const final = reason === 'other' ? custom.trim() : reason
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h3 className="font-bold text-gray-900">رفض الطلب <span dir="ltr">#{order.subOrderNumber}</span></h3>
        <p className="text-sm text-gray-500 mt-1">اختر السبب — سيظهر للزبون</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[...REJECT_REASONS, 'other'].map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`h-9 px-3.5 rounded-full text-sm border ${reason === r ? 'bg-red-50 border-red-300 text-red-700 font-bold' : 'border-gray-200 text-gray-700'}`}>
              {r === 'other' ? 'سبب آخر' : r}
            </button>
          ))}
        </div>
        {reason === 'other' && (
          <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={2} maxLength={300} autoFocus
            placeholder="اكتب السبب..." className="mt-3 w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-200 focus:border-red-300" />
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-gray-200 font-bold text-gray-700">تراجع</button>
          <button onClick={() => onSubmit(final)} disabled={!final || busy}
            className="h-11 rounded-xl bg-red-600 text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
            {busy && <RefreshCw size={16} className="animate-spin" />}تأكيد الرفض
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================
// الصفحة
// ===========================
const VendorOrders = () => {
  const { success, error: showError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const queryClient = useQueryClient()

  const currentPage = parseInt(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || 'all'

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  const [openOrder, setOpenOrder] = useState(null)
  // ?order=<subOrderId> (من الإشعارات): فتح الطلب مباشرة
  const orderParam = searchParams.get('order')
  useEffect(() => {
    if (!orderParam || !vendorId) return
    let cancelled = false
    apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDER_BY_ID(vendorId, orderParam))
      .then(r => { const o = r.data?.data; if (!cancelled && o) setOpenOrder(o) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orderParam, vendorId])
  const closeOrder = () => {
    setOpenOrder(null)
    if (orderParam) { const p = new URLSearchParams(searchParams); p.delete('order'); setSearchParams(p, { replace: true }) }
  }
  const [rejecting, setRejecting] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [soundOn, setSoundOn] = useState(isOrderSoundOn)
  const toggleSound = () => { setOrderSoundOn(!soundOn); setSoundOn(!soundOn) }
  // اسم المتجر لإيصال التجهيز (نفس استعلام صفحة الإعدادات — من الذاكرة غالباً)
  const { data: vendorInfo } = useQuery({
    queryKey: ['vendor-info', vendorId],
    queryFn: async () => { const r = await apiGet(API_ENDPOINTS.VENDORS.BY_ID(vendorId)); return r.data.data || r.data },
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
  })
  const storeName = vendorInfo?.nameAr || vendorInfo?.name || ''

  const { data, isLoading, isError, refetch, isFetching } = useVendorOrders(vendorId, {
    pageNumber: currentPage,
    pageSize: 15,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: debouncedSearch || undefined,
  })
  const { data: counts } = useVendorOrderCounts(vendorId)

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor-orders', vendorId] })
    setOpenOrder(null)
    setRejecting(null)
  }

  const acceptMutation = useMutation({
    mutationFn: ({ order, unavailableItems }) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.CONFIRM_ORDER(vendorId, order.subOrderId),
      unavailableItems?.length ? { unavailableItems } : {}),
    onMutate: ({ order }) => setBusyId(order.subOrderId),
    onSuccess: (_, { unavailableItems }) => {
      success(unavailableItems?.length ? 'تم قبول المتوفر وإبلاغ الزبون بالمبلغ الجديد ✅' : 'تم قبول الطلب ✅')
      afterChange()
    },
    onError: (err) => showError(err.message || 'فشل قبول الطلب'),
    onSettled: () => setBusyId(null),
  })

  const advanceMutation = useMutation({
    mutationFn: ({ order, step }) => apiPost(step === 'ready'
      ? API_ENDPOINTS.VENDOR_DASHBOARD.MARK_READY(vendorId, order.subOrderId)
      : API_ENDPOINTS.VENDOR_DASHBOARD.START_PREPARING(vendorId, order.subOrderId)),
    onMutate: ({ order }) => setBusyId(order.subOrderId),
    onSuccess: (_, { step }) => { success(step === 'ready' ? 'الطلب جاهز للاستلام — تم إشعار فريق التوصيل ✅' : 'بدأ تحضير الطلب 📦'); afterChange() },
    onError: (err) => showError(err.message || 'تعذّر تحديث الطلب'),
    onSettled: () => setBusyId(null),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ order, reason }) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.REJECT_ORDER(vendorId, order.subOrderId), { reason }),
    onMutate: ({ order }) => setBusyId(order.subOrderId),
    onSuccess: () => { success('تم رفض الطلب'); afterChange() },
    onError: (err) => showError(err.message || 'فشل رفض الطلب'),
    onSettled: () => setBusyId(null),
  })

  const countOf = (s) => s === 'all' ? (counts?.total ?? 0) : (counts?.byStatus?.[s] ?? 0)
  const pendingCount = countOf(PENDING)
  const pendingValue = counts?.pendingValue ?? 0

  const q = debouncedSearch
  const orders = data?.items ?? []

  const setStatus = (v) => {
    const p = new URLSearchParams(searchParams)
    if (v === 'all') p.delete('status'); else p.set('status', v)
    p.delete('page')
    setSearchParams(p)
  }

  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الطلبات</h1>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">فشل تحميل الطلبات</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 max-w-5xl">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
          <p className="text-sm text-gray-500 mt-0.5">{countOf('all')} طلب · يتحدث فوراً عند وصول طلب</p>
        </div>
        <button onClick={toggleSound} aria-label={soundOn ? 'إيقاف صوت الطلبات الجديدة' : 'تشغيل صوت الطلبات الجديدة'}
          title={soundOn ? 'صوت الطلبات الجديدة: مفعّل' : 'صوت الطلبات الجديدة: متوقف'}
          className={`w-10 h-10 rounded-full flex items-center justify-center ${soundOn ? 'text-primary bg-primary/10' : 'text-gray-400 hover:bg-gray-100'}`}>
          {soundOn ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
        <button onClick={() => refetch()} disabled={isFetching} aria-label="تحديث"
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ما يحتاج قراراً */}
      {pendingCount > 0 && statusFilter !== PENDING && (
        <button onClick={() => setStatus(PENDING)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-right hover:bg-amber-100/70">
          <span className="relative w-11 h-11 rounded-full bg-amber-400 text-white flex items-center justify-center flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-amber-400 motion-safe:animate-soft-ping" aria-hidden="true" />
            <Clock size={20} className="relative" />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-amber-900">{pendingCount} {pendingCount === 1 ? 'طلب ينتظر' : 'طلبات تنتظر'} قرارك</span>
            <span className="block text-xs text-amber-800/80 mt-0.5">بقيمة {money(pendingValue)} — اقبلها بسرعة حتى لا يُلغيها الزبون</span>
          </span>
          <ChevronLeft size={20} className="text-amber-700" />
        </button>
      )}

      {/* الحالات */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {STATUSES.map(s => {
          const active = statusFilter === s.value
          const n = countOf(s.value)
          const urgent = s.value === PENDING && n > 0
          return (
            <button key={s.value} onClick={() => setStatus(s.value)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {s.label}
              <span className={`text-[11px] min-w-5 px-1.5 rounded-full ${active ? 'bg-white/20' : urgent ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* البحث */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => {
            setSearch(e.target.value)
            if (currentPage > 1) { const p = new URLSearchParams(searchParams); p.delete('page'); setSearchParams(p, { replace: true }) }
          }}
          placeholder="ابحث برقم الطلب أو اسم الزبون أو هاتفه..."
          className="w-full h-10 pr-9 pl-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </div>

      {/* القائمة */}
      {isLoading ? (
        <div className="grid lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-14 text-center">
          <Package size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">{q ? 'لا توجد نتائج للبحث' : statusFilter === PENDING ? 'لا توجد طلبات تنتظر قرارك 👌' : 'لا توجد طلبات هنا'}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {orders.map(o => (
            <OrderCard key={o.subOrderId} order={o}
              onOpen={() => setOpenOrder(o)}
              onAccept={() => acceptMutation.mutate({ order: o })}
              onReject={() => setRejecting(o)}
              onAdvance={(step) => advanceMutation.mutate({ order: o, step })}
              busy={busyId === o.subOrderId} />
          ))}
        </div>
      )}

      {!isLoading && (data?.totalPages ?? 1) > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={currentPage} totalPages={data.totalPages}
            onPageChange={p => { const ps = new URLSearchParams(searchParams); ps.set('page', String(p)); setSearchParams(ps) }} />
        </div>
      )}

      {openOrder && (
        <OrderSheet order={openOrder} vendorId={vendorId} storeName={storeName} onClose={closeOrder}
          onAccept={(unavailableItems) => acceptMutation.mutate({ order: openOrder, unavailableItems })}
          onReject={() => setRejecting(openOrder)}
          onAdvance={(step) => advanceMutation.mutate({ order: openOrder, step })}
          busy={busyId === openOrder.subOrderId} />
      )}
      {rejecting && (
        <RejectDialog order={rejecting} onClose={() => setRejecting(null)}
          busy={busyId === rejecting.subOrderId}
          onSubmit={(reason) => rejectMutation.mutate({ order: rejecting, reason })} />
      )}
    </div>
  )
}

export default VendorOrders
