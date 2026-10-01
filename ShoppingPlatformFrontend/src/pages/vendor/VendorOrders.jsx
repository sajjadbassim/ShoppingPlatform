// src/pages/vendor/VendorOrders.jsx
// طلبات المتجر: ما يحتاج قراراً أولاً، قبول/رفض من البطاقة مباشرة، وتفاصيل في نافذة جانبية
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, RefreshCw, AlertCircle, Package, CheckCircle, XCircle, MapPin, Phone, X,
  MessageCircle, Clock, ChevronLeft,
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

const PENDING = 'PENDING_CONFIRMATION'

const STATUSES = [
  { value: 'all', label: 'الكل' },
  { value: PENDING, label: 'بانتظار قرارك' },
  { value: 'CONFIRMED', label: 'مؤكد' },
  { value: 'PREPARING', label: 'قيد التحضير' },
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

// ===========================
// صور المنتجات مصغّرة
// ===========================
const ItemThumbs = ({ items = [] }) => (
  <div className="flex items-center -space-x-2 space-x-reverse">
    {items.slice(0, 3).map((it, i) => (
      <span key={i} className="w-10 h-10 rounded-lg bg-gray-100 ring-2 ring-white overflow-hidden flex-shrink-0">
        {it.productImageUrl && <img src={getImageUrl(it.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
      </span>
    ))}
    {items.length > 3 && (
      <span className="w-10 h-10 rounded-lg bg-gray-100 ring-2 ring-white text-xs font-bold text-gray-500 flex items-center justify-center">+{items.length - 3}</span>
    )}
  </div>
)

// ===========================
// بطاقة طلب
// ===========================
const OrderCard = ({ order, onOpen, onAccept, onReject, busy }) => {
  const pending = order.status === PENDING
  const count = order.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0
  const names = order.items?.map(it => it.productNameAr || it.productName).join('، ')
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${pending ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-gray-200'}`}>
      <button onClick={onOpen} className="w-full text-right p-4 hover:bg-gray-50/60">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 text-sm" dir="ltr">#{order.subOrderNumber}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} />{timeAgo(order.createdAt)}</span>
          <span className="mr-auto"><StatusBadge status={order.status} /></span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <ItemThumbs items={order.items} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{names || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{count} قطعة · {order.customerName}</p>
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
    </div>
  )
}

// ===========================
// تفاصيل الطلب — نافذة من الأسفل (هاتف) أو جانبية (كمبيوتر)
// ===========================
const OrderSheet = ({ order, onClose, onAccept, onReject, busy }) => {
  const pending = order.status === PENDING
  const wa = whatsappLink(order.customerPhone)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-start">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:w-[28rem] max-h-[92dvh] sm:max-h-none sm:h-full bg-white rounded-t-3xl sm:rounded-none flex flex-col animate-slide-up">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900" dir="ltr">#{order.subOrderNumber}</p>
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <StatusBadge status={order.status} />
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="إغلاق"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <span className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {it.productImageUrl && <img src={getImageUrl(it.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{it.productNameAr || it.productName}</p>
                  <p className="text-xs text-gray-500">× {it.quantity}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{money(it.subtotal)}</p>
              </div>
            ))}
            <div className="p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>المجموع الفرعي</span><span>{money(order.subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>التوصيل</span><span>{money(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100"><span>الإجمالي</span><span className="text-primary">{money(orderTotal(order))}</span></div>
            </div>
          </div>

          {order.cancellationReason && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-bold text-red-700">سبب الإلغاء</p>
              <p className="text-sm text-red-600 mt-0.5">{order.cancellationReason}</p>
            </div>
          )}
        </div>

        {pending && (
          <div className="grid grid-cols-2 gap-2 p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={onReject} disabled={busy}
              className="h-12 rounded-xl border border-red-200 text-red-600 font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              <XCircle size={18} />رفض
            </button>
            <button onClick={onAccept} disabled={busy}
              className="h-12 rounded-xl bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}قبول الطلب
            </button>
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

  const { data, isLoading, isError, refetch, isFetching } = useVendorOrders(vendorId, {
    pageNumber: currentPage,
    pageSize: 15,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  // كل الطلبات (بلا فلترة) لحساب أعداد الحالات
  const { data: allData } = useVendorOrders(vendorId, { pageNumber: 1, pageSize: 500 })

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor-orders', vendorId] })
    setOpenOrder(null)
    setRejecting(null)
  }

  const acceptMutation = useMutation({
    mutationFn: (o) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.CONFIRM_ORDER(vendorId, o.subOrderId)),
    onMutate: (o) => setBusyId(o.subOrderId),
    onSuccess: () => { success('تم قبول الطلب ✅'); afterChange() },
    onError: (err) => showError(err.message || 'فشل قبول الطلب'),
    onSettled: () => setBusyId(null),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ order, reason }) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.REJECT_ORDER(vendorId, order.subOrderId), { reason }),
    onMutate: ({ order }) => setBusyId(order.subOrderId),
    onSuccess: () => { success('تم رفض الطلب'); afterChange() },
    onError: (err) => showError(err.message || 'فشل رفض الطلب'),
    onSettled: () => setBusyId(null),
  })

  const all = allData?.items ?? []
  const countOf = (s) => s === 'all' ? (allData?.totalCount ?? all.length) : all.filter(o => o.status === s).length
  const pendingCount = countOf(PENDING)
  const pendingValue = all.filter(o => o.status === PENDING).reduce((s, o) => s + orderTotal(o), 0)

  const q = search.trim().toLowerCase()
  const orders = (data?.items ?? []).filter(o => !q ||
    (o.subOrderNumber || '').toLowerCase().includes(q) ||
    (o.orderNumber || '').toLowerCase().includes(q) ||
    (o.customerName || '').toLowerCase().includes(q) ||
    (o.customerPhone || '').includes(q))

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
          <p className="text-sm text-gray-500 mt-0.5">{countOf('all')} طلب · يتحدث تلقائياً كل دقيقة</p>
        </div>
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
        <input value={search} onChange={e => setSearch(e.target.value)}
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
              onAccept={() => acceptMutation.mutate(o)}
              onReject={() => setRejecting(o)}
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
        <OrderSheet order={openOrder} onClose={closeOrder}
          onAccept={() => acceptMutation.mutate(openOrder)}
          onReject={() => setRejecting(openOrder)}
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
