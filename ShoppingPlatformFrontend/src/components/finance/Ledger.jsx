// مكوّنات مشتركة لصفحتي «المستحقات» و«أرباحي»: بطاقات الملخص وقائمة الحركات
import { TrendingUp, Percent, MinusCircle, Banknote, Wallet } from 'lucide-react'

export const money = (n) => `${Math.round(n || 0).toLocaleString()} د.ع`

export const commissionLabel = (c) => !c ? '—'
  : c.type === 'FIXED' ? `${Number(c.value).toLocaleString()} د.ع / طلب` : `${Number(c.value)}%`

export const SummaryCards = ({ s }) => {
  const cards = [
    { label: 'المبيعات', value: s.sales, icon: TrendingUp, tone: 'text-gray-900' },
    { label: 'عمولة المنصة', value: -s.commission, icon: Percent, tone: 'text-gray-700' },
    { label: 'خصومات ومرتجعات', value: -s.deductions, icon: MinusCircle, tone: 'text-gray-700' },
    { label: 'دفعات مُحوَّلة', value: -s.payouts, icon: Banknote, tone: 'text-gray-700' },
  ]
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-4 border ${s.balance >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
        <p className="text-sm text-gray-600 flex items-center gap-1.5"><Wallet size={16} /> {s.balance >= 0 ? 'الرصيد المستحق للمتجر' : 'على المتجر للمنصة'}</p>
        <p className={`text-3xl font-extrabold mt-1 ${s.balance >= 0 ? 'text-primary' : 'text-red-600'}`}>{money(Math.abs(s.balance))}</p>
        {s.lastPayoutAt && <p className="text-xs text-gray-500 mt-1">آخر دفعة: {new Date(s.lastPayoutAt).toLocaleDateString('ar-IQ')}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl bg-white border border-gray-200 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1"><c.icon size={13} />{c.label}</p>
            <p className={`text-base font-bold mt-0.5 ${c.tone}`} dir="ltr">{c.value < 0 ? '−' : ''}{money(Math.abs(c.value))}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const TONE = {
  SALE: 'text-green-700', RETURN_COMMISSION: 'text-green-700',
  PAYOUT: 'text-primary', ADJUSTMENT: 'text-amber-700',
}

export const LedgerList = ({ entries, orderLink }) => {
  if (!entries?.length) return <p className="text-center text-sm text-gray-500 py-8">لا توجد حركات بعد</p>
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {entries.map(e => (
        <div key={e.id} className="flex items-start gap-3 p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{e.typeAr}</p>
            <p className="text-xs text-gray-500 truncate">
              {e.orderId && orderLink ? <a href={orderLink(e)} className="hover:underline">{e.description}</a> : e.description}
              {e.reference ? ` · ${e.reference}` : ''}
            </p>
            <p className="text-[11px] text-gray-400">{new Date(e.createdAt).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <div className="text-left flex-shrink-0" dir="ltr">
            <p className={`text-sm font-bold ${e.amount >= 0 ? (TONE[e.type] || 'text-green-700') : (TONE[e.type] || 'text-red-600')}`}>
              {e.amount >= 0 ? '+' : '−'}{Math.round(Math.abs(e.amount)).toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400">{money(e.runningBalance)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
