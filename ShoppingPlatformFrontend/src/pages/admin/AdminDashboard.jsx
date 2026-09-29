import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Users, Store, ShoppingCart, DollarSign, TrendingUp,
  Package, AlertTriangle, ArrowLeft, RefreshCw, UserPlus,
  Star, Flag, Tag, Gift, Zap, RotateCcw, CheckCircle
} from 'lucide-react'
import { StatCard } from '../../components/common/Card'
import { StatusBadge, Avatar } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAdminStats, useAdminOrders, useAdminVendors, useAdminUsers } from '../../hooks/useAdmin'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getVendorLogo } from '../../utils/imageHelper'

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState('month')
  const [reviewingStore, setReviewingStore] = useState(null)

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useAdminStats()
  const { data: ordersData, isLoading: ordersLoading } = useAdminOrders({ pageSize: 5, pageNumber: 1 })
  const { data: vendorsData, isLoading: vendorsLoading } = useAdminVendors()
  const { data: usersData, isLoading: usersLoading } = useAdminUsers()

  // ✅ إحصائيات التقييمات
  const { data: ratingStats } = useQuery({
    queryKey: ['admin-rating-stats'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RATING_ADMIN.STATS)
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // ✅ أفضل المتاجر (API حقيقي)
  const { data: topVendorsData, isLoading: topVendorsLoading } = useQuery({
    queryKey: ['admin-top-vendors'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_VENDORS, { count: 4 })
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })
  const topVendorsList = Array.isArray(topVendorsData) ? topVendorsData : (topVendorsData?.items ?? [])

  // ✅ تقرير المبيعات الحقيقي
  const { data: salesReport } = useQuery({
    queryKey: ['admin-sales-report'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.SALES)
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })
  const dailyStats   = salesReport?.dailyStats ?? []
  const maxRevenue   = dailyStats.length ? Math.max(...dailyStats.map(d => d.totalRevenue)) : 1

  // ✅ إحصائيات الكوبونات
  const { data: couponsData } = useQuery({
    queryKey: ['admin-coupons-summary'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.COUPONS.PAGED, { pageSize: 100 })
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const coupons = Array.isArray(couponsData) ? couponsData : (couponsData?.items ?? [])
  const activeCoupons = coupons.filter(c => c.isActive && !c.isExpired).length
  const expiredCoupons = coupons.filter(c => c.isExpired).length

  // ✅ إحصائيات الولاء
  const { data: loyaltySettings } = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.SETTINGS)
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // ✅ إحصائيات الإرجاع
  const { data: returnsData } = useQuery({
    queryKey: ['admin-returns-summary'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RETURNS.PAGED, { pageSize: 100 })
      return r.data.data || r.data
    },
    staleTime: 3 * 60 * 1000,
  })

  const allReturns     = Array.isArray(returnsData) ? returnsData : (returnsData?.items ?? [])
  const pendingReturns  = allReturns.filter(r => r.status?.toUpperCase() === 'PENDING').length
  const approvedReturns = allReturns.filter(r => r.status?.toUpperCase() === 'APPROVED').length

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { success: showSuccess, error: showError } = useToast()

  // ✅ تفعيل/تعطيل متجر من الداشبورد
  const { mutateAsync: toggleVendor, isPending: togglingVendor } = useMutation({
    mutationFn: (id) => apiPut(API_ENDPOINTS.ADMIN.TOGGLE_VENDOR_STATUS(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] }),
  })

  const handleApproveStore = async (store) => {
    try {
      await toggleVendor(store.id)
      showSuccess(`تم تفعيل ${store.nameAr || store.name}`)
    } catch (err) {
      showError('فشل تفعيل المتجر')
    }
  }

  const isLoading = statsLoading || ordersLoading || vendorsLoading || usersLoading

  const stats = statsData || {}
  const orders = ordersData?.items || ordersData?.data?.items || ordersData?.data || (Array.isArray(ordersData) ? ordersData : [])
  const allVendors   = Array.isArray(vendorsData) ? vendorsData : (vendorsData?.items ?? [])
  const pendingStores = allVendors.filter(v => !v.isActive)
  const newUsers = Array.isArray(usersData) ? usersData.slice(0,4) : (usersData?.items ?? []).slice(0,4)

  const mainStats = [
    { title: 'إجمالي المبيعات', value: stats.totalRevenue ? `${(stats.totalRevenue / 1000000).toFixed(1)}M د.ع` : '0 د.ع', change: 0, icon: DollarSign, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    { title: 'إجمالي الطلبات', value: (stats.totalOrders || 0).toLocaleString(), change: 0, icon: ShoppingCart, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'المستخدمين', value: (stats.totalUsers || 0).toLocaleString(), change: 0, icon: Users, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: 'المتاجر النشطة', value: (stats.activeVendors || 0).toLocaleString(), change: 0, icon: Store, iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
  ]

  const quickStats = [
    { label: 'طلبات جديدة اليوم',      value: stats.todayOrders    || 0,                  color: 'blue'   },
    { label: 'متاجر غير نشطة',          value: stats.inactiveVendors || pendingStores.length, color: 'yellow' },
    { label: 'طلبات معلقة',             value: stats.pendingOrders  || 0,                  color: 'red'    },
    { label: 'منتجات نفدت من المخزون', value: stats.outOfStock     || 0,                  color: 'purple' },
  ]

  // ===== Store Review Modal =====
  const StoreModal = ({ store }) => {
    if (!store) return null
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="font-bold text-lg">تفاصيل المتجر</h3>
            <button onClick={() => setReviewingStore(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                {getVendorLogo(store)
                  ? <img src={getVendorLogo(store)} alt="" className="w-full h-full object-cover" />
                  : <Store size={28} className="text-gray-400" />
                }
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{store.nameAr || store.name}</h2>
                {store.nameAr && store.name && <p className="text-gray-500 text-sm">{store.name}</p>}
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 bg-red-100 text-red-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />معطل
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'الهاتف',          value: store.phone,           dir: 'ltr' },
                { label: 'العنوان',          value: store.address },
                { label: 'الحد الأدنى',     value: store.minOrderAmount ? `${store.minOrderAmount.toLocaleString()} د.ع` : '—' },
                { label: 'رسوم التوصيل',    value: store.deliveryFee     ? `${store.deliveryFee.toLocaleString()} د.ع`     : '—' },
                { label: 'وقت التحضير',     value: store.estimatedPrepTime ? `${store.estimatedPrepTime} دقيقة`            : '—' },
                { label: 'تاريخ التسجيل',   value: store.createdAt ? new Date(store.createdAt).toLocaleDateString('ar-IQ') : '—' },
              ].map(({ label, value, dir }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="font-medium text-gray-900 text-sm" dir={dir}>{value || '—'}</p>
                </div>
              ))}
            </div>
            {store.description && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">الوصف</p>
                <p className="text-sm text-gray-700">{store.description}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setReviewingStore(null)}>إغلاق</Button>
              <Button variant="primary" fullWidth loading={togglingVendor}
                onClick={() => { handleApproveStore(store); setReviewingStore(null) }}>
                <CheckCircle size={15} className="ml-1" />موافقة وتفعيل
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500 mt-1">نظرة عامة على أداء المنصة</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetchStats()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm">
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="year">هذا العام</option>
          </select>
        </div>
      </div>

      {/* Main Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-lg border border-gray-200 p-6"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-32 mb-2" /><Skeleton className="h-3 w-20" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mainStats.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full bg-${stat.color}-100 flex items-center justify-center`}>
              <span className={`text-xl font-bold text-${stat.color}-600`}>{stat.value}</span>
            </div>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">المبيعات الشهرية</h2>
            <span className="text-sm text-gray-500">آخر 30 يوم</span>
          </div>
          {dailyStats.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <p className="text-sm">لا توجد بيانات مبيعات</p>
            </div>
          ) : (
            <div style={{ height: '180px' }} className="flex items-end gap-1 overflow-x-auto pb-6">
              {dailyStats.map((day, i) => {
                const pct   = Math.max(4, Math.round((day.totalRevenue / maxRevenue) * 160))
                const date  = new Date(day.date)
                const label = `${date.getDate()}/${date.getMonth() + 1}`
                return (
                  <div key={i} className="flex-1 min-w-5 flex flex-col items-center gap-1 group relative"
                    style={{ height: '100%', justifyContent: 'flex-end' }}>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none"
                      style={{ bottom: `${pct + 20}px` }}>
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        <p className="font-medium">{label}</p>
                        <p>{day.totalRevenue.toLocaleString()} د.ع</p>
                        <p className="text-gray-300">{day.totalOrders} طلب</p>
                      </div>
                    </div>
                    {/* Bar */}
                    <div
                      className="w-full bg-primary hover:bg-primary/80 transition-colors rounded-t-sm"
                      style={{ height: `${pct}px`, minHeight: '4px' }}
                    />
                    {/* Label */}
                    <span className="text-xs text-gray-400 absolute bottom-0"
                      style={{ fontSize: '9px' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">إجمالي الفترة</p>
              <p className="text-xl font-bold text-gray-900">
                {salesReport?.totalRevenue
                  ? `${(salesReport.totalRevenue / 1000000).toFixed(2)}M د.ع`
                  : stats.totalRevenue
                    ? `${(stats.totalRevenue / 1000000).toFixed(2)}M د.ع`
                    : '0 د.ع'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp size={16} className="text-green-500" />
              <span>{salesReport?.totalOrders ?? stats.totalOrders ?? 0} طلب</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">أفضل المتاجر</h2>
            <Link to="/admin/stores" className="text-sm text-primary hover:underline">الكل</Link>
          </div>
          {topVendorsLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : topVendorsList.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات</p>
          ) : (
            <div className="space-y-4">
              {topVendorsList.map((v, i) => (
                <div key={v.id || i} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-primary">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{v.vendorName || v.nameAr || v.name}</p>
                    <p className="text-xs text-gray-500">{v.totalOrders ?? v.ordersCount ?? 0} طلب</p>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm">
                      {(v.totalRevenue ?? 0) > 1000000 ? `${((v.totalRevenue)/1000000).toFixed(1)}M` : (v.totalRevenue ?? 0).toLocaleString()} د.ع
                    </p>
                    {v.rating > 0 && <p className="text-xs text-yellow-500">⭐ {v.rating.toFixed(1)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">أحدث الطلبات</h2>
            <Link to="/admin/orders"><Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button></Link>
          </div>
          {ordersLoading ? (
            <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500"><ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" /><p>لا توجد طلبات</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50">
                  {['الطلب','العميل','المبلغ','الحالة'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-600">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.slice(0, 5).map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary">#{order.orderNumber || order.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.customer?.fullName || order.customerName || 'عميل'}</td>
                      <td className="px-4 py-3 text-sm font-medium">{(order.totalAmount || order.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />متاجر بانتظار الموافقة
            </h2>
            <Link to="/admin/stores?status=pending"><Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button></Link>
          </div>
          {vendorsLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : pendingStores.length === 0 ? (
            <div className="p-8 text-center text-gray-500"><Store size={32} className="mx-auto mb-2 text-gray-300" /><p>لا توجد متاجر بانتظار الموافقة</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingStores.slice(0, 3).map(store => (
                <div key={store.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Store size={20} className="text-blue-600" /></div>
                    <div>
                      <p className="font-medium text-gray-900">{store.nameAr || store.name}</p>
                      <p className="text-sm text-gray-500">{store.ownerName || 'مالك'} • {store.category?.nameAr || 'فئة'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm" loading={togglingVendor}
                      onClick={() => handleApproveStore(store)}>
                      موافقة
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => setReviewingStore(store)}>
                      مراجعة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Users */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">المستخدمين الجدد</h2>
          <Link to="/admin/users"><Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button></Link>
        </div>
        {usersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : newUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500"><Users size={32} className="mx-auto mb-2 text-gray-300" /><p>لا يوجد مستخدمين جدد</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {newUsers.slice(0, 4).map(user => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Avatar name={user.fullName || user.name || 'مستخدم'} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.fullName || user.name}</p>
                  <p className="text-xs text-gray-500">{user.role === 'Vendor' ? 'بائع' : user.role === 'Admin' ? 'مدير' : 'عميل'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Reviews Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Star size={18} className="text-yellow-400 fill-yellow-400" />
            ملخص التقييمات
          </h2>
          <Link to="/admin/reviews">
            <Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي التقييمات', value: ratingStats?.totalRatings ?? 0, color: 'text-gray-900' },
            { label: 'متوسط التوصيل',    value: `${(ratingStats?.averageDeliveryRating ?? 0).toFixed(1)} ⭐`, color: 'text-yellow-600' },
            { label: 'نسبة التوصية',     value: `${ratingStats?.recommendPercentage ?? 0}%`, color: 'text-green-600' },
            { label: 'متوسط التغليف',    value: `${(ratingStats?.averagePackagingRating ?? 0).toFixed(1)} ⭐`, color: 'text-blue-600' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        {false && (
          <Link to="/admin/reviews" className="mt-3 flex items-center gap-2 text-sm text-red-600 hover:underline">
            <Flag size={14} />
            يوجد {ratingStats.reportedReviews} تقييم يحتاج مراجعة
          </Link>
        )}
      </div>

      {/* ✅ Coupons Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Tag size={18} className="text-primary" />
            الكوبونات والعروض
          </h2>
          <Link to="/admin/coupons">
            <Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الكوبونات', value: coupons.length, color: 'text-gray-900' },
            { label: 'كوبونات نشطة', value: activeCoupons, color: 'text-green-600' },
            { label: 'منتهية الصلاحية', value: expiredCoupons, color: 'text-red-500' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Loyalty Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            نظام الولاء
          </h2>
          <Link to="/admin/loyalty">
            <Button variant="ghost" size="sm">الإعدادات <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'نقاط لكل 1 دينار', value: loyaltySettings?.pointsPerCurrencyUnit ?? '—', color: 'text-gray-900' },
            { label: 'قيمة النقطة (د.ع)', value: loyaltySettings?.pointValue ?? '—', color: 'text-primary' },
            { label: 'الحد الأدنى للاسترداد', value: loyaltySettings?.minRedemptionPoints ?? '—', color: 'text-gray-700' },
            { label: 'حالة النظام', value: loyaltySettings?.isActive ? '✅ نشط' : '❌ معطل', color: loyaltySettings?.isActive ? 'text-green-600' : 'text-red-500' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        {loyaltySettings && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: '🥈 فضي', threshold: loyaltySettings.silverThreshold, multiplier: loyaltySettings.silverMultiplier },
              { label: '🥇 ذهبي', threshold: loyaltySettings.goldThreshold, multiplier: loyaltySettings.goldMultiplier },
              { label: '💎 بلاتيني', threshold: loyaltySettings.platinumThreshold, multiplier: loyaltySettings.platinumMultiplier },
            ].map((tier, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-700">{tier.label}</p>
                <p className="text-xs text-gray-500">{(tier.threshold ?? 0).toLocaleString()} نقطة</p>
                <p className="text-xs text-primary font-medium">×{tier.multiplier ?? 1}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Returns Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-primary" />
            طلبات الإرجاع
          </h2>
          <Link to="/admin/returns">
            <Button variant="ghost" size="sm">عرض الكل <ArrowLeft size={16} className="mr-1" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الطلبات', value: allReturns.length, color: 'text-gray-900' },
            { label: 'قيد المراجعة', value: pendingReturns, color: pendingReturns > 0 ? 'text-yellow-600' : 'text-gray-400' },
            { label: 'مقبولة', value: approvedReturns, color: 'text-green-600' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        {pendingReturns > 0 && (
          <Link to="/admin/returns" className="mt-3 flex items-center gap-2 text-sm text-yellow-600 hover:underline">
            <RotateCcw size={14} />
            يوجد {pendingReturns} طلب إرجاع يحتاج مراجعة
          </Link>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link to="/admin/users/new" className="bg-blue-50 p-4 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-3">
          <UserPlus size={24} className="text-blue-600" />
          <span className="font-medium">إضافة مستخدم</span>
        </Link>
        <Link to="/admin/stores" className="bg-yellow-50 p-4 rounded-lg hover:bg-yellow-100 transition-colors flex items-center gap-3">
          <Store size={24} className="text-yellow-600" />
          <span className="font-medium">إدارة المتاجر</span>
        </Link>
        <Link to="/admin/categories" className="bg-purple-50 p-4 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-3">
          <Package size={24} className="text-purple-600" />
          <span className="font-medium">إدارة الفئات</span>
        </Link>
        <Link to="/admin/reviews" className="bg-orange-50 p-4 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-3">
          <Star size={24} className="text-orange-500" />
          <span className="font-medium">التقييمات</span>
        </Link>
        <Link to="/admin/coupons" className="bg-pink-50 p-4 rounded-lg hover:bg-pink-100 transition-colors flex items-center gap-3">
          <Tag size={24} className="text-pink-600" />
          <span className="font-medium">الكوبونات</span>
        </Link>
        <Link to="/admin/loyalty" className="bg-blue-50 p-4 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-3">
          <Zap size={24} className="text-blue-600" />
          <span className="font-medium">نقاط الولاء</span>
        </Link>
        <Link to="/admin/returns" className="bg-red-50 p-4 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-3 relative">
          <RotateCcw size={24} className="text-red-500" />
          <span className="font-medium">طلبات الإرجاع</span>
          {pendingReturns > 0 && (
            <span className="absolute top-2 left-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {pendingReturns}
            </span>
          )}
        </Link>
      </div>
      {/* Store Review Modal */}
      {reviewingStore && <StoreModal store={reviewingStore} />}
    </div>
  )
}

export default AdminDashboard