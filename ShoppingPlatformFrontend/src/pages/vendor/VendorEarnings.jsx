// src/pages/vendor/VendorEarnings.jsx
// «أرباحي»: رصيد المتجر عند المنصة وكشف حركاته
import { Download, Info } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { SummaryCards, LedgerList, commissionLabel } from '../../components/finance/Ledger'
import { useMyEarnings, downloadStatementCsv } from '../../hooks/useFinance'

const VendorEarnings = () => {
  const { data: st, isLoading, isError, error } = useMyEarnings()

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  if (isError) return <p className="text-center text-gray-500 py-12">{error?.message || 'تعذّر تحميل الأرباح'}</p>

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">أرباحي</h1>
          <p className="text-sm text-gray-500">عمولة المنصة على متجرك: <b>{commissionLabel(st.summary.commissionRule)}</b></p>
        </div>
        <button type="button" onClick={() => downloadStatementCsv(st.summary.vendorName, st.entries)}
          className="h-10 px-3 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 inline-flex items-center gap-1.5">
          <Download size={15} /> كشف حساب
        </button>
      </div>

      <SummaryCards s={st.summary} />

      <p className="text-xs text-gray-500 flex items-start gap-1.5 bg-gray-50 rounded-xl p-3">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        تُضاف قيمة طلبك عند تسليمه للزبون (دون القطع التي رفضها)، وتُخصم عمولة المنصة وكوبونات متجرك والمرتجعات المعتمدة. الدفعات تسجّلها الإدارة عند تحويل المبلغ لك.
      </p>

      <div>
        <h2 className="font-bold text-gray-900 mb-2">الحركات</h2>
        <LedgerList entries={st.entries} orderLink={(e) => `/vendor/orders`} />
      </div>
    </div>
  )
}

export default VendorEarnings
