// src/pages/vendor/VendorReports.jsx
import { useState } from 'react'
import {
  DollarSign, ShoppingCart, TrendingUp, Package,
  RefreshCw, Calendar,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '../../components/common/Loading'
import { useAuthStore } from '../../stores/authStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

const PERIODS = [
  { key: 'today', label: 'اليوم'       },
  { key: 'week',  label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر'  },
  { key: 'year',  label: 'هذا العام'  },
]

const VendorReports = () => {
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const [period, setPeriod] = useState('month')

  const { data: salesRaw, isLoading: salesLoading, refetch } = useQuery({
    queryKey: ['vendor-sales', vendorId, period],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.SALES(vendorId), { period })
      return r.data.data || r.data
    },
    enabled: !!vendorId,
    staleTime: 3 * 60 * 1000,
  })

  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ['vendor-dashboard', vendorId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.BASE(vendorId))
      return r.data.data || r.data
    },
    enabled: !!vendorId,
    staleTime: 3 * 60 * 1000,
  })

  const sales      = salesRaw || {}
  const dash       = dashRaw  || {}
  const salesByDay = (sales.salesByDay || []).filter(d => d.revenue > 0 || sales.salesByDay?.length <= 7)
  // للفترات الطويلة فلتر الأيام التي فيها بيانات + أهم الأيام
  const chartDays  = period === 'year'
    ? (sales.salesByDay || []).filter(d => d.revenue > 0)
    : sales.salesByDay || []
  const maxRevenue = chartDays.length ? Math.max(...chartDays.map(d => d.revenue), 1) : 1
  const topProducts = (dash.topProducts || []).filter((p, i, arr) =>
    arr.findIndex(x => x.productId === p.productId) === i
  )

  const stats = [
    { label: 'الإيرادات',         value: `${(sales.totalRevenue||0) > 1000000 ? ((sales.totalRevenue||0)/1000000).toFixed(1)+'M' : (sales.totalRevenue||0).toLocaleString()} د.ع`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'الطلبات',           value: (sales.totalOrders||0).toString(),                                                                                                          icon: ShoppingCart, color: 'text-blue-600',  bg: 'bg-blue-50'  },
    { label: 'متوسط قيمة الطلب',  value: `${(sales.averageOrderValue||0).toLocaleString()} د.ع`,                                                                                    icon: TrendingUp,   color: 'text-purple-600',bg: 'bg-purple-50'},
    { label: 'المنتجات النشطة',   value: `${dash.activeProducts||0}/${dash.totalProducts||0}`,                                                                                       icon: Package,     color: 'text-yellow-600',bg: 'bg-yellow-50'},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-gray-500 mt-1 text-sm">تحليل أداء متجرك</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                period === p.key ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:border-primary'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {salesLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            المبيعات اليومية — {PERIODS.find(p=>p.key===period)?.label}
          </h2>
          <div className="text-sm text-gray-500">
            {sales.totalOrders ?? 0} طلب · {(sales.totalRevenue ?? 0).toLocaleString()} د.ع
          </div>
        </div>

        {salesLoading ? <Skeleton className="h-40" /> :
        chartDays.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">لا توجد مبيعات في هذه الفترة</div>
        ) : (
          <div style={{ height: '160px' }} className="flex items-end gap-1 overflow-x-auto pb-6">
            {chartDays.map((day, i) => {
              const pct   = Math.max(4, Math.round((day.revenue / maxRevenue) * 140))
              const date  = new Date(day.date)
              const label = period === 'year'
                ? `${date.getDate()}/${date.getMonth()+1}`
                : period === 'today' ? `${date.getHours()}:00`
                : `${date.getDate()}/${date.getMonth()+1}`
              return (
                <div key={i} className="flex-1 min-w-5 flex flex-col items-center group relative"
                  style={{ height: '100%', justifyContent: 'flex-end' }}>
                  <div className="absolute hidden group-hover:block z-10 pointer-events-none"
                    style={{ bottom: `${pct + 20}px` }}>
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <p className="font-medium">{label}</p>
                      <p>{day.revenue.toLocaleString()} د.ع</p>
                      <p className="text-gray-300">{day.orderCount} طلب</p>
                    </div>
                  </div>
                  <div className="w-full bg-primary hover:bg-primary/80 transition-colors rounded-t-sm"
                    style={{ height: `${pct}px`, minHeight: '4px' }} />
                  <span className="text-gray-400 absolute bottom-0 text-center" style={{ fontSize: '9px' }}>{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={16} className="text-primary" />الأكثر مبيعاً
        </h2>
        {dashLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : topProducts.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.productId || i} className="flex items-center gap-3">
                <span className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={getImageUrl(p.imageUrl) || p.imageUrl} alt=""
                    className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{p.productNameAr || p.productName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${Math.round((p.totalRevenue / (topProducts[0]?.totalRevenue||1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{p.totalSold} مبيع</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                  {p.totalRevenue > 1000000 ? `${(p.totalRevenue/1000000).toFixed(1)}M` : (p.totalRevenue||0).toLocaleString()} د.ع
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingCart size={16} className="text-primary" />حالات الطلبات
        </h2>
        {dashLoading ? (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي الطلبات', value: dash.totalOrders     ?? 0, color: 'text-gray-900',  bg: 'bg-gray-50'   },
              { label: 'نشطة',            value: dash.activeOrders    ?? 0, color: 'text-blue-600',  bg: 'bg-blue-50'   },
              { label: 'مكتملة',          value: dash.completedOrders ?? 0, color: 'text-green-600', bg: 'bg-green-50'  },
              { label: 'ملغية',           value: dash.cancelledOrders ?? 0, color: 'text-red-500',   bg: 'bg-red-50'    },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VendorReports