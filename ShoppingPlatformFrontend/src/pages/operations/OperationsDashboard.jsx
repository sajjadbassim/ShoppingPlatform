import { Link } from 'react-router-dom'
import {
  Truck, Package, Clock, CheckCircle, Users, AlertTriangle, ArrowLeft, RefreshCw, XCircle,
} from 'lucide-react'
import { StatusBadge, Avatar } from '../../components/common/Badge'
import { Skeleton } from '../../components/common/Loading'
import {
  useOpsDashboardStats,
  useSubOrdersPaged,
  useDriversPaged,
} from '../../hooks/useOrders'
import OverdueConfirmationsAlert from '../../components/common/OverdueConfirmationsAlert'

const getVehicleLabel = (type) =>
  type === 'motorcycle' ? 'دراجة نارية' :
  type === 'car'        ? 'سيارة'        : 'دراجة هوائية'

const OperationsDashboard = () => {
  // ===== Queries =====
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useOpsDashboardStats()

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useSubOrdersPaged({
    pageNumber: 1,
    pageSize: 20,
  })

  const { data: driversData, isLoading: driversLoading } = useDriversPaged({
    pageNumber: 1,
    pageSize: 10,
  })

  const isLoading = statsLoading || ordersLoading

  const refetch = () => {
    refetchStats()
    refetchOrders()
  }

  // ===== Data =====
  const orders = ordersData?.items || []
  const drivers = driversData?.items || []

  const pendingOrders   = orders.filter(o => o.status === 'PENDING_CONFIRMATION')
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED')
  const preparingOrders = orders.filter(o => o.status === 'PREPARING')
  const shippedOrders   = orders.filter(o => o.status === 'OUT_FOR_DELIVERY')
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED')
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED')

  const availableDrivers = drivers.filter(d => d.workStatus === 'available').length
  const busyDrivers      = drivers.filter(d => d.workStatus === 'delivering').length

  const activeOrders = [
    ...pendingOrders,
    ...confirmedOrders,
    ...preparingOrders,
    ...shippedOrders,
  ].slice(0, 5)

  // أرقام اليوم — كل بطاقة تفتح الطلبات المطابقة
  const todayCards = [
    { label: 'بانتظار التأكيد', value: stats?.pendingConfirmation ?? pendingOrders.length, icon: Clock, tone: 'bg-amber-100 text-amber-700', to: 'PENDING_CONFIRMATION', urgent: true },
    { label: 'قيد التحضير', value: (stats?.confirmed ?? confirmedOrders.length) + (stats?.preparing ?? preparingOrders.length), icon: Package, tone: 'bg-indigo-100 text-indigo-700', to: 'PREPARING' },
    { label: 'مع السائق', value: stats?.outForDelivery ?? shippedOrders.length, icon: Truck, tone: 'bg-purple-100 text-purple-700', to: 'OUT_FOR_DELIVERY' },
    { label: 'تم التوصيل', value: stats?.delivered ?? deliveredOrders.length, icon: CheckCircle, tone: 'bg-green-100 text-green-700', to: 'DELIVERED' },
  ]
  const cancelledToday = stats?.cancelled ?? cancelledOrders.length

  return (
    <div className="space-y-5">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">لوحة التشغيل</h1>
          <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={refetch} disabled={isLoading} aria-label="تحديث"
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
        <Link to="/operations/orders" className="h-10 px-4 rounded-full bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5">
          <Package size={16} />الطلبات
        </Link>
      </div>

      {/* تجاوزت مهلة تأكيد المتجر */}
      <OverdueConfirmationsAlert
        orderLink={(o) => `/operations/orders?order=${o.orderId}`}
        allLink="/operations/orders?status=PENDING_CONFIRMATION" />

      {/* ما يحتاج تدخلاً الآن */}
      {pendingOrders.length > 0 && (
        <Link to="/operations/orders?status=PENDING_CONFIRMATION"
          className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100/70">
          <span className="w-11 h-11 rounded-full bg-amber-400 text-white flex items-center justify-center flex-shrink-0"><AlertTriangle size={20} /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-amber-900">{pendingOrders.length} طلب ينتظر تأكيد المتاجر</span>
            <span className="block text-xs text-amber-800/80 truncate">{pendingOrders.slice(0, 3).map(o => o.customerName || o.subOrderNumber).join('، ')}</span>
          </span>
          <ArrowLeft size={18} className="text-amber-700" />
        </Link>
      )}

      {/* أرقام اليوم */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-2">اليوم</p>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {todayCards.map(c => (
              <Link key={c.label} to={`/operations/orders?status=${c.to}`}
                className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow ${c.urgent && c.value > 0 ? 'border-amber-300' : 'border-gray-200'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tone}`}><c.icon size={18} /></span>
                <p className="text-2xl font-bold text-gray-900 mt-3">{c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </Link>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-medium"><span className="w-2 h-2 rounded-full bg-green-500" />{availableDrivers} سائق متاح</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 font-medium"><Truck size={13} />{busyDrivers} يوصل الآن</span>
          {cancelledToday > 0 && (
            <Link to="/operations/orders?status=CANCELLED" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 font-medium"><XCircle size={13} />{cancelledToday} ملغاة اليوم</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* الطلبات الجارية */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-base font-bold text-gray-900 flex items-center gap-2"><Package size={18} className="text-primary" />الطلبات الجارية</p>
            <Link to="/operations/orders" className="text-sm text-primary font-medium inline-flex items-center gap-1">الكل<ArrowLeft size={15} /></Link>
          </div>
          {ordersLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : activeOrders.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><CheckCircle size={32} className="mx-auto mb-2 text-green-300" /><p className="text-sm">لا توجد طلبات جارية</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeOrders.map(order => (
                <Link key={order.id} to={`/operations/orders?status=${order.status}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{order.customerName || 'زبون'} <span className="text-xs text-gray-400" dir="ltr">{order.subOrderNumber}</span></p>
                    <p className="text-xs text-gray-500 truncate">{order.vendorNameAr || order.vendorName} · {order.items?.length || 0} منتج · {(order.total || 0).toLocaleString()} د.ع</p>
                  </div>
                  <StatusBadge status={order.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* السائقون */}
        <section className="bg-white rounded-2xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-base font-bold text-gray-900 flex items-center gap-2"><Users size={18} className="text-primary" />السائقون</p>
            <Link to="/operations/drivers" className="text-sm text-primary font-medium inline-flex items-center gap-1">الكل<ArrowLeft size={15} /></Link>
          </div>
          {driversLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : drivers.length === 0 ? (
            <div className="py-10 text-center text-gray-400"><Users size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">لا يوجد سائقون</p></div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
              {drivers.map(driver => (
                <div key={driver.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative">
                    <Avatar name={driver.fullName} size="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      driver.workStatus === 'available' ? 'bg-green-500' : driver.workStatus === 'delivering' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{driver.fullName}</p>
                    <p className="text-xs text-gray-500">{getVehicleLabel(driver.vehicleType)} · {driver.totalDeliveries} توصيل</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    driver.workStatus === 'available' ? 'bg-green-100 text-green-700' : driver.workStatus === 'delivering' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {driver.workStatus === 'available' ? 'متاح' : driver.workStatus === 'delivering' ? 'يوصل' : driver.workStatus === 'break' ? 'استراحة' : 'غير متصل'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default OperationsDashboard
