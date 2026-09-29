import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, Eye, RefreshCw, AlertCircle,
  Package, Truck, CheckCircle, XCircle, Clock, MapPin, Phone,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { StatusBadge } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger } from '../../components/common/Tabs'
import Pagination from '../../components/common/Pagination'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

// ===========================
// Hook
// ===========================

const useVendorOrders = (vendorId, params = {}) => useQuery({
  queryKey: ['vendor-orders', vendorId, params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDERS(vendorId), params)
    const raw = r.data
    if (raw?.data && raw?.pagination) {
      return {
        items:      Array.isArray(raw.data) ? raw.data : [],
        totalPages: raw.pagination.totalPages ?? 1,
        totalCount: raw.pagination.totalCount ?? 0,
      }
    }
    return { items: Array.isArray(raw?.data) ? raw.data : [], totalPages: 1, totalCount: 0 }
  },
  enabled: !!vendorId,
  staleTime: 1 * 60 * 1000,
})

// ===========================
// Order Detail Modal
// ===========================

const OrderModal = ({ order, onClose, onConfirm, onReject, updating }) => {
  if (!order) return null

  const total = (order.subtotal ?? 0) + (order.deliveryFee ?? 0)
  const isPending = order.status === 'PENDING_CONFIRMATION'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg">#{order.subOrderNumber}</h3>
            <p className="text-xs text-gray-400">طلب رئيسي: #{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('ar-IQ')}</p>
          </div>

          {/* Customer */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 mb-2">معلومات العميل</p>
            <p className="font-medium text-gray-900 text-sm">{order.customerName}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1" dir="ltr">
              <Phone size={12} />{order.customerPhone}
            </p>
            {order.deliveryAddress && (
              <p className="text-sm text-gray-500 flex items-start gap-1">
                <MapPin size={12} className="mt-0.5 flex-shrink-0" />{order.deliveryAddress}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 px-4 py-2 bg-gray-50 border-b border-gray-200">
              المنتجات
            </p>
            {order.items?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد منتجات</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      <img src={getImageUrl(item.productImageUrl) || item.productImageUrl}
                        alt="" className="w-full h-full object-cover"
                        onError={e => e.target.style.display='none'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.productNameAr || item.productName}
                      </p>
                      <p className="text-xs text-gray-400">الكمية: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                      {(item.subtotal ?? 0).toLocaleString()} د.ع
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>المجموع الفرعي</span>
                <span>{(order.subtotal ?? 0).toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>رسوم التوصيل</span>
                <span>{(order.deliveryFee ?? 0).toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                <span>الإجمالي</span>
                <span className="text-primary">{total.toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>

          {/* Cancellation reason */}
          {order.cancellationReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">سبب الإلغاء:</p>
              <p className="text-sm text-red-600">{order.cancellationReason}</p>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex gap-2 pt-2">
              <Button variant="danger" fullWidth loading={updating} onClick={() => onReject(order.subOrderId)}>
                <XCircle size={15} className="ml-1" />رفض الطلب
              </Button>
              <Button variant="primary" fullWidth loading={updating} onClick={() => onConfirm(order.subOrderId)}>
                <CheckCircle size={15} className="ml-1" />قبول الطلب
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const VendorOrders = () => {
  const { success, error: showError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const queryClient = useQueryClient()

  const currentPage  = parseInt(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || 'all'

  const [search, setSearch]         = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

  const { data, isLoading, isError, refetch } = useVendorOrders(vendorId, {
    pageNumber: currentPage,
    pageSize:   15,
    status:     statusFilter !== 'all' ? statusFilter : undefined,
  })

  // ✅ طلب منفصل بلا فلترة حالة، فقط لحساب أعداد التبويبات — لا يتأثر بالتبويب المختار حاليًا
  const { data: allStatusesData } = useVendorOrders(vendorId, {
    pageNumber: 1,
    pageSize:   500,
  })

  const { mutateAsync: confirmOrder, isPending: confirming } = useMutation({
    mutationFn: (subOrderId) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.CONFIRM_ORDER(vendorId, subOrderId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-orders', vendorId] })
      success('تم قبول الطلب ✅')
      setSelectedOrder(null)
    },
    onError: (err) => showError(err.message || 'فشل قبول الطلب'),
  })

  const { mutateAsync: rejectOrder, isPending: rejecting } = useMutation({
    mutationFn: (subOrderId) => apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.REJECT_ORDER(vendorId, subOrderId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-orders', vendorId] })
      success('تم رفض الطلب')
      setSelectedOrder(null)
    },
    onError: (err) => showError(err.message || 'فشل رفض الطلب'),
  })

  const orders     = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const totalCount = data?.totalCount ?? 0
  const updating   = confirming || rejecting

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.subOrderNumber || '').toLowerCase().includes(q)
      || (o.customerName || '').toLowerCase().includes(q)
      || (o.orderNumber   || '').toLowerCase().includes(q)
  })

  // counts per status — تُحسب دائمًا من كل الطلبات بلا فلترة، فتبقى ثابتة بغض النظر عن التبويب المختار
  const allOrders = allStatusesData?.items ?? []
  const counts = {
    PENDING_CONFIRMATION: allOrders.filter(o => o.status === 'PENDING_CONFIRMATION').length,
    CONFIRMED:            allOrders.filter(o => o.status === 'CONFIRMED').length,
    PREPARING:            allOrders.filter(o => o.status === 'PREPARING').length,
    OUT_FOR_DELIVERY:     allOrders.filter(o => o.status === 'OUT_FOR_DELIVERY').length,
    DELIVERED:            allOrders.filter(o => o.status === 'DELIVERED').length,
    CANCELLED:            allOrders.filter(o => o.status === 'CANCELLED').length,
  }
  const allOrdersCount = allStatusesData?.totalCount ?? allOrders.length

  const STATUS_TABS = [
    { value: 'all',                   label: `الكل (${allOrdersCount})` },
    { value: 'PENDING_CONFIRMATION',  label: `بانتظار (${counts.PENDING_CONFIRMATION})` },
    { value: 'CONFIRMED',             label: `مؤكد (${counts.CONFIRMED})` },
    { value: 'PREPARING',             label: `تحضير (${counts.PREPARING})` },
    { value: 'OUT_FOR_DELIVERY',      label: `توصيل (${counts.OUT_FOR_DELIVERY})` },
    { value: 'DELIVERED',             label: `مكتمل (${counts.DELIVERED})` },
    { value: 'CANCELLED',             label: `ملغي (${counts.CANCELLED})` },
  ]

  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الطلبات</h1>
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">فشل تحميل الطلبات</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
          <p className="text-gray-500 mt-1">{totalCount} طلب</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'بانتظار',  count: counts.PENDING_CONFIRMATION, icon: Clock,        color: 'text-yellow-500' },
          { label: 'مؤكد',     count: counts.CONFIRMED,            icon: CheckCircle,  color: 'text-blue-500'   },
          { label: 'تحضير',    count: counts.PREPARING,            icon: Package,      color: 'text-indigo-500' },
          { label: 'توصيل',    count: counts.OUT_FOR_DELIVERY,     icon: Truck,        color: 'text-purple-500' },
          { label: 'مكتمل',    count: counts.DELIVERED,            icon: CheckCircle,  color: 'text-green-500'  },
          { label: 'ملغي',     count: counts.CANCELLED,            icon: XCircle,      color: 'text-red-500'    },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <s.icon size={18} className={`${s.color} mx-auto mb-1`} />
            <p className="text-2xl font-bold text-gray-900">{s.count}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="البحث برقم الطلب أو اسم العميل..."
              className="w-full h-9 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={v => {
          const p = new URLSearchParams(searchParams)
          if (v === 'all') p.delete('status'); else p.set('status', v)
          p.set('page', '1')
          setSearchParams(p)
        }}>
          <div className="border-b border-gray-200 overflow-x-auto">
            <TabsList className="px-4">
              {STATUS_TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
            </TabsList>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد طلبات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['رقم الطلب','العميل','المنتجات','المبلغ','التاريخ','الحالة',''].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(order => (
                    <tr key={order.subOrderId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary text-xs">{order.subOrderNumber}</p>
                        <p className="text-xs text-gray-400">{order.orderNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{order.customerName}</p>
                        <p className="text-xs text-gray-400" dir="ltr">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        {order.items?.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-gray-600 truncate max-w-32">
                            {item.productNameAr || item.productName} ×{item.quantity}
                          </p>
                        ))}
                        {(order.items?.length ?? 0) > 2 && (
                          <p className="text-xs text-gray-400">+{order.items.length - 2} أخرى</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {((order.subtotal ?? 0) + (order.deliveryFee ?? 0)).toLocaleString()} د.ع
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedOrder(order)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs>

        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages}
              onPageChange={p => { const ps = new URLSearchParams(searchParams); ps.set('page', p.toString()); setSearchParams(ps) }} />
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirm={confirmOrder}
          onReject={rejectOrder}
          updating={updating}
        />
      )}
    </div>
  )
}

export default VendorOrders