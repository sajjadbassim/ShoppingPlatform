import { Clock, RefreshCw } from 'lucide-react'

// موعد توصيل طلب السوبرماركت (يُخزَّن UTC) — يُعرض بتوقيت بغداد وأرقام لاتينية مثل بقية الأسعار
const dayFormat = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', weekday: 'long', day: 'numeric', month: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', hour: 'numeric', minute: '2-digit' })

const asUtc = (value) => new Date(typeof value === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? `${value}Z` : value)

export const formatDeliverySlot = (start, end) => {
  if (!start) return ''
  const s = asUtc(start)
  return `${dayFormat.format(s)} ${timeFormat.format(s)}${end ? ` – ${timeFormat.format(asUtc(end))}` : ''}`
}

export const SUBSTITUTION_LABELS = {
  SIMILAR: 'استبدله بمنتج مشابه',
  REMOVE: 'احذفه وأعد المبلغ',
}

// شارة الموعد + تفضيل الاستبدال (لا تظهر لطلب بلا منتجات سوبرماركت)
const DeliverySlot = ({ start, end, substitution, compact = false, className = '' }) => {
  if (!start && !substitution) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {start && (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium ${compact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
          <Clock size={compact ? 11 : 13} /> موعد التوصيل: {formatDeliverySlot(start, end)}
        </span>
      )}
      {substitution && (
        <span className={`inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 ${compact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
          <RefreshCw size={compact ? 11 : 13} /> إن نفد منتج: {SUBSTITUTION_LABELS[substitution] || substitution}
        </span>
      )}
    </div>
  )
}

export default DeliverySlot
