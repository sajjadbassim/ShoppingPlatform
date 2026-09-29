// src/pages/admin/AdminStores.jsx
import { useState } from 'react'
import {
  Store, Search, RefreshCw, Eye, Star, Phone,
  MapPin, Package, TrendingUp, Ban, CheckCircle,
  Clock, AlertTriangle,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getVendorLogo } from '../../utils/imageHelper'

// ===========================
// Helpers
// ===========================

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
    active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-amber-500'}`} />
    {active ? 'نشط' : 'قيد المراجعة'}
  </span>
)

// ===========================
// Hooks
// ===========================

const useStores = (params = {}) => useQuery({
  queryKey: ['admin-stores', params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.VENDORS.PAGED, params)
    const raw = r.data
    if (raw?.data && raw?.pagination) {
      return {
        items:      Array.isArray(raw.data) ? raw.data : [],
        totalPages: raw.pagination.totalPages  ?? 1,
        totalCount: raw.pagination.totalCount  ?? 0,
      }
    }
    return { items: Array.isArray(raw?.data) ? raw.data : [], totalPages: 1, totalCount: 0 }
  },
  staleTime: 2 * 60 * 1000,
})

const useTopVendors = () => useQuery({
  queryKey: ['admin-top-vendors'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_VENDORS, { count: 5 })
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

const useToggleStoreStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiPut(API_ENDPOINTS.ADMIN.TOGGLE_VENDOR_STATUS(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      queryClient.invalidateQueries({ queryKey: ['admin-top-vendors'] })
    },
  })
}

// ✅ رفع صلاحية مالك المتجر (ownerId يصل مباشرة عبر الـ FK ضمن استجابة المتجر)
const activateVendorWithRole = async (store) => {
  try {
    const userId = store.ownerId
    if (!userId) return { upgraded: false }

    // 1. جلب المستخدم للتأكد من دوره الحالي
    const userRes = await apiGet(`/api/Users/${userId}`)
    const role = userRes.data?.data?.role || userRes.data?.role

    // 2. رفع الصلاحية فقط إذا كان CUSTOMER
    if (role === 'CUSTOMER') {
      await apiPut(`/api/Admin/users/${userId}/change-role`, { newRole: 'VENDOR' })
      return { upgraded: true }
    }
    return { upgraded: false }
  } catch {
    // إذا فشل الرفع — نكمل بدون رفع الصلاحية (متجر بلا مالك مربوط مثلاً)
    return { upgraded: false }
  }
}

// ===========================
// Store Detail Modal
// ===========================

const StoreDetailModal = ({ store, onClose, onToggle, toggling }) => {
  if (!store) return null

  const { data: ratingData } = useQuery({
    queryKey: ['vendor-rating', store.id],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RATING_ADMIN.BY_VENDOR(store.id))
      return r.data.data || r.data
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  })
  const avgRating = ratingData?.averageRating ?? ratingData?.overallAverage ?? null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-bold text-lg">تفاصيل المتجر</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
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
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge active={store.isActive} />
                <span className="text-xs text-gray-400">
                  {new Date(store.createdAt).toLocaleDateString('ar-IQ')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Phone,    label: 'الهاتف',            value: store.phone,             dir: 'ltr' },
              { icon: MapPin,   label: 'العنوان',            value: store.address                       },
              { icon: Package,  label: 'الحد الأدنى للطلب', value: store.minOrderAmount ? `${store.minOrderAmount.toLocaleString()} د.ع` : '—' },
              { icon: TrendingUp, label: 'رسوم التوصيل',   value: store.deliveryFee ? `${store.deliveryFee.toLocaleString()} د.ع` : '—' },
              { icon: Store,    label: 'وقت التحضير',       value: store.estimatedPrepTime ? `${store.estimatedPrepTime} دقيقة` : '—' },
              { icon: Star,     label: 'التقييم',            value: avgRating ? `${Number(avgRating).toFixed(1)} ⭐` : '—' },
            ].map(({ icon: Icon, label, value, dir }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} className="text-gray-400" />
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
                <p className="font-medium text-gray-900 text-sm" dir={dir}>{value || '—'}</p>
              </div>
            ))}
          </div>

          {store.description && !store.description.includes('?') && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">الوصف</p>
              <p className="text-sm text-gray-700">{store.description}</p>
            </div>
          )}

          {/* تنبيه للمتاجر غير المفعلة */}
          {!store.isActive && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">متجر قيد المراجعة</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  تفعيل المتجر سيتيح للبائع البدء في إضافة المنتجات وقبول الطلبات
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={onClose}>إغلاق</Button>
            <Button
              variant={store.isActive ? 'danger' : 'primary'}
              fullWidth loading={toggling}
              onClick={() => onToggle(store)}
            >
              {store.isActive
                ? <><Ban size={15} className="ml-1" />تعطيل المتجر</>
                : <><CheckCircle size={15} className="ml-1" />تفعيل المتجر</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================
// Store Row
// ===========================

const StoreRow = ({ store, onView, onToggle, toggling }) => (
  <tr className="hover:bg-gray-50">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
          {getVendorLogo(store)
            ? <img src={getVendorLogo(store)} alt="" className="w-full h-full object-cover" />
            : <Store size={18} className="text-gray-400" />
          }
        </div>
        <div>
          <p className="font-medium text-gray-900">{store.nameAr || store.name}</p>
          <p className="text-xs text-gray-400">{store.name}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">{store.phone || '—'}</td>
    <td className="px-4 py-3 text-sm text-gray-500 max-w-32 truncate">{store.address || '—'}</td>
    <td className="px-4 py-3 text-sm text-gray-600">
      {store.deliveryFee ? `${store.deliveryFee.toLocaleString()} د.ع` : '—'}
    </td>
    <td className="px-4 py-3 text-xs text-gray-400">
      {new Date(store.createdAt).toLocaleDateString('ar-IQ')}
    </td>
    <td className="px-4 py-3"><StatusBadge active={store.isActive} /></td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1">
        <button onClick={() => onView(store)}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="عرض">
          <Eye size={15} />
        </button>
        <button onClick={() => onToggle(store)} disabled={toggling}
          className={`p-1.5 rounded-lg ${store.isActive ? 'hover:bg-red-50 text-red-400' : 'hover:bg-green-50 text-green-500'}`}
          title={store.isActive ? 'تعطيل' : 'تفعيل'}>
          {store.isActive ? <Ban size={15} /> : <CheckCircle size={15} />}
        </button>
      </div>
    </td>
  </tr>
)

// ===========================
// Pending Card (للمتاجر قيد المراجعة)
// ===========================

const PendingCard = ({ store, onApprove, onView, toggling }) => (
  <div className="bg-white border border-amber-200 rounded-xl p-4 flex items-start gap-4">
    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
      {getVendorLogo(store)
        ? <img src={getVendorLogo(store)} alt="" className="w-full h-full object-cover" />
        : <Store size={24} className="text-gray-400" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900">{store.nameAr || store.name}</p>
          <p className="text-xs text-gray-500" dir="ltr">{store.phone}</p>
          {store.address && <p className="text-xs text-gray-400 mt-0.5">{store.address}</p>}
        </div>
        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
          <Clock size={11} />قيد المراجعة
        </span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => onView(store)}
          className="flex-1 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
          عرض التفاصيل
        </button>
        <button onClick={() => onApprove(store)} disabled={toggling}
          className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
          <CheckCircle size={13} />تفعيل المتجر
        </button>
      </div>
    </div>
  </div>
)

// ===========================
// Main Component
// ===========================

const AdminStores = () => {
  const { success, error: showError } = useToast()

  const [search, setSearch]         = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [page, setPage]             = useState(1)
  const [selectedStore, setSelectedStore] = useState(null)

  // جلب كل المتاجر (نشطة وغير نشطة)
  const { data, isLoading, refetch } = useStores({
    PageNumber: page, PageSize: 20,
    onlyActive: false,
    searchTerm: search || undefined,
  })

  const { data: topVendors, isLoading: topLoading } = useTopVendors()
  const { mutateAsync: toggleStatus, isPending: toggling } = useToggleStoreStatus()

  const stores      = data?.items ?? []
  const totalPages  = data?.totalPages ?? 1
  const total       = data?.totalCount ?? stores.length
  const activeCount = stores.filter(s => s.isActive).length
  const pendingList = stores.filter(s => !s.isActive)
  const pendingCount = pendingList.length

  const displayStores = activeFilter === 'active'
    ? stores.filter(s => s.isActive)
    : activeFilter === 'pending'
    ? pendingList
    : stores

  const handleToggle = async (store) => {
    try {
      // 1. تفعيل/تعطيل المتجر
      await toggleStatus(store.id)

      // 2. إذا كان التفعيل (وليس التعطيل) — ارفع صلاحية المستخدم
      if (!store.isActive) {
        const { upgraded } = await activateVendorWithRole(store)
        success(upgraded
          ? `✅ تم تفعيل ${store.nameAr || store.name} ورفع صلاحية البائع`
          : `✅ تم تفعيل ${store.nameAr || store.name}`)
      } else {
        success(`تم تعطيل ${store.nameAr || store.name}`)
      }
      setSelectedStore(null)
    } catch (err) {
      showError(err.message || 'فشلت العملية')
    }
  }

  const topVendorsList = Array.isArray(topVendors) ? topVendors : (topVendors?.items ?? [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المتاجر</h1>
          <p className="text-gray-500 mt-1">إدارة ومراجعة طلبات المتاجر</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي المتاجر',      value: total,        color: 'text-gray-900',   bg: 'bg-gray-50'   },
          { label: 'متاجر نشطة',           value: activeCount,  color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'قيد المراجعة',         value: pendingCount, color: 'text-amber-600',  bg: 'bg-amber-50'  },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ===== طلبات المراجعة ===== */}
      {pendingCount > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="font-bold text-amber-800 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              طلبات المتاجر الجديدة
              <span className="w-6 h-6 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            </h2>
            <p className="text-xs text-amber-600">تحتاج إلى مراجعة وموافقة</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingList.map(store => (
              <PendingCard
                key={store.id}
                store={store}
                onApprove={handleToggle}
                onView={setSelectedStore}
                toggling={toggling}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top Vendors */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          أفضل المتاجر أداءً
        </h2>
        {topLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : topVendorsList.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {topVendorsList.map((v, i) => (
              <div key={v.id || i} className="flex items-center gap-3">
                <span className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {getVendorLogo(v)
                    ? <img src={getVendorLogo(v)} alt="" className="w-full h-full object-cover" />
                    : <Store size={16} className="text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{v.vendorName || v.nameAr || v.name}</p>
                  <p className="text-xs text-gray-400">{v.totalOrders ?? v.ordersCount ?? 0} طلب</p>
                </div>
                <div className="text-sm text-left">
                  <p className="font-medium text-gray-900">
                    {(v.totalRevenue ?? 0) > 1000000
                      ? `${((v.totalRevenue ?? 0) / 1000000).toFixed(1)}M`
                      : (v.totalRevenue ?? 0).toLocaleString()} د.ع
                  </p>
                  {v.rating > 0 && <p className="text-xs text-yellow-500">⭐ {v.rating.toFixed(1)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="البحث بالاسم أو الهاتف..."
              className="w-full h-9 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'all',     label: 'الكل',          count: total        },
              { key: 'active',  label: 'النشطة',         count: activeCount  },
              { key: 'pending', label: 'قيد المراجعة',  count: pendingCount },
            ].map(f => (
              <button key={f.key} onClick={() => { setActiveFilter(f.key); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                  activeFilter === f.key ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:border-primary'
                }`}>
                {f.label}
                {f.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeFilter === f.key ? 'bg-white/20' : 'bg-gray-100'
                  }`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : displayStores.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Store size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد متاجر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['المتجر', 'الهاتف', 'العنوان', 'التوصيل', 'تاريخ الطلب', 'الحالة', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600 text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayStores.map(store => (
                  <StoreRow key={store.id} store={store}
                    onView={setSelectedStore} onToggle={handleToggle} toggling={toggling} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-200">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <StoreDetailModal store={selectedStore} onClose={() => setSelectedStore(null)}
        onToggle={handleToggle} toggling={toggling} />
    </div>
  )
}

export default AdminStores