import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  Eye, ArrowLeft, RefreshCw, AlertCircle, Star, AlertTriangle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { StatCard } from '../../components/common/Card'
import { StatusBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useAuthStore } from '../../stores/authStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

const VendorDashboard = () => {
  const [dateRange, setDateRange] = useState('month')
  const { user } = useAuthStore()

  // ✅ vendorId موجود في authStore بعد تسجيل الدخول
  const vendorId = user?.vendorId || user?.userId

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendor-dashboard', vendorId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.BASE(vendorId))
      return r.data.data || r.data
    },
    enabled: !!vendorId,
    staleTime: 2 * 60 * 1000,
  })

  const d = raw || {}

  // ✅ الإيرادات حسب الفترة المختارة
  const totalRevenue = dateRange === 'today' ? (d.revenueToday ?? 0)
    : dateRange === 'week'  ? (d.revenueThisWeek  ?? 0)
    : dateRange === 'month' ? (d.revenueThisMonth ?? 0)
    : (d.totalRevenue ?? 0)

  const pendingOrders  = d.pendingOrders       ?? 0
  const activeProducts = d.activeProducts      ?? 0
  const totalProducts  = d.totalProducts       ?? 0
  const outOfStock     = d.outOfStockProducts  ?? 0
  const lowStock       = d.lowStockProducts    ?? 0
  const avgRating      = d.averageRating       ?? 0
  const totalReviews   = d.totalReviews        ?? 0
  // ✅ إظهار الطلبات النشطة فقط (بدون DELIVERED و CANCELLED)
  const allRecentOrders = d.recentOrders ?? []
  const recentOrders = allRecentOrders.filter(o =>
    !['DELIVERED', 'CANCELLED'].includes(o.status)
  )
  // ✅ إزالة التكرار — الـ API قد يرجع نفس المنتج مرتين
  const topProducts = [...new Map(
    (d.topProducts ?? []).map(p => [p.productId, p])
  ).values()]

  const stats = [
    { title: 'المبيعات', value: `${totalRevenue > 1000000 ? (totalRevenue/1000000).toFixed(1)+'M' : totalRevenue.toLocaleString()} د.ع`, icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600', change: 0 },
    { title: 'الطلبات',  value: (d.totalOrders ?? 0).toString(), icon: ShoppingCart, iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   change: 0 },
    { title: 'المنتجات', value: `${activeProducts}/${totalProducts}`, icon: Package, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', change: 0 },
    { title: 'معلقة',    value: pendingOrders.toString(), icon: TrendingUp, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', change: 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500 mt-1">{d.vendorName ? `مرحباً، ${d.vendorName}` : 'مرحباً بك'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm">
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="year">الإجمالي</option>
          </select>
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">تعذّر تحميل البيانات</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="mr-auto">إعادة المحاولة</Button>
        </div>
      )}

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-32 mb-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      )}

      {/* Stock Alerts */}
      {!isLoading && (outOfStock > 0 || lowStock > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {outOfStock > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-700 text-sm">{outOfStock} منتج نفد من المخزون</p>
                <Link to="/vendor/products" className="text-xs text-red-500 hover:underline">إدارة المنتجات ←</Link>
              </div>
            </div>
          )}
          {lowStock > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-700 text-sm">{lowStock} منتج مخزونه منخفض</p>
                <Link to="/vendor/products" className="text-xs text-yellow-600 hover:underline">إدارة المنتجات ←</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orders Stats + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4">إحصائيات الطلبات</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'إجمالي الطلبات', value: d.totalOrders     ?? 0, color: 'text-gray-900',  bg: 'bg-gray-50'   },
                  { label: 'طلبات نشطة',      value: d.activeOrders    ?? 0, color: 'text-blue-600',  bg: 'bg-blue-50'   },
                  { label: 'مكتملة',           value: d.completedOrders ?? 0, color: 'text-green-600', bg: 'bg-green-50'  },
                  { label: 'ملغية',            value: d.cancelledOrders ?? 0, color: 'text-red-500',   bg: 'bg-red-50'    },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Revenue Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-3">توزيع الإيرادات</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'اليوم',        value: d.revenueToday     ?? 0 },
                    { label: 'هذا الأسبوع',  value: d.revenueThisWeek  ?? 0 },
                    { label: 'هذا الشهر',    value: d.revenueThisMonth ?? 0 },
                  ].map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="font-bold text-gray-900 text-sm">
                        {r.value > 1000000 ? `${(r.value/1000000).toFixed(1)}M` : r.value.toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">الأكثر مبيعاً</h2>
            <Link to="/vendor/products" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا توجد بيانات</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, i) => (
                <div key={p.productId || i} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={getImageUrl(p.imageUrl) || p.imageUrl} alt=""
                      className="w-full h-full object-cover"
                      onError={e => e.target.style.display='none'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.productNameAr || p.productName}</p>
                    <p className="text-xs text-gray-400">{p.totalSold} مبيع</p>
                  </div>
                  <p className="text-xs font-medium text-gray-700 flex-shrink-0">
                    {p.totalRevenue > 1000000
                      ? `${(p.totalRevenue/1000000).toFixed(1)}M`
                      : (p.totalRevenue||0).toLocaleString()} د.ع
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">الطلبات الأخيرة</h2>
          <Link to="/vendor/orders">
            <Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد طلبات حتى الآن</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['رقم الطلب','العميل','التاريخ','المبلغ','الحالة',''].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map(order => (
                  <tr key={order.subOrderId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-primary text-xs">#{order.subOrderNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{order.customerName || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                    </td>
                    <td className="px-4 py-3 font-medium">{(order.subtotal||0).toLocaleString()} د.ع</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      <Link to="/vendor/orders" className="text-gray-400 hover:text-primary inline-flex">
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reviews Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Star size={18} className="text-yellow-400 fill-yellow-400" />تقييمات العملاء
          </h2>
          <Link to="/vendor/reviews">
            <Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي التقييمات', value: totalReviews,                    color: 'text-gray-900'   },
            { label: 'متوسط التقييم',    value: `${avgRating.toFixed(1)} ⭐`,    color: 'text-yellow-600' },
            { label: 'طلبات مكتملة',     value: d.completedOrders ?? 0,          color: 'text-green-600'  },
            { label: 'مخزون منخفض',      value: lowStock,                         color: lowStock > 0 ? 'text-orange-500' : 'text-gray-400' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { to: '/vendor/products/new', bg: 'bg-blue-50 hover:bg-blue-100',     icon: Package,      color: 'text-blue-600',   title: 'إضافة منتج',      desc: 'أضف منتجات جديدة' },
          { to: '/vendor/orders',       bg: 'bg-yellow-50 hover:bg-yellow-100', icon: ShoppingCart, color: 'text-yellow-600', title: 'الطلبات المعلقة', desc: `${pendingOrders} طلب` },
          { to: '/vendor/products',     bg: 'bg-purple-50 hover:bg-purple-100', icon: TrendingUp,   color: 'text-purple-600', title: 'المنتجات',        desc: `${totalProducts} منتج` },
          { to: '/vendor/reviews',      bg: 'bg-orange-50 hover:bg-orange-100', icon: Star,         color: 'text-orange-500', title: 'التقييمات',       desc: `${avgRating.toFixed(1)} ⭐ متوسط` },
        ].map((a, i) => (
          <Link key={i} to={a.to} className={`${a.bg} p-4 rounded-xl transition-colors`}>
            <a.icon size={26} className={`${a.color} mb-2`} />
            <h3 className="font-bold text-gray-900 text-sm mb-0.5">{a.title}</h3>
            <p className="text-xs text-gray-500">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default VendorDashboard