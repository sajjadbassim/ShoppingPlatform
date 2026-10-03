// src/pages/admin/AdminOrders.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Search, RefreshCw, Eye, X,
  MapPin, Phone, Package, User, CreditCard,
} from 'lucide-react'
import { StatusBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useQuery } from '@tanstack/react-query'
import { getImageUrl } from '../../utils/imageHelper'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { DurationChip } from '../../components/common/OrderTiming'
import { useOrderTimings } from '../../hooks/useOrderTiming'

const STATUS_OPTIONS = [
  { value: '',                      label: 'الكل'           },
  { value: 'PENDING_CONFIRMATION',  label: 'قيد الانتظار'  },
  { value: 'CONFIRMED',             label: 'مؤكد'           },
  { value: 'PREPARING',             label: 'قيد التحضير'   },
  { value: 'READY',                 label: 'جاهز للاستلام' },
  { value: 'OUT_FOR_DELIVERY',      label: 'قيد التوصيل'   },
  { value: 'DELIVERED',             label: 'تم التوصيل'    },
  { value: 'DELIVERY_FAILED',       label: 'تعذّر التسليم' },
  { value: 'CANCELLED',             label: 'ملغي'           },
]


// ===========================
// Order Detail Modal
// ===========================

const statusLabels = {
  PENDING_CONFIRMATION: { label: 'قيد الانتظار',  color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED:            { label: 'مؤكد',           color: 'bg-blue-100 text-blue-700'    },
  PARTIALLY_CONFIRMED:  { label: 'مؤكد جزئياً',   color: 'bg-cyan-100 text-cyan-700'    },
  PREPARING:            { label: 'قيد التحضير',   color: 'bg-indigo-100 text-indigo-700'},
  READY:                { label: 'جاهز للاستلام', color: 'bg-teal-100 text-teal-700'},
  OUT_FOR_DELIVERY:     { label: 'قيد التوصيل',   color: 'bg-purple-100 text-purple-700'},
  DELIVERED:            { label: 'تم التوصيل',    color: 'bg-green-100 text-green-700'  },
  CANCELLED:            { label: 'ملغي',           color: 'bg-red-100 text-red-600'      },
  DELIVERY_FAILED:      { label: 'تعذّر التسليم',  color: 'bg-orange-100 text-orange-800'},
}

const OrderDetailModal = ({ orderId, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-order-detail', orderId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ORDERS.BY_ID(orderId))
      return r.data.data || r.data
    },
    enabled: !!orderId,
    staleTime: 2 * 60 * 1000,
  })

  const order = data
  const s = statusLabels[order?.status] || { label: order?.status, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">
            {order ? `طلب #${order.orderNumber}` : 'تفاصيل الطلب'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">جاري التحميل...</div>
        ) : !order ? (
          <div className="p-8 text-center text-gray-400">لم يتم العثور على الطلب</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Status + Summary */}
            <div className="flex items-center justify-between">
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>
              <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('ar-IQ')}</p>
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">معلومات العميل</p>
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-gray-400" />
                <span className="text-gray-800">{order.customerName || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-gray-400" />
                <span className="text-gray-800" dir="ltr">{order.customerPhone || '—'}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="text-gray-400 mt-0.5" />
                <span className="text-gray-800">{order.deliveryAddress || '—'}</span>
              </div>
            </div>

            {/* SubOrders */}
            {order.subOrders?.map(sub => (
              <div key={sub.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{sub.vendorNameAr || sub.vendorName}</p>
                    <p className="text-xs text-gray-400">#{sub.subOrderNumber}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    statusLabels[sub.status]?.color || 'bg-gray-100 text-gray-600'
                  }`}>
                    {statusLabels[sub.status]?.label || sub.status}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {sub.items?.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={getImageUrl(item.productImageUrl) || item.productImageUrl}
                          alt="" className="w-full h-full object-cover"
                          onError={e => e.target.style.display='none'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {item.productNameAr || item.productName}
                        </p>
                        <p className="text-xs text-gray-400">الكمية: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-sm text-gray-900 flex-shrink-0">
                        {item.subtotal.toLocaleString()} د.ع
                      </p>
                    </div>
                  ))}
                </div>
                {sub.cancellationReason && (
                  <div className="px-4 py-2 bg-red-50 text-xs text-red-600">
                    سبب الإلغاء: {sub.cancellationReason}
                  </div>
                )}
              </div>
            ))}

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">الإجماليات</p>
              {[
                { label: 'المجموع الفرعي', value: order.subtotal },
                { label: 'رسوم التوصيل',  value: order.deliveryFees },
                { label: 'الخصم',          value: order.discountAmount, hide: !order.discountAmount },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex justify-between text-sm text-gray-600">
                  <span>{row.label}</span>
                  <span>{(row.value||0).toLocaleString()} د.ع</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>الإجمالي</span>
                <span className="text-primary">{order.totalAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            {/* Payment */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CreditCard size={15} className="text-gray-400" />
              <span>طريقة الدفع: {order.paymentMethod === 'COD' ? 'عند الاستلام' : order.paymentMethod}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {order.paymentStatus === 'PAID' ? 'مدفوع' : 'معلق'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const AdminOrders = () => {
  const navigate = useNavigate()
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', page, search, status],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ORDERS.PAGED, {
        PageNumber: page,
        PageSize: 15,
        orderNumber: search || undefined,
        status: status || undefined,
      })
      const raw = r.data
      if (raw?.data && raw?.pagination) {
        return {
          items:      Array.isArray(raw.data) ? raw.data : [],
          totalPages: raw.pagination.totalPages ?? 1,
          totalCount: raw.pagination.totalCount ?? 0,
        }
      }
      return { items: [], totalPages: 1, totalCount: 0 }
    },
    staleTime: 1 * 60 * 1000,
  })

  const orders     = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const totalCount = data?.totalCount ?? 0

  const statusLabel = (s) => STATUS_OPTIONS.find(o => o.value === s)?.label || s

  const { data: timings } = useOrderTimings((orders || []).filter(o => o.status === 'DELIVERED').map(o => o.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
          <p className="text-gray-500 mt-1">{totalCount.toLocaleString()} طلب</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="البحث برقم الطلب..."
              className="w-full h-9 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد طلبات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['رقم الطلب','العميل','المبلغ','طريقة الدفع','التاريخ','الحالة','مدة الوصول',''].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-primary">
                      #{order.orderNumber || order.id?.slice(0,8)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.customerName || order.customer?.fullName || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {(order.totalAmount ?? 0).toLocaleString()} د.ع
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {order.paymentMethod === 'COD' ? 'عند الاستلام' : order.paymentMethod || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'DELIVERED' ? <DurationChip timing={timings?.[order.id]} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/admin/orders/${order.id}`)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-200">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">
              السابق
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">
              التالي
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

export default AdminOrders