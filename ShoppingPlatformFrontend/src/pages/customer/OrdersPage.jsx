import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Package, RefreshCw, AlertCircle, ChevronLeft, RotateCcw, MapPin, Star, Truck, Check, Clock, X } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import Pagination from '../../components/common/Pagination'
import { Skeleton } from '../../components/common/Loading'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

const PAGE_SIZE = 10

// مراحل الطلب بالترتيب (لشريط التقدم)
const PROGRESS_STEPS = [
  { key: 'PENDING_CONFIRMATION', label: 'استلام' },
  { key: 'CONFIRMED',            label: 'تأكيد' },
  { key: 'PREPARING',            label: 'تحضير' },
  { key: 'OUT_FOR_DELIVERY',     label: 'في الطريق' },
  { key: 'DELIVERED',            label: 'توصيل' },
]

const STATUS_INFO = {
  PENDING_CONFIRMATION: { label: 'بانتظار التأكيد', color: 'bg-amber-100 text-amber-800', icon: Clock },
  CONFIRMED:            { label: 'تم التأكيد',      color: 'bg-blue-100 text-blue-700',   icon: Check },
  PARTIALLY_CONFIRMED:  { label: 'مؤكد جزئياً',     color: 'bg-blue-100 text-blue-700',   icon: Check },
  PREPARING:            { label: 'قيد التحضير',     color: 'bg-indigo-100 text-indigo-700', icon: Package },
  OUT_FOR_DELIVERY:     { label: 'في الطريق إليك',  color: 'bg-purple-100 text-purple-700', icon: Truck },
  DELIVERED:            { label: 'تم التوصيل',      color: 'bg-green-100 text-green-700', icon: Check },
  CANCELLED:            { label: 'ملغي',            color: 'bg-red-100 text-red-600',     icon: X },
  DELIVERY_FAILED:      { label: 'تعذّر التسليم',   color: 'bg-orange-100 text-orange-800', icon: X },
}

const ACTIVE_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PARTIALLY_CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY']

// مجموعات الفلترة — بدل سبعة تبويبات
const GROUPS = [
  { value: 'active',    label: 'الحالية',  match: (s) => ACTIVE_STATUSES.includes(s) },
  { value: 'delivered', label: 'المكتملة', match: (s) => s === 'DELIVERED' },
  { value: 'cancelled', label: 'الملغاة',  match: (s) => s === 'CANCELLED' || s === 'DELIVERY_FAILED' },
  { value: 'all',       label: 'الكل',     match: () => true },
]

const formatDate = (date) => {
  const d = new Date(date)
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days < 1) return `اليوم، ${d.toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' })}`
  if (days < 2) return 'أمس'
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })
}

// جلب كل طلبات العميل (القائمة صغيرة) — الفلترة والتقسيم لصفحات تتم في الواجهة
const useCustomerOrders = (customerId) => useQuery({
  queryKey: ['customer-orders-all', customerId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.ORDERS.BY_CUSTOMER(customerId))
    const list = r.data.data || r.data || []
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },
  enabled: !!customerId,
  staleTime: 60 * 1000,
})

// ===========================
// شريط تقدم الطلب
// ===========================
const OrderProgress = ({ status }) => {
  const normalized = status === 'PARTIALLY_CONFIRMED' ? 'CONFIRMED' : status
  const current = PROGRESS_STEPS.findIndex(s => s.key === normalized)
  if (current < 0) return null
  return (
    <div className="flex items-center gap-1" aria-label="مراحل الطلب">
      {PROGRESS_STEPS.map((step, i) => (
        <div key={step.key} className="flex-1 min-w-0">
          <div className={`h-1.5 rounded-full ${i <= current ? 'bg-primary' : 'bg-gray-200'} ${i === current ? 'motion-safe:animate-pulse' : ''}`} />
          <p className={`mt-1 text-[10px] text-center truncate ${i === current ? 'font-bold text-primary' : i < current ? 'text-gray-600' : 'text-gray-400'}`}>
            {step.label}
          </p>
        </div>
      ))}
    </div>
  )
}

// ===========================
// بطاقة الطلب
// ===========================
const OrderCard = ({ order, onReorder, reordering }) => {
  const navigate = useNavigate()
  const status = order.status?.toUpperCase()
  const info = STATUS_INFO[status] || STATUS_INFO.PENDING_CONFIRMATION
  const StatusIcon = info.icon
  const items = (order.subOrders || []).flatMap(s => s.items || [])
  const itemsCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0)
  const vendorNames = [...new Set((order.subOrders || []).map(s => s.vendorNameAr || s.vendorName).filter(Boolean))]
  const isActive = ACTIVE_STATUSES.includes(status)
  const firstName = items[0]?.productNameAr || items[0]?.productName
  const shown = items.slice(0, 3)
  const more = items.length - shown.length
  const detailsUrl = `/orders/${order.orderNumber}`

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <Link to={detailsUrl} className="block p-4">
        {/* الحالة والتاريخ */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${info.color}`}>
            <StatusIcon size={13} />{info.label}
          </span>
          <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
        </div>

        {/* المنتجات */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3 space-x-reverse flex-shrink-0">
            {shown.map((item, i) => (
              <div key={item.id || i}
                className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 ring-2 ring-white">
                {item.productImageUrl && <img src={getImageUrl(item.productImageUrl)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                {i === shown.length - 1 && more > 0 && (
                  <span className="absolute inset-0 bg-black/55 text-white text-xs font-bold flex items-center justify-center" dir="ltr">+{more}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-1">{firstName}</p>
            {items.length > 1 && (
              <p className="text-xs text-gray-500">+ {items.length - 1} {items.length - 1 === 1 ? 'منتج آخر' : 'منتجات أخرى'}</p>
            )}
            {vendorNames.length > 0 && (
              <p className="text-xs text-gray-500 truncate mt-0.5">من {vendorNames.join('، ')}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">طلب <span dir="ltr">#{order.orderNumber}</span></p>
          </div>
          <ChevronLeft size={18} className="text-gray-300 flex-shrink-0" />
        </div>

        {/* تقدم الطلب */}
        {isActive && (
          <div className="mt-4">
            <OrderProgress status={status} />
          </div>
        )}

        {status === 'CANCELLED' && order.cancellationReason && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 line-clamp-2">سبب الإلغاء: {order.cancellationReason}</p>
        )}
      </Link>

      {/* المجموع والإجراءات */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-500">{itemsCount} قطعة</p>
          <p className="font-bold text-gray-900">{(order.totalAmount || 0).toLocaleString()} د.ع</p>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <button onClick={() => navigate(`${detailsUrl}#order-tracking`)}
              className="h-9 px-4 rounded-full bg-primary text-white text-sm font-bold flex items-center gap-1.5">
              <MapPin size={15} />تتبع الطلب
            </button>
          ) : (
            <>
              {status === 'DELIVERED' && (
                <button onClick={() => navigate(detailsUrl)}
                  className="h-9 px-3 rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-medium flex items-center gap-1.5">
                  <Star size={15} className="text-amber-500" />قيّم
                </button>
              )}
              <button onClick={() => onReorder(order)} disabled={reordering}
                className="h-9 px-4 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
                <RotateCcw size={15} className={reordering ? 'animate-spin' : ''} />إعادة الطلب
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const OrderCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
    <div className="flex justify-between"><Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-4 w-20" /></div>
    <div className="flex gap-3"><Skeleton className="w-14 h-14 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
    <Skeleton className="h-10 w-full rounded-xl" />
  </div>
)

// ===========================
// الصفحة
// ===========================
const OrdersPage = () => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const [reorderingId, setReorderingId] = useState(null)

  const userId = user?.userId || user?.id
  const { data: allOrders = [], isLoading, isFetching, isError, error, refetch } = useCustomerOrders(userId)

  const counts = useMemo(() => Object.fromEntries(
    GROUPS.map(g => [g.value, allOrders.filter(o => g.match(o.status?.toUpperCase())).length])
  ), [allOrders])

  // الافتراضي: الطلبات الحالية إن وُجدت، وإلا الكل
  const groupParam = searchParams.get('group')
  const group = GROUPS.some(g => g.value === groupParam) ? groupParam : (counts.active > 0 ? 'active' : 'all')
  const currentPage = parseInt(searchParams.get('page')) || 1

  const filtered = allOrders.filter(o => GROUPS.find(g => g.value === group).match(o.status?.toUpperCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const setGroup = (value) => setSearchParams({ group: value }, { replace: true })
  const handlePageChange = (page) => {
    setSearchParams({ group, page: String(page) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReorder = async (order) => {
    setReorderingId(order.id)
    try {
      const items = (order.subOrders || []).flatMap(s => s.items || [])
      for (const item of items) {
        await addToCart(item.productId, item.quantity, item.variantId || null)
      }
      success('تمت إضافة منتجات الطلب للسلة')
      navigate('/cart')
    } catch (err) {
      showError(err.message || 'تعذّرت إضافة بعض المنتجات — قد تكون غير متوفرة')
    } finally {
      setReorderingId(null)
    }
  }

  if (!isAuthenticated) {
    navigate('/login', { state: { from: '/orders' } })
    return null
  }

  const emptyText = {
    active: 'لا توجد طلبات قيد التنفيذ حالياً',
    delivered: 'لم يتم توصيل أي طلب بعد',
    cancelled: 'لا توجد طلبات ملغاة',
    all: 'لم تقم بأي طلب بعد',
  }[group]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-4 lg:py-6 max-w-4xl">
        <Breadcrumb items={[{ label: 'طلباتي' }]} className="mb-6 hidden lg:block" />

        {/* العنوان */}
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            طلباتي
            {allOrders.length > 0 && (
              <span className="min-w-[26px] h-[26px] px-2 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center">
                {allOrders.length}
              </span>
            )}
          </h1>
          <button onClick={() => refetch()} disabled={isFetching} aria-label="تحديث"
            className="w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-600 flex items-center justify-center disabled:opacity-60">
            <RefreshCw size={17} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* المجموعات */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-2xl mb-4">
          {GROUPS.map(g => (
            <button key={g.value} onClick={() => setGroup(g.value)}
              className={`h-10 rounded-xl text-sm transition-colors flex items-center justify-center gap-1 ${
                group === g.value ? 'bg-white text-gray-900 font-bold shadow-sm' : 'text-gray-500 font-medium'
              }`}>
              {g.label}
              {counts[g.value] > 0 && g.value !== 'all' && (
                <span className={`text-[11px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${
                  group === g.value ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {counts[g.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm flex-1">{error?.message || 'فشل تحميل الطلبات'}</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>إعادة المحاولة</Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            {[1, 2, 3, 4].map(i => <OrderCardSkeleton key={i} />)}
          </div>
        ) : pageOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200">
            <EmptyState
              type="orders"
              title="لا توجد طلبات"
              description={emptyText}
              action={<Button variant="primary" onClick={() => navigate('/products')}>تصفح المنتجات</Button>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            {pageOrders.map(order => (
              <OrderCard key={order.id} order={order} onReorder={handleReorder} reordering={reorderingId === order.id} />
            ))}
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </div>
  )
}

export default OrdersPage
