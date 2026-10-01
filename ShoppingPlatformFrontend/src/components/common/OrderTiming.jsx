// مدة وصول الطلب: شارة صغيرة للقوائم، وبطاقة تفصيلية بالمراحل للعمليات والإدارة، وسطر للزبون
import { Timer, TrendingUp } from 'lucide-react'
import { useOrderTiming } from '../../hooks/useOrderTiming'

export const fmtMinutes = (m) => {
  if (m == null) return '—'
  if (m < 1) return 'أقل من دقيقة'
  const total = Math.round(m)
  if (total < 60) return `${total} د`
  const h = Math.floor(total / 60), r = total % 60
  if (h >= 24) return `${Math.floor(h / 24)} يوم ${h % 24 ? `${h % 24} س` : ''}`.trim()
  return r ? `${h} س ${r} د` : `${h} س`
}

const SPEED = {
  fast: { label: 'سريع', chip: 'bg-green-100 text-green-800', bar: 'bg-green-500', text: 'text-green-700' },
  normal: { label: 'متوسط', chip: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', text: 'text-amber-700' },
  slow: { label: 'بطيء', chip: 'bg-red-100 text-red-700', bar: 'bg-red-500', text: 'text-red-700' },
}

// شارة القوائم: للمُسلَّم مدة ملوّنة، وللجاري «منذ X»
export const DurationChip = ({ timing, small }) => {
  if (!timing) return null
  const size = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  if (timing.totalMinutes != null) {
    const s = SPEED[timing.speed] || SPEED.normal
    return (
      <span className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap ${s.chip} ${size}`}
        title={timing.slowestStage ? `أطول مرحلة: ${timing.slowestStage}` : undefined}>
        <Timer size={small ? 10 : 12} />{fmtMinutes(timing.totalMinutes)}
      </span>
    )
  }
  if (timing.elapsedMinutes != null) {
    return <span className={`inline-flex items-center gap-1 rounded-full whitespace-nowrap bg-gray-100 text-gray-600 ${size}`}><Timer size={small ? 10 : 12} />منذ {fmtMinutes(timing.elapsedMinutes)}</span>
  }
  return null
}

// بطاقة العمليات/الإدارة: المدة الكلية + كل مرحلة كشريط، وأطول مرحلة مميزة
export const OrderTimingCard = ({ orderId, className = '' }) => {
  const { data: t, isLoading } = useOrderTiming(orderId)
  if (isLoading) return <div className={`h-28 rounded-2xl bg-gray-100 animate-pulse ${className}`} />
  if (!t || (t.totalMinutes == null && t.elapsedMinutes == null && t.stages.length === 0)) return null

  const s = SPEED[t.speed]
  const max = Math.max(1, ...t.stages.map(x => x.minutes))
  const slowest = t.stages.length > 1 ? t.stages.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null

  return (
    <div className={`rounded-2xl bg-white border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Timer size={18} className="text-primary" />
        <p className="font-bold text-gray-900 flex-1">
          {t.totalMinutes != null ? `وصل خلال ${fmtMinutes(t.totalMinutes)}` : t.elapsedMinutes != null ? `منذ الطلب: ${fmtMinutes(t.elapsedMinutes)}` : 'مراحل الطلب'}
        </p>
        {s && <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${s.chip}`}>{s.label}</span>}
      </div>

      {t.stages.length > 0 ? (
        <div className="space-y-2">
          {t.stages.map(st => {
            const isSlowest = slowest && st.key === slowest.key
            return (
              <div key={st.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className={isSlowest ? 'font-bold text-gray-900' : 'text-gray-600'}>{st.label}</span>
                  <span className={`font-bold ${isSlowest ? (s?.text || 'text-gray-900') : 'text-gray-700'}`}>{fmtMinutes(st.minutes)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 mt-1">
                  <div className={`h-full rounded-full ${isSlowest ? (s?.bar || 'bg-primary') : 'bg-gray-300'}`} style={{ width: `${Math.max(3, (st.minutes / max) * 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : <p className="text-xs text-gray-500">لم تكتمل أي مرحلة بعد</p>}

      {slowest && t.totalMinutes != null && (
        <p className="mt-3 text-xs text-gray-600 flex items-center gap-1">
          <TrendingUp size={13} className="text-gray-400" /> أطول مرحلة: <b>{slowest.label}</b>
        </p>
      )}
      {!t.pickupRecorded && t.stages.some(x => x.key === 'ride') && (
        <p className="mt-1 text-[11px] text-gray-400">لم يسجّل السائق وقت الاستلام من المتجر، فالمرحلة الأخيرة تشمل الاستلام والطريق.</p>
      )}
    </div>
  )
}

// سطر للزبون في صفحة طلبه
export const CustomerDeliveredIn = ({ orderId }) => {
  const { data: t } = useOrderTiming(orderId)
  if (t?.totalMinutes == null) return null
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-full px-3 py-1">
      <Timer size={15} /> وصل طلبك خلال {fmtMinutes(t.totalMinutes)}
    </p>
  )
}
