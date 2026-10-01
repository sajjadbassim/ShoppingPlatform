// تحذير الطلبات التي تجاوزت مهلة تأكيد المتجر — في الشاشة الرئيسية للعمليات والإدارة
import { Link } from 'react-router-dom'
import { AlarmClock, Phone, ChevronLeft } from 'lucide-react'
import { useOverdueConfirmations } from '../../hooks/useOrderSettings'

const MAX_ROWS = 5

const OverdueConfirmationsAlert = ({ orderLink, allLink }) => {
  const { data: overdue = [] } = useOverdueConfirmations()
  if (overdue.length === 0) return null

  return (
    <section className="rounded-2xl border-2 border-red-300 bg-red-50 overflow-hidden" role="alert">
      <div className="flex items-center gap-3 p-4">
        <span className="relative w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
          <AlarmClock size={22} />
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-red-800">
            {overdue.length === 1 ? 'طلب تجاوز مهلة التأكيد' : `${overdue.length} طلبات تجاوزت مهلة التأكيد`}
          </p>
          <p className="text-xs text-red-700 mt-0.5">المتجر لم يرد بعد — اتصل به أو ألغِ الطلب حتى لا ينتظر الزبون</p>
        </div>
        {allLink && (
          <Link to={allLink} className="h-9 px-3 rounded-full bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap">
            عرض الكل <ChevronLeft size={14} />
          </Link>
        )}
      </div>

      <div className="bg-white divide-y divide-red-100 border-t border-red-200">
        {overdue.slice(0, MAX_ROWS).map(o => (
          <div key={o.subOrderId} className="flex items-center gap-3 px-4 py-2.5">
            <Link to={orderLink(o)} className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{o.vendorName}</p>
              <p className="text-xs text-gray-500 truncate">
                <span dir="ltr">{o.orderNumber}</span>{o.customerName ? ` · ${o.customerName}` : ''} · {(o.total || 0).toLocaleString()} د.ع
              </p>
            </Link>
            <span className="text-xs font-bold text-red-700 bg-red-100 rounded-full px-2 py-1 whitespace-nowrap">
              متأخر {o.minutesOverdue >= 60 ? `${Math.floor(o.minutesOverdue / 60)} س ${o.minutesOverdue % 60} د` : `${o.minutesOverdue} د`}
            </span>
            {o.vendorPhone && (
              <a href={`tel:${o.vendorPhone}`} aria-label="اتصال بالمتجر"
                className="w-9 h-9 rounded-full border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0">
                <Phone size={16} />
              </a>
            )}
          </div>
        ))}
        {overdue.length > MAX_ROWS && (
          <p className="px-4 py-2 text-xs text-red-700">و{overdue.length - MAX_ROWS} طلبات أخرى…</p>
        )}
      </div>
    </section>
  )
}

export default OverdueConfirmationsAlert
