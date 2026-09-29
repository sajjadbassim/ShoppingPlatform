// src/pages/admin/AdminLoyalty.jsx
import { useState, useEffect } from 'react'
import {
  Star, Settings, Users, TrendingUp, RefreshCw,
  Plus, Minus, Check, X, Save, Search,
} from 'lucide-react'
import { useSearchUsers } from '../../hooks/useAdmin'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

// ===========================
// Hooks
// ===========================

const useLoyaltySettings = () => useQuery({
  queryKey: ['loyalty-settings'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.LOYALTY.SETTINGS)
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data) => {
      const r = await apiPut(API_ENDPOINTS.LOYALTY.SETTINGS, data)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loyalty-settings'] }),
  })
}

const useAdjustPoints = () => useMutation({
  mutationFn: async (data) => {
    const r = await apiPost(API_ENDPOINTS.LOYALTY.ADMIN_ADJUST, data)
    return r.data.data || r.data
  },
})

const useAdminUserLoyalty = (userId) => useQuery({
  queryKey: ['loyalty-user', userId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.LOYALTY.ADMIN_USER(userId))
    return r.data.data || r.data
  },
  enabled: !!userId,
})

// ===========================
// Settings Tab
// ===========================

const SettingsTab = () => {
  const { success: showSuccess, error: showError } = useToast()
  const { data: settings, isLoading } = useLoyaltySettings()
  const { mutateAsync: updateSettings, isPending } = useUpdateSettings()

  const [form, setForm] = useState(null)

  // تعبئة الفورم عند تحميل البيانات
  if (settings && !form) {
    setForm({ ...settings })
  }

  const handleSave = async () => {
    if (!form) return
    try {
      await updateSettings(form)
      showSuccess('تم حفظ الإعدادات')
    } catch (err) {
      showError(err.message || 'فشل حفظ الإعدادات')
    }
  }

  const F = ({ label, hint, children }) => (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )

  const inputCls = "w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>

  if (!form) return null

  return (
    <div className="space-y-6">

      {/* الإعدادات الأساسية */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-4">الإعدادات الأساسية</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="نقاط لكل وحدة عملة" hint="مثال: 1 نقطة لكل 1000 دينار = 0.001">
            <input type="number" step="0.001" value={form.pointsPerCurrencyUnit ?? ''}
              onChange={e => setForm({...form, pointsPerCurrencyUnit: Number(e.target.value)})}
              className={inputCls} />
          </F>
          <F label="قيمة النقطة (دينار)" hint="مثال: 1 نقطة = 100 دينار">
            <input type="number" step="0.01" value={form.pointValue ?? ''}
              onChange={e => setForm({...form, pointValue: Number(e.target.value)})}
              className={inputCls} />
          </F>
          <F label="الحد الأدنى للاسترداد (نقطة)">
            <input type="number" value={form.minRedemptionPoints ?? ''}
              onChange={e => setForm({...form, minRedemptionPoints: Number(e.target.value)})}
              className={inputCls} />
          </F>
          <F label="أقصى نسبة استرداد من الطلب (%)">
            <input type="number" step="0.1" max="100" value={form.maxRedemptionPercentage ?? ''}
              onChange={e => setForm({...form, maxRedemptionPercentage: Number(e.target.value)})}
              className={inputCls} />
          </F>
          <F label="انتهاء صلاحية النقاط (يوم)" hint="0 = لا تنتهي">
            <input type="number" value={form.pointsExpiryDays ?? ''}
              onChange={e => setForm({...form, pointsExpiryDays: Number(e.target.value)})}
              className={inputCls} />
          </F>
          <F label="حالة النظام">
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={form.isActive ?? true}
                onChange={e => setForm({...form, isActive: e.target.checked})}
                className="w-4 h-4 accent-primary" />
              <span className="text-sm text-gray-700">نظام الولاء نشط</span>
            </label>
          </F>
        </div>
      </div>

      {/* إعدادات المستويات */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-4">حدود المستويات</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'silverThreshold',   multiplierKey: 'silverMultiplier',   label: '🥈 فضي',     color: 'border-gray-300' },
            { key: 'goldThreshold',     multiplierKey: 'goldMultiplier',     label: '🥇 ذهبي',    color: 'border-yellow-300' },
            { key: 'platinumThreshold', multiplierKey: 'platinumMultiplier', label: '💎 بلاتيني', color: 'border-purple-300' },
          ].map(tier => (
            <div key={tier.key} className={`border-2 ${tier.color} rounded-xl p-4 space-y-3`}>
              <p className="font-medium text-gray-800">{tier.label}</p>
              <F label="الحد (نقطة)">
                <input type="number" value={form[tier.key] ?? ''}
                  onChange={e => setForm({...form, [tier.key]: Number(e.target.value)})}
                  className={inputCls} />
              </F>
              <F label="مضاعف النقاط">
                <input type="number" step="0.1" value={form[tier.multiplierKey] ?? ''}
                  onChange={e => setForm({...form, [tier.multiplierKey]: Number(e.target.value)})}
                  className={inputCls} />
              </F>
            </div>
          ))}
        </div>
      </div>

      <Button variant="primary" onClick={handleSave} loading={isPending}>
        <Save size={16} className="ml-2" />
        حفظ الإعدادات
      </Button>
    </div>
  )
}

// ===========================
// Adjust Points Tab
// ===========================

// منتقي زبون بالبحث عن الاسم أو الهاتف أو البريد بدلاً من إدخال userId يدوياً
const UserPicker = ({ selected, onSelect }) => {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')

  // البحث يتم على الخادم، مع تأخير بسيط حتى لا يُرسل طلب مع كل حرف
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 300)
    return () => clearTimeout(t)
  }, [term])

  const { data, isFetching, isError } = useSearchUsers({ term: debouncedTerm, role: 'CUSTOMER', pageSize: 8 })

  const q = term.trim()
  const results = debouncedTerm ? (data?.data || []) : []
  const isSearching = q && (q !== debouncedTerm || isFetching)

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-white border border-primary/40 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{selected.fullName || 'مستخدم'}</p>
          <p className="text-xs text-gray-500 truncate" dir="ltr">{selected.phone || selected.email || '—'}</p>
        </div>
        <button type="button" onClick={() => onSelect(null)}
          className="p-1 text-gray-400 hover:text-red-500" title="تغيير المستخدم">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={term} onChange={e => setTerm(e.target.value)}
          className="w-full h-9 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="ابحث بالاسم أو رقم الهاتف أو البريد" />
      </div>
      {q && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
          {results.length === 0 ? (
            <p className={`text-sm text-center py-4 ${isError && !isSearching ? 'text-red-500' : 'text-gray-400'}`}>
              {isSearching ? 'جاري البحث...' : isError ? 'تعذّر البحث، تحقق من اتصال الخادم' : 'لا توجد نتائج'}
            </p>
          ) : results.map(u => (
            <button key={u.id} type="button"
              onClick={() => { onSelect(u); setTerm('') }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-gray-50">
              <span className="text-sm text-gray-800 truncate">{u.fullName || 'مستخدم'}</span>
              <span className="text-xs text-gray-500 flex-shrink-0" dir="ltr">{u.phone || u.email || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const AdjustPointsTab = () => {
  const { success: showSuccess, error: showError } = useToast()
  const { mutateAsync: adjustPoints, isPending } = useAdjustPoints()

  const [selectedUser, setSelectedUser] = useState(null)
  const [points, setPoints]       = useState('')
  const [reason, setReason]       = useState('')
  const [reasonAr, setReasonAr]   = useState('')

  const userId = selectedUser?.id || null
  const { data: userLoyalty, isLoading: lookupLoading, refetch: refetchLoyalty } = useAdminUserLoyalty(userId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) { showError('يرجى اختيار المستخدم'); return }
    if (!points || !reasonAr.trim()) {
      showError('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    try {
      await adjustPoints({
        userId,
        points: Number(points),
        reason: reason || reasonAr,
        reasonAr,
      })
      showSuccess('تم تعديل النقاط بنجاح')
      setPoints(''); setReason(''); setReasonAr('')
      refetchLoyalty()
    } catch (err) {
      showError(err.message || 'فشل تعديل النقاط')
    }
  }

  const inputCls = "w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* نموذج التعديل */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Star size={16} className="text-primary" />
          تعديل نقاط مستخدم
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">المستخدم *</label>
            <UserPicker selected={selectedUser} onSelect={setSelectedUser} />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">النقاط * <span className="text-gray-400">(سالب للخصم)</span></label>
            <input type="number" value={points} onChange={e => setPoints(e.target.value)}
              className={inputCls} placeholder="مثال: 500 أو -200" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">السبب (عربي) *</label>
            <input value={reasonAr} onChange={e => setReasonAr(e.target.value)}
              className={inputCls} placeholder="مكافأة على الشراء" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">السبب (إنجليزي)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              className={inputCls} dir="ltr" placeholder="Purchase bonus" />
          </div>
          <Button variant="primary" fullWidth type="submit" loading={isPending}>
            تطبيق التعديل
          </Button>
        </form>
      </div>

      {/* نقاط المستخدم المختار */}
      <div className="bg-gray-50 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={16} className="text-primary" />
          نقاط المستخدم
        </h3>

        {!userId && (
          <p className="text-sm text-gray-400 text-center py-10">اختر مستخدماً لعرض رصيد نقاطه</p>
        )}

        {userId && lookupLoading && <Skeleton className="h-32" />}

        {userLoyalty && (
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-gray-800">{userLoyalty.customerName || 'مستخدم'}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  userLoyalty.tier === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                  userLoyalty.tier === 'Gold'     ? 'bg-yellow-100 text-yellow-700' :
                  userLoyalty.tier === 'Silver'   ? 'bg-gray-100 text-gray-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {userLoyalty.tier === 'Platinum' ? '💎 بلاتيني' :
                   userLoyalty.tier === 'Gold'     ? '🥇 ذهبي' :
                   userLoyalty.tier === 'Silver'   ? '🥈 فضي' : '🥉 برونزي'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'الرصيد', value: (userLoyalty.balance ?? userLoyalty.points ?? 0).toLocaleString() },
                  { label: 'المكتسبة', value: (userLoyalty.totalEarned ?? 0).toLocaleString() },
                  { label: 'المستخدمة', value: (userLoyalty.totalRedeemed ?? 0).toLocaleString() },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2">
                    <p className="font-bold text-gray-900 text-lg">{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* آخر المعاملات */}
            {userLoyalty.recentTransactions?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                {userLoyalty.recentTransactions.slice(0,5).map((tx, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2">
                    <p className="text-xs text-gray-600">{tx.descriptionAr || tx.description || tx.type}</p>
                    <span className={`text-xs font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const AdminLoyalty = () => {
  const [activeTab, setActiveTab] = useState('settings')

  const tabs = [
    { key: 'settings', label: 'الإعدادات',    icon: Settings },
    { key: 'adjust',   label: 'تعديل النقاط', icon: Star     },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">نظام الولاء</h1>
        <p className="text-gray-500 mt-1">إدارة إعدادات نقاط الولاء وتعديل أرصدة المستخدمين</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'adjust'   && <AdjustPointsTab />}
        </div>
      </div>
    </div>
  )
}

export default AdminLoyalty