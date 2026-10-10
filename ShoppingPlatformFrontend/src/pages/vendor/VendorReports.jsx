// src/pages/vendor/VendorReports.jsx
import { useState } from 'react'
import {
  DollarSign, ShoppingCart, TrendingUp, Package,
  RefreshCw, Calendar, Download, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '../../components/common/Loading'
import { useAuthStore } from '../../stores/authStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

const PERIODS = [
  { key: 'today', label: 'اليوم'       },
  { key: 'week',  label: 'آخر 7 أيام' },
  { key: 'month', label: 'هذا الشهر'  },
  { key: 'year',  label: 'هذا العام'  },
  { key: 'custom', label: 'مخصص' },
]

const isoDay = (d) => d.toISOString().slice(0, 10)

// نسبة التغيير عن الفترة السابقة (بنفس عدد الأيام)
const Delta = ({ now, before }) => {
  if (!before) return now > 0 ? <span className="text-[11px] text-green-600 font-bold">جديد</span> : null
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return <span className="text-[11px] text-gray-400">بلا تغيير</span>
  const up = pct > 0
  return (
    <span className={`inline-flex items-center text-[11px] font-bold ${up ? 'text-green-600' : 'text-red-500'}`} title="مقارنة بالفترة السابقة بنفس الطول">
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(pct)}%
    </span>
  )
}

// المبيعات اليومية كملف CSV (يفتح في Excel بالعربية)
const downloadSalesCsv = (sales) => {
  const rows = [['date', 'orders', 'revenue'], ...(sales.salesByDay || []).map(d => [String(d.date).slice(0, 10), d.orderCount, d.revenue])]
  const blob = new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `sales-${String(sales.from).slice(0, 10)}-${String(sales.to).slice(0, 10)}.csv` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const VendorReports = () => {
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState(() => ({ from: isoDay(new Date(Date.now() - 29 * 86400000)), to: isoDay(new Date()) }))
  const rangeValid = range.from && range.to && range.from <= range.to

  const { data: salesRaw, isLoading: salesLoading, refetch } = useQuery({
    queryKey: ['vendor-sales', vendorId, period, period === 'custom' ? range : null],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.SALES(vendorId),
        period === 'custom' ? { period, from: range.from, to: range.to } : { period })
      return r.data.data || r.data
    },
    enabled: !!vendorId && (period !== 'custom' || rangeValid),
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
  const chartDays  = period === 'year' || (period === 'custom' && (sales.salesByDay?.length ?? 0) > 62)
    ? (sales.salesByDay || []).filter(d => d.revenue > 0)
    : sales.salesByDay || []
  const maxRevenue = chartDays.length ? Math.max(...chartDays.map(d => d.revenue), 1) : 1
  const topProducts = dash.topProducts || []

  const stats = [
    { label: 'صافي المبيعات',     value: `${(sales.totalRevenue||0) > 1000000 ? ((sales.totalRevenue||0)/1000000).toFixed(1)+'M' : (sales.totalRevenue||0).toLocaleString('en-US')} د.ع`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50',
      delta: <Delta now={sales.totalRevenue || 0} before={sales.previousRevenue || 0} /> },
    { label: 'الطلبات',           value: (sales.totalOrders||0).toString(),                                                                                                          icon: ShoppingCart, color: 'text-blue-600',  bg: 'bg-blue-50',
      delta: <Delta now={sales.totalOrders || 0} before={sales.previousOrders || 0} /> },
    { label: 'متوسط قيمة الطلب',  value: `${(sales.averageOrderValue||0).toLocaleString('en-US')} د.ع`,                                                                                    icon: TrendingUp,   color: 'text-purple-600',bg: 'bg-purple-50'},
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
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                period === p.key ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:border-primary'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => downloadSalesCsv(sales)} disabled={!sales.salesByDay?.length}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40" title="تصدير المبيعات اليومية (CSV)" aria-label="تصدير CSV">
            <Download size={15} className="text-gray-500" />
          </button>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">من
            <input type="date" value={range.from} max={range.to} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-lg" />
          </label>
          <label className="flex items-center gap-1.5">إلى
            <input type="date" value={range.to} min={range.from} max={isoDay(new Date())} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-lg" />
          </label>
          {!rangeValid && <span className="text-red-500 text-xs">تاريخ البداية بعد النهاية</span>}
        </div>
      )}
      <p className="text-xs text-gray-400 -mt-3">الأسهم تقارن بالفترة السابقة بنفس عدد الأيام. صافي المبيعات = المسلَّم دون المرفوض ناقص المرتجعات، قبل عمولة المنصة.</p>

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
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">{s.label}{s.delta}</p>
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
            {sales.totalOrders ?? 0} طلب · {(sales.totalRevenue ?? 0).toLocaleString('en-US')} د.ع
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
                      <p>{day.revenue.toLocaleString('en-US')} د.ع</p>
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
                <div className="w-11 h-11 rounded-xl overflow-hidden product-media flex-shrink-0">
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
                  {p.totalRevenue > 1000000 ? `${(p.totalRevenue/1000000).toFixed(1)}M` : (p.totalRevenue||0).toLocaleString('en-US')} د.ع
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