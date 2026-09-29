import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Eye, RefreshCw, AlertCircle } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { StatusBadge } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger } from '../../components/common/Tabs'
import EmptyState from '../../components/common/EmptyState'
import Pagination from '../../components/common/Pagination'
import { Skeleton } from '../../components/common/Loading'
import Button from '../../components/common/Button'
import { useAuthStore } from '../../stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

// ✅ جلب طلبات العميل مع pagination وفلتر الحالة
const useCustomerOrdersPaged = (customerId, page, status) => useQuery({
  queryKey: ['customer-orders', customerId, page, status],
  queryFn: async () => {
    const params = { PageNumber: page, PageSize: 10 }
    if (status && status !== 'all') params.status = status
    const r = await apiGet(API_ENDPOINTS.ORDERS.PAGED, { ...params, customerId })
    const raw = r.data
    if (raw?.data && raw?.pagination) {
      return {
        items:      Array.isArray(raw.data) ? raw.data : [],
        totalPages: raw.pagination.totalPages  ?? 1,
        totalCount: raw.pagination.totalCount  ?? 0,
      }
    }
    // fallback: endpoint customer
    const r2 = await apiGet(API_ENDPOINTS.ORDERS.BY_CUSTOMER(customerId))
    const list = r2.data.data || r2.data || []
    const filtered = status && status !== 'all'
      ? list.filter(o => o.status === status)
      : list
    return { items: filtered, totalPages: 1, totalCount: filtered.length }
  },
  enabled: !!customerId,
  staleTime: 1 * 60 * 1000,
})

// ===========================
// Order Card
// ===========================
const OrderCard = ({ order }) => {
  const subOrders = order.subOrders || []
  const vendorNames = [...new Set(subOrders.map(s => s.vendorNameAr || s.vendorName).filter(Boolean))]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900">#{order.orderNumber}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString('ar-IQ', {
              year: 'numeric', month: 'short', day: 'numeric'
            })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Vendor names */}
      {vendorNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {vendorNames.map((name, i) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{name}</span>
          ))}
        </div>
      )}

      {/* Sub orders count */}
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-500">
        <span>{subOrders.length} طلب فرعي</span>
        {order.couponCode && (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            🎫 {order.couponCode}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <p className="font-bold text-primary">{(order.totalAmount || 0).toLocaleString()} د.ع</p>
        <Link to={`/orders/${order.orderNumber}`}
          className="flex items-center gap-1 text-sm text-primary hover:underline">
          <Eye size={14} />عرض التفاصيل
        </Link>
      </div>
    </div>
  )
}

const OrderCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="flex items-start justify-between mb-3">
      <div><div className="h-5 w-28 bg-gray-200 rounded mb-1" /><div className="h-3 w-20 bg-gray-100 rounded" /></div>
      <div className="h-6 w-20 bg-gray-200 rounded-full" />
    </div>
    <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
      <div className="h-5 w-24 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-100 rounded" />
    </div>
  </div>
)

// ===========================
// Main Page
// ===========================
const OrdersPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuthStore()

  const currentPage  = parseInt(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || 'all'
  const userId = user?.userId || user?.id

  const { data, isLoading, isError, error, refetch } = useCustomerOrdersPaged(userId, currentPage, statusFilter)

  const orders     = data?.items      ?? []
  const totalPages = data?.totalPages ?? 1
  const totalCount = data?.totalCount ?? 0

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    setSearchParams(params)
  }

  const handleStatusChange = (status) => {
    const params = new URLSearchParams(searchParams)
    if (status === 'all') params.delete('status')
    else params.set('status', status)
    params.set('page', '1')
    setSearchParams(params)
  }

  if (!isAuthenticated) {
    navigate('/login', { state: { from: '/orders' } })
    return null
  }

  const STATUS_TABS = [
    { value: 'all',                  label: 'الكل'           },
    { value: 'PENDING_CONFIRMATION', label: 'قيد الانتظار'   },
    { value: 'CONFIRMED',            label: 'مؤكد'           },
    { value: 'PREPARING',            label: 'قيد التحضير'    },
    { value: 'OUT_FOR_DELIVERY',     label: 'قيد التوصيل'    },
    { value: 'DELIVERED',            label: 'تم التوصيل'     },
    { value: 'CANCELLED',            label: 'ملغي'            },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={[{ label: 'طلباتي' }]} className="mb-6" />

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="text-primary" />طلباتي
              {totalCount > 0 && (
                <span className="text-base font-normal text-gray-400">({totalCount})</span>
              )}
            </h1>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>

          {isError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error?.message || 'فشل تحميل الطلبات'}</p>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="mr-auto">إعادة</Button>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={statusFilter} onValueChange={handleStatusChange}>
            <div className="overflow-x-auto border-b border-gray-200 mb-6">
              <TabsList>
                {STATUS_TABS.map(t => (
                  <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                ))}
              </TabsList>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <OrderCardSkeleton key={i} />)}
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                type="orders"
                title="لا توجد طلبات"
                description={statusFilter !== 'all' ? 'لا توجد طلبات بهذه الحالة' : 'لم تقم بأي طلبات بعد'}
                action={<Button variant="primary" onClick={() => navigate('/products')}>تصفح المنتجات</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </Tabs>

          {!isLoading && totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrdersPage