import { Clock } from 'lucide-react'

// شارة «المتجر مغلق» فوق صورة المنتج (أسفل اليمين) — موعد الفتح في التلميح.
// حالة المتجر من الخادم: vendorIsOpen / vendorOpenStatus (أوقات العمل أو إيقاف الطلبات)
export const StoreClosedBadge = ({ closed, status, className = '' }) => closed ? (
  <span title={status || 'المتجر مغلق الآن'}
    className={`absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-900/80 text-white text-[10px] sm:text-xs font-bold pointer-events-none ${className}`}>
    <Clock size={11} />المتجر مغلق
  </span>
) : null

export const isStoreClosed = (p) => p?.vendorIsOpen === false

export default StoreClosedBadge
