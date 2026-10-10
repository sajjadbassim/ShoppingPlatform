// src/pages/customer/LoyaltyPage.jsx
import { useState } from 'react'
import {
  Star, Gift, TrendingUp, Clock, Award, Zap,
  ChevronRight, RefreshCw, Info,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import ReferralCard from '../../components/common/ReferralCard'

// ===========================
// Hooks
// ===========================

const useLoyaltyAccount = () => useQuery({
  queryKey: ['loyalty-account'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.LOYALTY.ACCOUNT)
    return r.data.data || r.data
  },
  staleTime: 2 * 60 * 1000,
})

const useLoyaltyTransactions = (params = {}) => useQuery({
  queryKey: ['loyalty-transactions', params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.LOYALTY.TRANSACTIONS, params)
    // يرجع { data: [...], pagination: {...} }
    return r.data
  },
  staleTime: 2 * 60 * 1000,
})

// ===========================
// Tier Badge
// ===========================

const TierBadge = ({ tier }) => {
  const config = {
    bronze:   { label: 'برونزي',  bg: 'bg-amber-100',   text: 'text-amber-700',  icon: '🥉' },
    silver:   { label: 'فضي',     bg: 'bg-gray-100',    text: 'text-gray-700',   icon: '🥈' },
    gold:     { label: 'ذهبي',    bg: 'bg-yellow-100',  text: 'text-yellow-700', icon: '🥇' },
    platinum: { label: 'بلاتيني', bg: 'bg-purple-100',  text: 'text-purple-700', icon: '💎' },
  }
  const c = config[tier?.toLowerCase()] || config.bronze
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  )
}

// ===========================
// Transaction Item
// ===========================

const TransactionItem = ({ tx }) => {
  const isEarn = tx.type === 'earned' || tx.type === 'bonus' || (tx.points ?? 0) > 0

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
          isEarn ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isEarn ? <TrendingUp size={16} className="text-green-600" /> : <Zap size={16} className="text-red-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {tx.descriptionAr || tx.description || tx.typeAr || tx.type}
          </p>
          {tx.orderNumber && (
            <p className="text-xs text-primary">طلب #{tx.orderNumber}</p>
          )}
          <p className="text-xs text-gray-400">
            {new Date(tx.createdAt || tx.date).toLocaleDateString('ar-IQ-u-nu-latn')}
          </p>
          {tx.expiresAt && (
            <p className="text-xs text-orange-500">
              تنتهي: {new Date(tx.expiresAt).toLocaleDateString('ar-IQ-u-nu-latn')}
            </p>
          )}
        </div>
      </div>
      <span className={`font-bold text-sm ${isEarn ? 'text-green-600' : 'text-red-500'}`}>
        {isEarn ? '+' : '-'}{Math.abs(tx.points ?? 0).toLocaleString('en-US')} نقطة
      </span>
    </div>
  )
}

// ===========================
// Main Page
// ===========================

const LoyaltyPage = () => {
  const { success, error: showError } = useToast()
  const [txPage, setTxPage] = useState(1)

  const { data: account, isLoading: accountLoading, isError: accountError, refetch } = useLoyaltyAccount()
  const { data: txData, isLoading: txLoading } = useLoyaltyTransactions({
    PageNumber: txPage,
    PageSize: 10,
  })

  // ✅ الـ API يرجع { data: [...], pagination: {...} }
  const transactions = Array.isArray(txData?.data) ? txData.data
    : Array.isArray(txData) ? txData : []
  const totalPages   = txData?.pagination?.totalPages ?? txData?.totalPages ?? 1

  // ✅ حقول الـ API الحقيقية
  const points        = account?.balance         ?? 0
  const totalEarned   = account?.totalEarned     ?? 0
  const totalRedeemed = account?.totalRedeemed   ?? 0
  const tier          = account?.tier            ?? 'Bronze'
  const tierAr        = account?.tierAr          ?? tier
  const nextTier      = account?.nextTier        ?? null
  const pointsToNext  = account?.nextTierPoints  ?? 0
  const pointValue    = account?.balanceValue > 0 && account?.balance > 0
    ? account.balanceValue / account.balance : 0.1
  const expiringPoints = account?.expiringPoints ?? 0
  const expiringDate   = account?.expiringDate   ?? null

  // نسبة التقدم من بداية المستوى الحالي إلى بداية التالي
  // (nextTierPoints = المتبقي للمستوى التالي، لذا حدّه = المكتسب + المتبقي)
  const { data: loyaltySettings } = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.SETTINGS)
      return r.data.data || r.data
    },
    staleTime: 10 * 60 * 1000,
  })
  const tierStart = {
    silver: loyaltySettings?.silverThreshold,
    gold:   loyaltySettings?.goldThreshold,
  }[tier?.toLowerCase()] ?? 0
  const nextThreshold = totalEarned + pointsToNext
  const progressPct = !nextTier ? 100
    : nextThreshold > tierStart
      ? Math.min(100, Math.max(0, ((totalEarned - tierStart) / (nextThreshold - tierStart)) * 100))
      : 0

  const breadcrumbItems = [
    { label: 'حسابي', path: '/profile' },
    { label: 'النقاط التشجيعية' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">النقاط التشجيعية</h1>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className="text-gray-400" />
          </button>
        </div>

        {accountLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          </div>
        ) : accountError ? (
          // فشل التحميل لا يُعرض كرصيد صفر — العميل قد يظن أن نقاطه ضاعت
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-medium">تعذّر تحميل رصيد نقاطك</p>
            <button onClick={() => refetch()} className="mt-3 px-5 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-medium">
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* بطاقة الرصيد الرئيسية */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-white/70 text-sm mb-1">رصيد النقاط</p>
                  <p className="text-5xl font-bold">{points.toLocaleString('en-US')}</p>
                  <p className="text-white/70 text-sm mt-1">
                    ≈ {(points * pointValue).toLocaleString('en-US')} د.ع
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <TierBadge tier={tier} />
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                    <Award size={14} />
                    <span className="text-xs">{tierAr}</span>
                  </div>
                </div>
              </div>

              {/* شريط التقدم */}
              {nextTier && (
                <div>
                  <div className="flex justify-between text-xs text-white/70 mb-1">
                    <span>المستوى الحالي: {tier}</span>
                    <span>التالي: {nextTier} ({pointsToNext.toLocaleString('en-US')} نقطة)</span>
                  </div>
                  <div className="bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* إحصائيات */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <TrendingUp size={20} className="mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-gray-900">{totalEarned.toLocaleString('en-US')}</p>
                <p className="text-xs text-gray-500">إجمالي المكتسبة</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <Gift size={20} className="mx-auto text-purple-500 mb-2" />
                <p className="text-xl font-bold text-gray-900">{totalRedeemed.toLocaleString('en-US')}</p>
                <p className="text-xs text-gray-500">إجمالي المستخدمة</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <Star size={20} className="mx-auto text-primary mb-2" />
                <p className="text-xl font-bold text-gray-900">{points.toLocaleString('en-US')}</p>
                <p className="text-xs text-gray-500">الرصيد الحالي</p>
              </div>
            </div>

            {/* تنبيه انتهاء الصلاحية */}
            {expiringPoints > 0 && expiringDate && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                <Clock size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-700">
                    {expiringPoints.toLocaleString('en-US')} نقطة ستنتهي قريباً
                  </p>
                  <p className="text-xs text-orange-600">
                    تاريخ الانتهاء: {new Date(expiringDate).toLocaleDateString('ar-IQ-u-nu-latn')}
                  </p>
                </div>
              </div>
            )}

            {/* ادعُ صديقاً */}
            <ReferralCard />

            {/* كيف تكسب نقاط */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Info size={18} className="text-primary" />
                كيف تكسب نقاط؟
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* طرق الكسب الحقيقية فقط — تظهر حسب إعدادات النظام */}
                {[
                  { icon: '🛍️', title: 'كل طلب', desc: 'اكسب نقاط على كل عملية شراء', show: true },
                  { icon: '⭐', title: 'كتابة تقييم', desc: 'قيّم منتجاتك واكسب نقاط إضافية', show: loyaltySettings?.reviewPoints > 0 },
                  { icon: '🎁', title: 'ادعُ صديقاً', desc: 'تكسب أنت وصديقك نقاطاً عند توصيل أول طلب له', show: loyaltySettings?.referralPoints > 0 },
                ].filter(item => item.show).map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl mb-1">{item.icon}</p>
                    <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* سجل المعاملات */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                سجل النقاط
              </h2>

              {txLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Star size={32} className="mx-auto mb-2 opacity-30" />
                  <p>لا توجد معاملات بعد</p>
                  <p className="text-xs mt-1">ابدأ التسوق لكسب النقاط التشجيعية</p>
                </div>
              ) : (
                <div>
                  {transactions.map((tx, i) => (
                    <TransactionItem key={tx.id || i} tx={tx} />
                  ))}

                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setTxPage(page)}
                          className={`w-8 h-8 rounded-lg text-sm ${
                            page === txPage
                              ? 'bg-primary text-white'
                              : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default LoyaltyPage