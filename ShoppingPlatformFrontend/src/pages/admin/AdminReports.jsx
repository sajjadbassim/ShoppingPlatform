// src/pages/admin/AdminReports.jsx
import { useState } from 'react'
import {
  TrendingUp, DollarSign, ShoppingCart, Store,
  Package, RefreshCw, Calendar,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const AdminReports = () => {
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })

  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['admin-sales-report', dateRange],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.SALES, {
        startDate: dateRange.startDate || undefined,
        endDate:   dateRange.endDate   || undefined,
      })
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: topVendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['admin-top-vendors-report'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_VENDORS, { count: 10 })
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: topProductsData, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-top-products-report'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_PRODUCTS, { count: 10 })
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const dailyStats    = salesData?.dailyStats ?? []
  const topVendors    = Array.isArray(topVendorsData)  ? topVendorsData  : (topVendorsData?.items  ?? [])
  const topProducts   = Array.isArray(topProductsData) ? topProductsData : (topProductsData?.items ?? [])
  const maxRevenue    = dailyStats.length ? Math.max(...dailyStats.map(d => d.totalRevenue)) : 1

  const inputCls = "h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-gray-500 mt-1">تحليل أداء المنصة والمبيعات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateRange.startDate}
            onChange={e => setDateRange(p => ({...p, startDate: e.target.value}))}
            className={inputCls} />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={dateRange.endDate}
            onChange={e => setDateRange(p => ({...p, endDate: e.target.value}))}
            className={inputCls} />
          <button onClick={() => refetchSales()}
            className="p-2 hover:bg-gray-100 rounded-lg border border-gray-300">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {salesLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: salesData?.totalRevenue ? `${(salesData.totalRevenue/1000000).toFixed(2)}M د.ع` : '0', icon: DollarSign, color: 'bg-green-100 text-green-600' },
            { label: 'إجمالي الطلبات',  value: salesData?.totalOrders ?? 0, icon: ShoppingCart, color: 'bg-blue-100 text-blue-600' },
            { label: 'أفضل متجر',       value: topVendors[0]?.vendorName || '—', icon: Store,       color: 'bg-yellow-100 text-yellow-600' },
            { label: 'أفضل منتج',       value: topProducts[0]?.productName || topProducts[0]?.productNameAr || '—', icon: Package, color: 'bg-purple-100 text-purple-600' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                <c.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="font-bold text-gray-900 truncate">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sales Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          المبيعات اليومية
        </h2>
        {salesLoading ? (
          <Skeleton className="h-40" />
        ) : dailyStats.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400">
            <p className="text-sm">لا توجد بيانات للفترة المحددة</p>
          </div>
        ) : (
          <>
            <div style={{ height: '160px' }} className="flex items-end gap-1 overflow-x-auto pb-6">
              {dailyStats.map((day, i) => {
                const pct   = Math.max(4, Math.round((day.totalRevenue / maxRevenue) * 140))
                const date  = new Date(day.date)
                const label = `${date.getDate()}/${date.getMonth()+1}`
                return (
                  <div key={i} className="flex-1 min-w-5 flex flex-col items-center group relative"
                    style={{ height: '100%', justifyContent: 'flex-end' }}>
                    <div className="absolute hidden group-hover:block z-10 pointer-events-none"
                      style={{ bottom: `${pct+20}px` }}>
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        <p className="font-medium">{label}</p>
                        <p>{day.totalRevenue.toLocaleString()} د.ع</p>
                        <p className="text-gray-300">{day.totalOrders} طلب</p>
                      </div>
                    </div>
                    <div className="w-full bg-primary hover:bg-primary/80 transition-colors rounded-t-sm"
                      style={{ height: `${pct}px`, minHeight: '4px' }} />
                    <span className="text-gray-400 absolute bottom-0" style={{ fontSize: '9px' }}>{label}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
              <span>من: {salesData?.startDate ? new Date(salesData.startDate).toLocaleDateString('ar-IQ') : '—'}</span>
              <span>إلى: {salesData?.endDate ? new Date(salesData.endDate).toLocaleDateString('ar-IQ') : '—'}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Store size={18} className="text-primary" />أفضل المتاجر
          </h2>
          {vendorsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : topVendors.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {topVendors.map((v, i) => (
                <div key={v.vendorId || i} className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i+1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{v.vendorName || v.name}</p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${Math.round((v.totalRevenue / (topVendors[0]?.totalRevenue||1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-left text-xs flex-shrink-0">
                    <p className="font-medium text-gray-900">{v.totalRevenue > 1000000 ? `${(v.totalRevenue/1000000).toFixed(1)}M` : (v.totalRevenue||0).toLocaleString()} د.ع</p>
                    <p className="text-gray-400">{v.totalOrders ?? 0} طلب</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package size={18} className="text-primary" />أفضل المنتجات
          </h2>
          {productsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : topProducts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">لا توجد بيانات</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.productId || i} className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i+1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {p.productNameAr || p.productName || p.name}
                    </p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round(((p.totalQuantity||p.quantity||0) / (topProducts[0]?.totalQuantity||topProducts[0]?.quantity||1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-left text-xs flex-shrink-0">
                    <p className="font-medium text-gray-900">{(p.totalRevenue||0).toLocaleString()} د.ع</p>
                    <p className="text-gray-400">{p.totalQuantity ?? p.quantity ?? 0} وحدة</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminReports