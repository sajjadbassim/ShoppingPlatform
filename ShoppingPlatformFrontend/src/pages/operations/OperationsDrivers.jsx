// src/pages/operations/OperationsDrivers.jsx
import { useState } from 'react'
import {
  Search, MoreVertical, Phone, MapPin, Star,
  Package, Clock, CheckCircle, Eye, Edit, Ban,
  Truck, UserPlus, RefreshCw, KeyRound, Wallet
} from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { Avatar } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import Dropdown from '../../components/common/Dropdown'
import EmptyState from '../../components/common/EmptyState'
import Select from '../../components/common/Select'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import {
  useDriversPaged,
  useCreateDriver,
  useUpdateDriver,
  useToggleDriverStatus,
  useUpdateDriverWorkStatus,
  useDriverOrders,
  useDriverStats,
} from '../../hooks/useOrders'
import { useSetDriverAccount, useDriverCash, useSettleDriverCash } from '../../hooks/useDriverApp'

// ===========================
// Helpers (خارج الـ Component)
// ===========================

const getVehicleLabel = (type) =>
  type === 'motorcycle' ? 'دراجة نارية' :
  type === 'car'        ? 'سيارة'        : 'دراجة هوائية'

const getWorkStatusStyle = (ws) => ({
  label: ws === 'available'  ? 'متاح'      :
         ws === 'delivering' ? 'يوصل'       :
         ws === 'break'      ? 'استراحة'   : 'غير متصل',
  dot:   ws === 'available'  ? 'bg-green-500'  :
         ws === 'delivering' ? 'bg-yellow-500' :
         ws === 'break'      ? 'bg-gray-400'   : 'bg-gray-300',
  badge: ws === 'available'  ? 'bg-green-100 text-green-700'   :
         ws === 'delivering' ? 'bg-yellow-100 text-yellow-700' :
         ws === 'break'      ? 'bg-gray-100 text-gray-600'     : 'bg-red-100 text-red-600',
})

const getOrderStatusStyle = (status) => {
  const map = {
    PENDING_CONFIRMATION: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700'   },
    CONFIRMED:            { label: 'مؤكد',          color: 'bg-blue-100 text-blue-700'       },
    PREPARING:            { label: 'قيد التحضير',   color: 'bg-indigo-100 text-indigo-700'   },
    OUT_FOR_DELIVERY:     { label: 'قيد التوصيل',   color: 'bg-purple-100 text-purple-700'   },
    DELIVERED:            { label: 'تم التوصيل',    color: 'bg-green-100 text-green-700'     },
    CANCELLED:            { label: 'ملغي',           color: 'bg-red-100 text-red-600'         },
  }
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
}

const DriverForm = ({ formData, onSubmit, loading, updateFormField, onCancel, withAccount = false }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <Input label="الاسم الكامل" value={formData.fullName}
      onChange={(e) => updateFormField('fullName', e.target.value)}
      placeholder="أدخل اسم السائق" required />
    <Input label="رقم الهاتف" type="tel" value={formData.phone}
      onChange={(e) => updateFormField('phone', e.target.value)}
      placeholder="+964" required />
    <Input label="البريد الإلكتروني" type="email" value={formData.email}
      onChange={(e) => updateFormField('email', e.target.value)}
      placeholder="email@example.com" />
    <Select label="نوع المركبة"
      options={[
        { value: 'motorcycle', label: 'دراجة نارية' },
        { value: 'car',        label: 'سيارة' },
        { value: 'bicycle',    label: 'دراجة هوائية' },
      ]}
      value={formData.vehicleType}
      onChange={(val) => updateFormField('vehicleType', val)}
      placeholder="اختر نوع المركبة" />
    <Input label="منطقة العمل" value={formData.workArea}
      onChange={(e) => updateFormField('workArea', e.target.value)}
      placeholder="مثال: المنصور، الكرادة" />
    {withAccount && (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1">
        <Input label="كلمة مرور لوحة السائق (اختياري)" type="password" value={formData.password || ''}
          onChange={(e) => updateFormField('password', e.target.value)}
          placeholder="6 أحرف على الأقل" minLength={6} autoComplete="new-password" />
        <p className="text-xs text-gray-500">يدخل السائق برقم هاتفه وهذه الكلمة ليرى طلباته ويسلّمها. يمكن إضافتها لاحقاً.</p>
      </div>
    )}
    <div className="flex gap-2 pt-4">
      <Button variant="ghost" type="button" fullWidth
        onClick={onCancel}>
        إلغاء
      </Button>
      <Button variant="primary" type="submit" fullWidth loading={loading}>حفظ</Button>
    </div>
  </form>
)

// ===========================
// Driver Details Content
// ===========================

const DriverDetailsContent = ({ driver, onEdit, onViewOrders }) => {
  const { data: stats, isLoading: statsLoading } = useDriverStats(driver.id)
  const ws = getWorkStatusStyle(driver.workStatus)

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <Avatar name={driver.fullName} size="xl" />
        <div>
          <h3 className="text-lg font-bold text-gray-900 truncate">{driver.fullName}</h3>
          <p className="text-gray-500">{getVehicleLabel(driver.vehicleType)}</p>
          {driver.workArea && <p className="text-sm text-gray-500 mt-1">{driver.workArea}</p>}
          <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${ws.badge}`}>
            {ws.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : stats ? (
        <>
          {/* إحصائيات */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-2xl font-bold text-blue-600">{stats.deliveriesToday}</p>
              <p className="text-xs text-gray-600 mt-1">توصيلات اليوم</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-2xl font-bold text-purple-600">{stats.deliveriesThisWeek}</p>
              <p className="text-xs text-gray-600 mt-1">هذا الأسبوع</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-2xl font-bold text-green-600">{stats.totalDeliveries}</p>
              <p className="text-xs text-gray-600 mt-1">إجمالي التوصيلات</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <p className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                <Star size={16} fill="currentColor" />
                {stats.rating?.toFixed(1) || '0.0'}
              </p>
              <p className="text-xs text-gray-600 mt-1">التقييم</p>
            </div>
          </div>

          {/* معدل النجاح */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">معدل النجاح</span>
              <span className="text-sm font-bold text-green-600">{stats.successRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{stats.totalDeliveries} ناجح</span>
              <span>{stats.totalCancelled} ملغي</span>
            </div>
          </div>

          {/* هذا الشهر */}
          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-sm text-gray-600">توصيلات هذا الشهر</span>
            <span className="text-lg font-bold text-indigo-600">{stats.deliveriesThisMonth}</span>
          </div>

          {/* الطلبات الحالية */}
          {stats.activeOrders > 0 && (
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
              <span className="text-sm text-gray-600">طلبات جارية الآن</span>
              <span className="text-lg font-bold text-orange-600">{stats.activeOrders}</span>
            </div>
          )}
        </>
      ) : null}

      {/* Contact Info */}
      <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <Phone size={16} className="text-gray-400" />
          <span>{driver.phone}</span>
        </div>
        {driver.email && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">@</span>
            <span>{driver.email}</span>
          </div>
        )}
        {driver.workArea && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-gray-400" />
            <span>{driver.workArea}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="primary" fullWidth onClick={() => window.open(`tel:${driver.phone}`)}>
          <Phone size={16} className="ml-1" />اتصال
        </Button>
        <Button variant="outline" fullWidth onClick={onEdit}>
          <Edit size={16} className="ml-1" />تعديل
        </Button>
        <Button variant="outline" fullWidth onClick={onViewOrders}>
          <Package size={16} className="ml-1" />الطلبات
        </Button>
      </div>
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const OperationsDrivers = () => {
  const { success, error: toastError } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDriver, setSelectedDriver] = useState(null)

  // Modals
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWorkStatusModal, setShowWorkStatusModal] = useState(false)
  const [showOrdersModal, setShowOrdersModal] = useState(false)

  // Work Status
  const [workStatusDriver, setWorkStatusDriver] = useState(null)
  const [newWorkStatus, setNewWorkStatus] = useState('')

  // Driver Orders
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersFilter, setOrdersFilter] = useState('all')

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    vehicleType: '',
    workArea: '',
    password: '',
  })

  // حساب الدخول والنقد
  const [accountDriver, setAccountDriver] = useState(null)
  const [accountPassword, setAccountPassword] = useState('')
  const [cashDriver, setCashDriver] = useState(null)
  const { mutateAsync: setAccount, isPending: savingAccount } = useSetDriverAccount()
  const { data: cash, isLoading: cashLoading } = useDriverCash(cashDriver?.id)
  const { mutateAsync: settleCash, isPending: settling } = useSettleDriverCash()

  // ===== Queries =====
  const { data, isLoading, refetch } = useDriversPaged({
    pageNumber: currentPage,
    pageSize: 12,
  })

  const drivers = data?.items || []
  const totalPages = data?.totalPages || 1
  const totalCount = data?.totalCount || 0

  const { data: driverOrdersData, isLoading: ordersLoading } = useDriverOrders(
    showOrdersModal ? selectedDriver?.id : null,
    {
      pageNumber: ordersPage,
      pageSize: 8,
      filter: ordersFilter !== 'all' ? ordersFilter : undefined,
    }
  )
  const driverOrders = driverOrdersData?.items || []
  const ordersTotalPages = driverOrdersData?.totalPages || 1
  const ordersTotalCount = driverOrdersData?.totalCount || 0

  // ===== Mutations =====
  const { mutateAsync: createDriver, isPending: creating } = useCreateDriver()
  const { mutateAsync: updateDriver, isPending: updating } = useUpdateDriver()
  const { mutateAsync: toggleStatus, isPending: toggling } = useToggleDriverStatus()
  const { mutateAsync: updateWorkStatus, isPending: updatingWork } = useUpdateDriverWorkStatus()

  // ===== Filters =====
  const getFilteredDrivers = (filter) => {
    let filtered = drivers
    if (filter === 'online')
      filtered = filtered.filter(d => d.status === 'active' && d.workStatus !== 'offline')
    else if (filter === 'offline')
      filtered = filtered.filter(d => d.workStatus === 'offline' || d.status !== 'active')
    if (searchQuery)
      filtered = filtered.filter(d =>
        d.fullName?.includes(searchQuery) || d.phone?.includes(searchQuery)
      )
    return filtered
  }

  const counts = {
    all: drivers.length,
    online: drivers.filter(d => d.status === 'active' && d.workStatus !== 'offline').length,
    offline: drivers.filter(d => d.workStatus === 'offline' || d.status !== 'active').length,
  }

  // ===== Handlers =====
  const handleViewDriver = (driver) => {
    setSelectedDriver(driver)
    setShowDriverModal(true)
  }

  const handleViewOrders = (driver) => {
    setSelectedDriver(driver)
    setOrdersPage(1)
    setOrdersFilter('all')
    setShowDriverModal(false)
    setShowOrdersModal(true)
  }

  const handleEditDriver = (driver) => {
    setSelectedDriver(driver)
    setFormData({
      fullName:    driver.fullName,
      phone:       driver.phone,
      email:       driver.email || '',
      vehicleType: driver.vehicleType,
      workArea:    driver.workArea || '',
    })
    setShowEditModal(true)
  }

  const handleToggleStatus = async (driver) => {
    try {
      await toggleStatus(driver.id)
      success(driver.status === 'active' ? 'تم إيقاف السائق' : 'تم تفعيل السائق')
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل تغيير الحالة')
    }
  }

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCreateDriver = async (e) => {
    e.preventDefault()
    try {
      const { password, ...rest } = formData
      await createDriver(password ? { ...rest, password } : rest)
      success(password ? 'تم إضافة السائق وإنشاء حسابه' : 'تم إضافة السائق بنجاح')
      setShowAddModal(false)
      setFormData({ fullName: '', phone: '', email: '', vehicleType: '', workArea: '', password: '' })
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل إضافة السائق')
    }
  }

  const handleUpdateDriver = async (e) => {
    e.preventDefault()
    try {
      await updateDriver({ id: selectedDriver.id, data: formData })
      success('تم تعديل بيانات السائق')
      setShowEditModal(false)
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل تعديل البيانات')
    }
  }

  const handleUpdateWorkStatus = async () => {
    try {
      await updateWorkStatus({ id: workStatusDriver.id, workStatus: newWorkStatus })
      success('تم تحديث حالة السائق')
      setShowWorkStatusModal(false)
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل تحديث الحالة')
    }
  }

  const handleSaveAccount = async (e) => {
    e.preventDefault()
    try {
      await setAccount({ driverId: accountDriver.id, password: accountPassword })
      success(accountDriver.hasAccount ? 'تم تغيير كلمة المرور' : 'تم إنشاء حساب السائق')
      setAccountDriver(null)
      refetch()
    } catch (err) {
      toastError(err.message || 'تعذّر حفظ الحساب')
    }
  }

  const handleSettleCash = async () => {
    if (!window.confirm(`تأكيد استلام ${(cash?.total || 0).toLocaleString()} د.ع من ${cashDriver.fullName}؟`)) return
    try {
      await settleCash(cashDriver.id)
      success('تم تسجيل استلام النقد')
      setCashDriver(null)
    } catch (err) {
      toastError(err.message || 'تعذّر التسجيل')
    }
  }

  const getDriverActions = (driver) => [
    { label: 'عرض التفاصيل',    icon: Eye,        onClick: () => handleViewDriver(driver) },
    { label: 'طلبات السائق',     icon: Package,    onClick: () => handleViewOrders(driver) },
    { label: 'تعديل',             icon: Edit,       onClick: () => handleEditDriver(driver) },
    {
      label: 'تغيير حالة العمل', icon: RefreshCw,
      onClick: () => {
        setWorkStatusDriver(driver)
        setNewWorkStatus(driver.workStatus)
        setShowWorkStatusModal(true)
      }
    },
    { label: 'اتصال', icon: Phone, onClick: () => window.open(`tel:${driver.phone}`) },
    { label: driver.hasAccount ? 'تغيير كلمة المرور' : 'إنشاء حساب دخول', icon: KeyRound,
      onClick: () => { setAccountPassword(''); setAccountDriver(driver) } },
    { label: 'النقد مع السائق', icon: Wallet, onClick: () => setCashDriver(driver) },
    { divider: true },
    driver.status === 'active'
      ? { label: 'إيقاف مؤقت', icon: Ban,          onClick: () => handleToggleStatus(driver), danger: true }
      : { label: 'تفعيل',       icon: CheckCircle,  onClick: () => handleToggleStatus(driver) },
  ]

  // ===== Driver Card =====
  const DriverCard = ({ driver }) => {
    const ws = getWorkStatusStyle(driver.workStatus)
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={driver.fullName} size="lg" />
              <div className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-white ${ws.dot}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{driver.fullName}</h3>
              <p className="text-sm text-gray-500">{getVehicleLabel(driver.vehicleType)}</p>
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MoreVertical size={18} className="text-gray-500" />
              </button>
            }
            items={getDriverActions(driver)}
            align="left"
          />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={14} /><span>{driver.phone}</span>
          </div>
          {driver.workArea && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} /><span>{driver.workArea}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <Star size={14} fill="currentColor" />
            <span>{driver.rating?.toFixed(1) || '0.0'}</span>
            <span className="text-gray-400">({driver.totalDeliveries} توصيل)</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-200">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ws.badge}`}>
            {ws.label}
          </span>
          {driver.hasAccount
            ? <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 flex items-center gap-1"><KeyRound size={11} /> له حساب</span>
            : <button type="button" onClick={() => { setAccountPassword(''); setAccountDriver(driver) }}
                className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:text-primary hover:border-primary">+ حساب</button>}
          <span className={`text-xs px-2 py-1 rounded-full ${
            driver.status === 'active'    ? 'bg-green-100 text-green-700' :
            driver.status === 'suspended' ? 'bg-red-100 text-red-600'    : 'bg-gray-100 text-gray-600'
          }`}>
            {driver.status === 'active' ? 'نشط' : driver.status === 'suspended' ? 'موقوف' : 'غير نشط'}
          </span>
        </div>
      </div>
    )
  }

  // ===== Drivers Grid =====
  const DriversGrid = ({ filter }) => {
    const filtered = getFilteredDrivers(filter)
    if (isLoading)
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52" />)}
        </div>
      )
    if (filtered.length === 0)
      return <EmptyState type="users" title="لا يوجد سائقين" description="لم يتم العثور على سائقين" />
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {filtered.map(driver => <DriverCard key={driver.id} driver={driver} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">عمال التوصيل</h1>
          <p className="text-gray-500 mt-1">{totalCount} سائق مسجل</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" onClick={() => {
            setFormData({ fullName: '', phone: '', email: '', vehicleType: '', workArea: '' })
            setShowAddModal(true)
          }}>
            <UserPlus size={16} className="ml-1" />إضافة سائق
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي السائقين',  value: totalCount,    icon: Truck,       bg: 'bg-primary-light', color: 'text-primary' },
          { label: 'متصل الآن',        value: counts.online, icon: CheckCircle, bg: 'bg-success-light', color: 'text-success' },
          { label: 'قيد التوصيل',      value: drivers.filter(d => d.workStatus === 'delivering').length, icon: Package, bg: 'bg-warning-light', color: 'text-warning' },
          { label: 'إجمالي التوصيلات', value: drivers.reduce((s, d) => s + (d.totalDeliveries || 0), 0), icon: Clock,   bg: 'bg-info-light',    color: 'text-info'    },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="البحث بالاسم أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-10 pl-4 border border-gray-300 rounded-lg text-sm"
            />
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <Tabs defaultValue="all">
          <div className="px-4 border-b border-gray-200">
            <TabsList>
              <TabsTrigger value="all"     badge={counts.all}>الكل</TabsTrigger>
              <TabsTrigger value="online"  badge={counts.online}>متصل</TabsTrigger>
              <TabsTrigger value="offline" badge={counts.offline}>غير متصل</TabsTrigger>
            </TabsList>
          </div>
          {['all', 'online', 'offline'].map(filter => (
            <TabsContent key={filter} value={filter}>
              <DriversGrid filter={filter} />
            </TabsContent>
          ))}
        </Tabs>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* ===== Modals ===== */}

      {/* Driver Details Modal */}
      <Modal isOpen={showDriverModal} onClose={() => setShowDriverModal(false)} title="تفاصيل السائق" size="lg">
        {selectedDriver && (
          <DriverDetailsContent
            driver={selectedDriver}
            onEdit={() => { setShowDriverModal(false); handleEditDriver(selectedDriver) }}
            onViewOrders={() => handleViewOrders(selectedDriver)}
          />
        )}
      </Modal>

      {/* Driver Orders Modal */}
      <Modal
        isOpen={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        title={`طلبات السائق — ${selectedDriver?.fullName}`}
        size="xl"
      >
        <div className="space-y-4">

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
            {[
              { value: 'all',       label: 'الكل' },
              { value: 'active',    label: 'الجارية' },
              { value: 'completed', label: 'المكتملة' },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => { setOrdersFilter(tab.value); setOrdersPage(1) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ordersFilter === tab.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="mr-auto text-sm text-gray-500">{ordersTotalCount} طلب</span>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : driverOrders.length === 0 ? (
            <EmptyState title="لا توجد طلبات" description="لم يتم العثور على طلبات لهذا السائق" />
          ) : (
            <div className="space-y-3">
              {driverOrders.map(order => {
                const statusStyle = getOrderStatusStyle(order.status)
                return (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-primary">#{order.subOrderNumber}</span>
                        <span className="text-gray-500 text-sm mr-2">• {order.customerName}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle.color}`}>
                        {statusStyle.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} />{order.deliveryAddress || '-'}
                      </span>
                      <span>{order.items?.length || 0} منتج</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">
                        {(order.total || 0).toLocaleString()} د.ع
                      </span>
                      <span className="text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString('ar-IQ')} —{' '}
                        {new Date(order.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {ordersTotalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination currentPage={ordersPage} totalPages={ordersTotalPages} onPageChange={setOrdersPage} />
            </div>
          )}
        </div>
      </Modal>

      {/* Add Driver Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="إضافة سائق جديد" size="md">
        <DriverForm
          formData={formData}
          onSubmit={handleCreateDriver}
          loading={creating}
          updateFormField={updateFormField}
          onCancel={() => setShowAddModal(false)}
          withAccount
        />
      </Modal>

      {/* Edit Driver Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="تعديل بيانات السائق" size="md">
        <DriverForm
          formData={formData}
          onSubmit={handleUpdateDriver}
          loading={updating}
          updateFormField={updateFormField}
          onCancel={() => setShowEditModal(false)}
        />
      </Modal>

      {/* Work Status Modal */}
      <Modal isOpen={showWorkStatusModal} onClose={() => setShowWorkStatusModal(false)} title="تغيير حالة العمل" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600">تغيير حالة: {workStatusDriver?.fullName}</p>
          <Select
            label="حالة العمل"
            options={[
              { value: 'available',  label: 'متاح'       },
              { value: 'delivering', label: 'يوصل'        },
              { value: 'break',      label: 'استراحة'    },
              { value: 'offline',    label: 'غير متصل'   },
            ]}
            value={newWorkStatus}
            onChange={setNewWorkStatus}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setShowWorkStatusModal(false)}>إلغاء</Button>
            <Button variant="primary" fullWidth loading={updatingWork} onClick={handleUpdateWorkStatus}>حفظ</Button>
          </div>
        </div>
      </Modal>

      {/* حساب الدخول */}
      <Modal isOpen={!!accountDriver} onClose={() => setAccountDriver(null)}
        title={accountDriver?.hasAccount ? 'تغيير كلمة مرور السائق' : 'إنشاء حساب دخول للسائق'} size="sm">
        {accountDriver && (
          <form onSubmit={handleSaveAccount} className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-3 text-sm">
              <p className="text-gray-500">يدخل من صفحة تسجيل الدخول برقم:</p>
              <p className="font-bold text-gray-900" dir="ltr">{accountDriver.phone}</p>
            </div>
            <Input label="كلمة المرور" type="password" value={accountPassword} required minLength={6}
              onChange={(e) => setAccountPassword(e.target.value)} placeholder="6 أحرف على الأقل" autoComplete="new-password" />
            <div className="flex gap-2">
              <Button variant="ghost" type="button" fullWidth onClick={() => setAccountDriver(null)}>إلغاء</Button>
              <Button variant="primary" type="submit" fullWidth loading={savingAccount} disabled={accountPassword.length < 6}>حفظ</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* النقد مع السائق */}
      <Modal isOpen={!!cashDriver} onClose={() => setCashDriver(null)} title={`النقد مع ${cashDriver?.fullName || ''}`} size="sm">
        {cashLoading ? <Skeleton className="h-24" /> : (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm text-amber-800">مبالغ استلمها من الزبائن ولم يسلّمها بعد</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{(cash?.total || 0).toLocaleString()} د.ع</p>
            </div>
            {cash?.items?.length > 0 ? (
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
                {cash.items.map(i => (
                  <div key={i.orderId} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-mono text-gray-900" dir="ltr">{i.orderNumber}</p>
                      <p className="text-xs text-gray-500">{new Date(i.collectedAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <span className="font-bold text-gray-900">{i.amount.toLocaleString()} د.ع</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-sm text-gray-500">لا يوجد نقد معلّق مع هذا السائق</p>}
            <Button variant="primary" fullWidth loading={settling} disabled={!cash?.items?.length} onClick={handleSettleCash}>
              استلمت المبلغ من السائق
            </Button>
          </div>
        )}
      </Modal>

    </div>
  )
}

export default OperationsDrivers