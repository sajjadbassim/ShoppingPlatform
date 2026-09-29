// src/pages/operations/OperationsOrders.jsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, ChevronDown, ChevronUp, Truck, Package, Clock,
  CheckCircle, XCircle, MapPin, User, RefreshCw,
  AlertCircle, Store, Calendar, Phone, FileText,
  Loader2
} from 'lucide-react'
import Button from '../../components/common/Button'
import { StatusBadge } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger } from '../../components/common/Tabs'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import Select from '../../components/common/Select'
import EmptyState from '../../components/common/EmptyState'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import {
  useOrdersPaged,
  useOrder,
  useConfirmSubOrder,
  useCancelSubOrder,
  useUpdateSubOrderStatus,
  useAssignDriverToOrder,
  useAvailableDrivers,
} from '../../hooks/useOrders'

// ===========================
// Helpers
// ===========================

const STATUS_CONFIG = {
  PENDING_CONFIRMATION: { label: 'قيد الانتظار',  bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badgeBg: 'bg-yellow-100', dot: 'bg-yellow-500', icon: Clock       },
  CONFIRMED:            { label: 'مؤكد',           bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badgeBg: 'bg-blue-100',   dot: 'bg-blue-500',   icon: CheckCircle },
  PARTIALLY_CONFIRMED:  { label: 'مؤكد جزئياً',    bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700',   badgeBg: 'bg-cyan-100',   dot: 'bg-cyan-500',   icon: Package     },
  PREPARING:            { label: 'قيد التحضير',    bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badgeBg: 'bg-indigo-100', dot: 'bg-indigo-500', icon: Package     },
  OUT_FOR_DELIVERY:     { label: 'قيد التوصيل',    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badgeBg: 'bg-purple-100', dot: 'bg-purple-500', icon: Truck       },
  DELIVERED:            { label: 'تم التوصيل',     bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  badgeBg: 'bg-green-100',  dot: 'bg-green-500',  icon: CheckCircle },
  CANCELLED:            { label: 'ملغي',           bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600',    badgeBg: 'bg-red-100',    dot: 'bg-red-500',    icon: XCircle     },
}

const sc = (status) => STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', badgeBg: 'bg-gray-100', dot: 'bg-gray-400', icon: Package }

const TAB_STATUSES = [
  { value: 'all',                    label: 'الكل'           },
  { value: 'PENDING_CONFIRMATION',   label: 'قيد الانتظار'   },
  { value: 'CONFIRMED',              label: 'مؤكد'           },
  { value: 'PARTIALLY_CONFIRMED',    label: 'مؤكد جزئياً'    },
  { value: 'PREPARING',              label: 'قيد التحضير'    },
  { value: 'OUT_FOR_DELIVERY',       label: 'قيد التوصيل'    },
  { value: 'DELIVERED',              label: 'تم التوصيل'     },
  { value: 'CANCELLED',              label: 'ملغي'           },
]

const fmt = {
  date: (d) => d ? new Date(d).toLocaleDateString('ar-IQ') : '-',
  time: (d) => d ? new Date(d).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '',
  price: (p) => (p || 0).toLocaleString() + ' د.ع',
}

// ✅ هل كل الطلبات الفرعية الفعالة جاهزة (PREPARING) لتعيين سائق موحّد لكامل الطلب؟
const isOrderReadyForDriver = (subs) => {
  const active = (subs || []).filter(s => s.status !== 'CANCELLED')
  if (active.length === 0) return false
  return active.every(s => s.status === 'PREPARING')
}

// ===========================
// SubOrder Card (داخل الطلب الرئيسي)
// ===========================

const SubOrderCard = ({ sub, onConfirm, onCancel, onUpdateStatus }) => {
  const s = sc(sub.status)
  const Icon = s.icon

  return (
    <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-4 transition-all hover:shadow-sm`}>
      {/* Header: Store + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${s.badgeBg} flex items-center justify-center`}>
            <Store size={16} className={s.text} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm leading-tight">
              {sub.vendorNameAr || sub.vendorName || 'متجر'}
            </h4>
            <span className="text-xs text-gray-400">#{sub.subOrderNumber}</span>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${s.badgeBg} ${s.text}`}>
          <Icon size={12} />
          {s.label}
        </span>
      </div>

      {/* Items */}
      <div className="bg-white/60 rounded-lg p-3 mb-3 space-y-2">
        {(sub.items || []).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                {item.quantity}
              </span>
              <span className="text-gray-800 truncate">{item.productNameAr || item.productName}</span>

              {/* ✅ الـ variant المختار */}
              {item.variantAttributes?.map((attr, i) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mr-1">
                  {attr.attributeNameAr}: {attr.valueAr}
                </span>
              ))}
            </div>
            <span className="text-gray-500 text-xs font-medium mr-2">{fmt.price(item.subtotal)}</span>
          </div>
        ))}
        {(!sub.items || sub.items.length === 0) && (
          <p className="text-xs text-gray-400 text-center py-1">لا توجد منتجات</p>
        )}
      </div>

      {/* Driver */}
      {sub.driverName && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-white/60 rounded-lg p-2">
          <Truck size={13} className="text-purple-400" />
          <span>{sub.driverName}</span>
          {sub.driverPhone && <span className="text-gray-400">({sub.driverPhone})</span>}
        </div>
      )}

      {/* Footer: Total + Actions */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900">{fmt.price(sub.total)}</span>

        <div className="flex items-center gap-1.5">
          {sub.status === 'PENDING_CONFIRMATION' && (
            <>
              <Button variant="primary" size="sm" onClick={() => onConfirm(sub.id)}>
                <CheckCircle size={13} className="ml-1" />تأكيد
              </Button>
              <Button variant="danger" size="sm" onClick={() => onCancel(sub)}>
                إلغاء
              </Button>
            </>
          )}
          {sub.status === 'CONFIRMED' && (
            <Button variant="primary" size="sm" onClick={() => onUpdateStatus(sub.id, 'PREPARING')}>
              <Package size={13} className="ml-1" />بدء التحضير
            </Button>
          )}
          {/* ✅ زر "تعيين سائق" اتحذف من هنا — التعيين صار على مستوى الطلب الرئيسي */}
          {sub.status === 'OUT_FOR_DELIVERY' && (
            <Button variant="primary" size="sm" onClick={() => onUpdateStatus(sub.id, 'DELIVERED')}>
              <CheckCircle size={13} className="ml-1" />تم التوصيل
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ===========================
// Order Card (الطلب الرئيسي) - Expandable
// ===========================

const OrderCard = ({ order, isExpanded, onToggle, subOrders, subOrdersLoading, onConfirm, onCancel, onUpdateStatus, onAssignDriver }) => {
  const s = sc(order.status)
  const Icon = s.icon
  const subs = subOrders || order.subOrders || []
  const readyForDriver = isOrderReadyForDriver(subs) // ✅ جديد

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-200 shadow-sm hover:shadow-md'
    }`}>

      {/* ===== Card Header (always visible) ===== */}
      <div
        className="bg-white p-5 cursor-pointer"
        onClick={onToggle}
      >
        {/* Row 1: Order Number + Status + Date */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${s.badgeBg} flex items-center justify-center`}>
              <Icon size={20} className={s.text} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-gray-900">#{order.orderNumber}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.badgeBg} ${s.text}`}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <Calendar size={12} />
                <span>{fmt.date(order.createdAt)}</span>
                <span>•</span>
                <span>{fmt.time(order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Total + Assign Driver + Expand */}
          <div className="flex items-center gap-3">
            <div className="text-left">
              <p className="text-xs text-gray-400">الإجمالي</p>
              <p className="font-bold text-lg text-gray-900">{fmt.price(order.totalAmount || order.total)}</p>
            </div>

            {/* ✅ زر جديد: يظهر فقط لما كل الطلبات الفرعية الفعالة تكون PREPARING */}
            {readyForDriver && (
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onAssignDriver(order) }}
              >
                <Truck size={14} className="ml-1" />تعيين سائق
              </Button>
            )}

            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isExpanded ? 'bg-primary/10' : 'bg-gray-100'
            }`}>
              {isExpanded
                ? <ChevronUp size={16} className="text-primary" />
                : <ChevronDown size={16} className="text-gray-400" />
              }
            </div>
          </div>
        </div>

        {/* Row 2: Customer Info */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
              <User size={14} className="text-gray-500" />
            </div>
            <span className="font-medium">{order.customerName || 'عميل'}</span>
          </div>

          {order.customerPhone && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Phone size={13} className="text-gray-400" />
              <span>{order.customerPhone}</span>
            </div>
          )}

          {(order.deliveryAddress || order.address) && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 truncate max-w-xs">
              <MapPin size={13} className="text-gray-400 shrink-0" />
              <span className="truncate">{order.deliveryAddress || order.address}</span>
            </div>
          )}

          {/* SubOrders count badge */}
          <div className="flex items-center gap-1.5 mr-auto">
            <Store size={13} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {(order.subOrders || []).length || '—'} متجر
            </span>
          </div>
        </div>

        {/* Customer Notes */}
        {order.customerNotes && (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-2.5">
            <FileText size={14} className="shrink-0 mt-0.5" />
            <span>{order.customerNotes}</span>
          </div>
        )}
      </div>

      {/* ===== Expanded Content: SubOrders ===== */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store size={16} className="text-gray-500" />
            <h4 className="font-bold text-gray-700 text-sm">الطلبات الفرعية</h4>
            {subs.length > 0 && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{subs.length}</span>
            )}
          </div>

          {subOrdersLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                  <Skeleton className="h-5 w-32 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-8 w-24 mt-3" />
                </div>
              ))}
            </div>
          ) : subs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {subs.map(sub => (
                <SubOrderCard
                  key={sub.id}
                  sub={sub}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  onUpdateStatus={onUpdateStatus}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">لا توجد طلبات فرعية</p>
              <p className="text-xs mt-1">قد تحتاج لجلب التفاصيل من السيرفر</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const OperationsOrders = () => {
  const { success, error: toastError } = useToast()
  const { user } = useAuthStore()
  const opsUserId = user?.userId || user?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const currentPage = parseInt(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || 'all'

  // States
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  // Form
  const [confirmOrderId, setConfirmOrderId] = useState(null)
  const [confirmNotes, setConfirmNotes] = useState('')
  const [selectedSubOrder, setSelectedSubOrder] = useState(null) // ✅ الآن يخزن الـ Order كامل عند فتح مودال تعيين السائق
  const [selectedDriver, setSelectedDriver] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')

  // ===== Queries =====
  const { data, isLoading, isError, error, refetch } = useOrdersPaged({
    PageNumber: currentPage,
    PageSize: 10,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    orderNumber: searchQuery || undefined,
  })

  // جلب تفاصيل الطلب المفتوح (يحتوي على subOrders)
  const { data: expandedOrderData, isLoading: expandedLoading } = useOrder(expandedOrderId)

  const { data: availableDriversData } = useAvailableDrivers()
  const availableDrivers = availableDriversData || []

  // استخراج الطلبات - نحاول عدة بنى ممكنة للـ response
  const rawData = data?.data || data
  const orders = rawData?.items || (Array.isArray(rawData) ? rawData : [])
  const totalPages = rawData?.totalPages || 1
  const totalCount = rawData?.totalCount || orders.length

  // ===== Mutations =====
  const { mutateAsync: confirmSubOrder, isPending: confirming } = useConfirmSubOrder()
  const { mutateAsync: cancelSubOrder, isPending: cancelling } = useCancelSubOrder()
  const { mutateAsync: updateStatus, isPending: updatingStatus } = useUpdateSubOrderStatus()
  const { mutateAsync: assignDriverToOrder, isPending: assigning } = useAssignDriverToOrder() // ✅ تعديل

  // ===== Toggle Expand =====
  const handleToggle = (orderId) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId)
  }

  // ===== Navigation =====
  const handleStatusChange = (status) => {
    const params = new URLSearchParams(searchParams)
    status === 'all' ? params.delete('status') : params.set('status', status)
    params.set('page', '1')
    setSearchParams(params)
    setExpandedOrderId(null)
  }

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    setSearchParams(params)
    setExpandedOrderId(null)
  }

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      const params = new URLSearchParams(searchParams)
      params.set('page', '1')
      setSearchParams(params)
      refetch()
    }
  }

  // ===== SubOrder Actions =====
  const handleOpenConfirm = (subOrderId) => {
    setConfirmOrderId(subOrderId)
    setConfirmNotes('')
    setShowConfirmModal(true)
  }

  const handleConfirm = async () => {
    try {
      await confirmSubOrder({ id: confirmOrderId, data: { opsUserId, notes: confirmNotes } })
      success('تم تأكيد الطلب الفرعي بنجاح')
      setShowConfirmModal(false)
      refetch()
    } catch (err) { toastError(err.message || 'فشل تأكيد الطلب') }
  }

  const handleUpdateStatus = async (subOrderId, newStatus) => {
    try {
      await updateStatus({ id: subOrderId, data: { opsUserId, newStatus } })
      success('تم تحديث الحالة')
      refetch()
    } catch (err) { toastError(err.message || 'فشل تحديث الحالة') }
  }

  const handleOpenCancel = (subOrder) => {
    setSelectedSubOrder(subOrder)
    setCancellationReason('')
    setShowCancelModal(true)
  }

  const handleCancel = async () => {
    if (!cancellationReason.trim()) { toastError('يجب إدخال سبب الإلغاء'); return }
    try {
      await cancelSubOrder({ id: selectedSubOrder.id, data: { opsUserId, cancellationReason } })
      success('تم إلغاء الطلب الفرعي')
      setShowCancelModal(false)
      refetch()
    } catch (err) { toastError(err.message || 'فشل إلغاء الطلب') }
  }

  // ✅ تعديل: تستقبل الآن الطلب الرئيسي (order) كامل، مو الـ SubOrder
  const handleOpenAssign = (order) => {
    setSelectedSubOrder(order)
    setSelectedDriver('')
    setShowAssignModal(true)
  }

  // ✅ تعديل: تستدعي endpoint تعيين السائق لكامل الطلب
  const handleAssignDriver = async () => {
    if (!selectedDriver) { toastError('يجب اختيار سائق'); return }
    try {
      await assignDriverToOrder({
        orderId: selectedSubOrder.id,
        data: { driverId: selectedDriver, opsUserId }
      })
      success('تم تعيين السائق لكامل الطلب بنجاح')
      setShowAssignModal(false)
      refetch()
    } catch (err) { toastError(err.message || 'فشل تعيين السائق') }
  }

  // ===== Error State =====
  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الطلبات</h1>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{error?.message || 'فشل في تحميل الطلبات'}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>إعادة المحاولة</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الطلبات</h1>
          <p className="text-gray-500 mt-1">{totalCount} طلب</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span className="mr-1">تحديث</span>
        </Button>
      </div>

      {/* ===== Status Cards ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const isActive = statusFilter === key
          return (
            <button
              key={key}
              onClick={() => handleStatusChange(key)}
              className={`rounded-xl border-2 p-3 text-center transition-all ${
                isActive
                  ? `${cfg.border} ${cfg.bg} shadow-sm`
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <Icon size={18} className={`mx-auto mb-1 ${isActive ? cfg.text : 'text-gray-400'}`} />
              <p className={`text-xs font-medium ${isActive ? cfg.text : 'text-gray-500'}`}>{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* ===== Search + Tabs ===== */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="البحث برقم الطلب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchSubmit}
              className="w-full h-10 pr-10 pl-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
            />
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={handleStatusChange}>
          <div className="px-4 border-b border-gray-100 overflow-x-auto">
            <TabsList>
              {TAB_STATUSES.map(s => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* ===== Orders List (Cards) ===== */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-11 h-11 rounded-xl" />
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="mr-auto">
                  <Skeleton className="h-6 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <EmptyState
            title="لا توجد طلبات"
            description={
              searchQuery ? 'لم يتم العثور على طلبات تطابق البحث'
              : statusFilter !== 'all' ? 'لا توجد طلبات في هذه الفئة'
              : 'لا توجد طلبات حالياً'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const isExpanded = expandedOrderId === order.id
            // عند التوسع: استخدم البيانات المجلوبة من getById (تحتوي subOrders)
            // أو استخدم subOrders الموجودة في order نفسه إن وُجدت
            const detailedSubOrders = isExpanded && expandedOrderData?.subOrders
              ? expandedOrderData.subOrders
              : order.subOrders || []

            return (
              <OrderCard
                key={order.id}
                order={isExpanded && expandedOrderData ? { ...order, ...expandedOrderData } : order}
                isExpanded={isExpanded}
                onToggle={() => handleToggle(order.id)}
                subOrders={detailedSubOrders}
                subOrdersLoading={isExpanded && expandedLoading}
                onConfirm={handleOpenConfirm}
                onCancel={handleOpenCancel}
                onUpdateStatus={handleUpdateStatus}
                onAssignDriver={handleOpenAssign}
              />
            )
          })}
        </div>
      )}

      {/* ===== Pagination ===== */}
      {!isLoading && totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {/* ===== Confirm Modal ===== */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="تأكيد الطلب الفرعي" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">هل تريد تأكيد هذا الطلب الفرعي؟</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظات <span className="text-gray-400 text-xs">(اختياري)</span>
            </label>
            <textarea
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
              placeholder="أدخل أي ملاحظات..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowConfirmModal(false)}>تراجع</Button>
            <Button variant="primary" fullWidth loading={confirming} onClick={handleConfirm}>تأكيد الطلب</Button>
          </div>
        </div>
      </Modal>

      {/* ===== Cancel Modal ===== */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="إلغاء الطلب الفرعي" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            إلغاء الطلب من <span className="font-bold">{selectedSubOrder?.vendorNameAr || selectedSubOrder?.vendorName}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              سبب الإلغاء <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="أدخل سبب الإلغاء..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-400 bg-gray-50"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowCancelModal(false)}>تراجع</Button>
            <Button variant="danger" fullWidth loading={cancelling} onClick={handleCancel}>تأكيد الإلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* ===== Assign Driver Modal ===== */}
      {/* ✅ ملاحظة: selectedSubOrder هنا يحمل الطلب الرئيسي (Order) كامل عند فتح هذا المودال تحديداً */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="تعيين سائق" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            تعيين سائق لكامل الطلب <span className="font-bold">#{selectedSubOrder?.orderNumber}</span>
          </p>
          {availableDrivers.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 text-center">
              <Truck size={24} className="mx-auto mb-2 text-yellow-400" />
              لا يوجد سائقين متاحين حالياً
            </div>
          ) : (
            <Select
              label="اختر السائق"
              options={availableDrivers.map(d => ({
                value: d.id,
                label: `${d.fullName} — ${d.vehicleType === 'motorcycle' ? 'دراجة نارية' : d.vehicleType === 'car' ? 'سيارة' : 'دراجة'}`,
              }))}
              value={selectedDriver}
              onChange={setSelectedDriver}
              placeholder="اختر السائق المتاح"
            />
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="ghost" fullWidth onClick={() => setShowAssignModal(false)}>إلغاء</Button>
            <Button
              variant="primary" fullWidth
              disabled={!selectedDriver || availableDrivers.length === 0}
              loading={assigning}
              onClick={handleAssignDriver}
            >
              تعيين السائق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default OperationsOrders