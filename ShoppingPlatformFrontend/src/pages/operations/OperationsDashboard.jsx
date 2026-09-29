import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck, Package, Clock, CheckCircle, Users, TrendingUp,
  AlertTriangle, ArrowLeft, RefreshCw, MapPin
} from 'lucide-react'
import { StatCard } from '../../components/common/Card'
import { StatusBadge, Avatar } from '../../components/common/Badge'
import { Skeleton } from '../../components/common/Loading'
import Button from '../../components/common/Button'
import { useOpsNotifications } from '../../hooks/useOpsNotifications'
import {
  useOpsDashboardStats,
  useSubOrdersPaged,
  useDriversPaged,
} from '../../hooks/useOrders'

const getVehicleLabel = (type) =>
  type === 'motorcycle' ? 'دراجة نارية' :
  type === 'car'        ? 'سيارة'        : 'دراجة هوائية'

const OperationsDashboard = () => {
  useOpsNotifications()
  const [dateRange, setDateRange] = useState('today')

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

  // ===== Stats Cards =====
  const statCards = [
    {
      title: 'طلبات جديدة',
      value: (stats?.pendingConfirmation ?? pendingOrders.length).toString(),
      icon: Package,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      title: 'قيد التحضير',
      value: (stats?.preparing ?? preparingOrders.length).toString(),
      icon: Clock,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'قيد التوصيل',
      value: (stats?.outForDelivery ?? shippedOrders.length).toString(),
      icon: Truck,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      title: 'تم التوصيل',
      value: (stats?.delivered ?? deliveredOrders.length).toString(),
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
  ]

  const quickStats = [
    {
      label: 'بانتظار التأكيد',
      value: stats?.pendingConfirmation ?? pendingOrders.length,
      urgent: true,
    },
    {
      label: 'سائقين متاحين',
      value: availableDrivers,
      urgent: false,
    },
    {
      label: 'سائقين مشغولين',
      value: busyDrivers,
      urgent: false,
    },
    {
      label: 'ملغاة اليوم',
      value: stats?.cancelled ?? cancelledOrders.length,
      urgent: (stats?.cancelled ?? cancelledOrders.length) > 5,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التشغيل</h1>
          <p className="text-gray-500 mt-1">مراقبة وإدارة عمليات التوصيل</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm"
          >
            <option value="today">اليوم</option>
            <option value="yesterday">أمس</option>
            <option value="week">هذا الأسبوع</option>
          </select>
          <Link to="/operations/orders?status=PENDING_CONFIRMATION">
            <Button variant="primary">
              <Truck size={16} className="ml-1" />
              تعيين طلبات
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, i) => (
          <div
            key={i}
            className={`bg-white rounded-lg border p-4 ${
              stat.urgent && stat.value > 0 ? 'border-yellow-400' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{stat.label}</p>
              {stat.urgent && stat.value > 0 && (
                <AlertTriangle size={16} className="text-yellow-500" />
              )}
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              stat.urgent && stat.value > 0 ? 'text-yellow-600' : 'text-gray-900'
            }`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Orders */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Package size={20} className="text-primary" />
              الطلبات الجارية
            </h2>
            <Link to="/operations/orders">
              <Button variant="ghost" size="sm">
                عرض الكل <ArrowLeft size={16} className="mr-1" />
              </Button>
            </Link>
          </div>

          {ordersLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>لا توجد طلبات جارية</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeOrders.map(order => (
                <div key={order.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium text-primary">#{order.subOrderNumber}</span>
                      <span className="text-gray-500 text-sm mr-2">• {order.customerName || 'عميل'}</span>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {order.deliveryAddress || '-'}
                    </span>
                    <span>{order.items?.length || 0} منتج</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {(order.total || 0).toLocaleString()} د.ع
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Link to={`/operations/orders?status=${order.status}`}>
                        <Button variant="ghost" size="sm">تفاصيل</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drivers */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-primary" />
              عمال التوصيل
            </h2>
            <Link to="/operations/drivers">
              <Button variant="ghost" size="sm">الكل</Button>
            </Link>
          </div>

          {driversLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : drivers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>لا يوجد سائقين</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {drivers.map(driver => (
                <div key={driver.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar name={driver.fullName} size="md" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        driver.workStatus === 'available'  ? 'bg-green-500'  :
                        driver.workStatus === 'delivering' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">{driver.fullName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          driver.workStatus === 'available'  ? 'bg-green-100 text-green-700'   :
                          driver.workStatus === 'delivering' ? 'bg-yellow-100 text-yellow-700' :
                          driver.workStatus === 'break'      ? 'bg-gray-100 text-gray-600'     :
                                                               'bg-gray-100 text-gray-500'
                        }`}>
                          {driver.workStatus === 'available'  ? 'متاح'       :
                           driver.workStatus === 'delivering' ? 'يوصل'        :
                           driver.workStatus === 'break'      ? 'استراحة'    : 'غير متصل'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{getVehicleLabel(driver.vehicleType)}</span>
                        <span>•</span>
                        <span>{driver.totalDeliveries} توصيل</span>
                        <span>•</span>
                        <span className="text-yellow-600">⭐ {driver.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Orders Alert */}
      {pendingOrders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-yellow-600" />
            <h3 className="font-bold text-yellow-700">
              طلبات بانتظار المعالجة ({pendingOrders.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingOrders.slice(0, 3).map(order => (
              <div key={order.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{order.subOrderNumber}</p>
                  <p className="text-sm text-gray-600">{order.customerName}</p>
                  <p className="text-xs text-gray-500">{(order.total || 0).toLocaleString()} د.ع</p>
                </div>
                <Link to="/operations/orders?status=PENDING_CONFIRMATION">
                  <Button variant="primary" size="sm">معالجة</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link to="/operations/orders?status=PENDING_CONFIRMATION"
          className="bg-yellow-50 p-4 rounded-lg hover:bg-yellow-100 transition-colors flex items-center gap-3">
          <Clock size={24} className="text-yellow-600" />
          <div>
            <p className="font-medium">طلبات جديدة</p>
            <p className="text-sm text-gray-600">{stats?.pendingConfirmation ?? pendingOrders.length} طلب</p>
          </div>
        </Link>
        <Link to="/operations/drivers"
          className="bg-green-50 p-4 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-3">
          <Users size={24} className="text-green-600" />
          <div>
            <p className="font-medium">عمال متاحين</p>
            <p className="text-sm text-gray-600">{availableDrivers} عامل</p>
          </div>
        </Link>
        <Link to="/operations/orders?status=OUT_FOR_DELIVERY"
          className="bg-purple-50 p-4 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-3">
          <Truck size={24} className="text-purple-600" />
          <div>
            <p className="font-medium">قيد التوصيل</p>
            <p className="text-sm text-gray-600">{stats?.outForDelivery ?? shippedOrders.length} طلب</p>
          </div>
        </Link>
        <Link to="/operations/orders?status=DELIVERED"
          className="bg-blue-50 p-4 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-3">
          <TrendingUp size={24} className="text-blue-600" />
          <div>
            <p className="font-medium">تم التوصيل</p>
            <p className="text-sm text-gray-600">{stats?.delivered ?? deliveredOrders.length} طلب</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default OperationsDashboard