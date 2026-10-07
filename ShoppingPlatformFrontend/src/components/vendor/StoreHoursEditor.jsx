// أوقات عمل المتجر: محرر الجدول الأسبوعي للتاجر، وعرضه للزبون (مطابق لـ StoreHours في الخادم)
import { Clock } from 'lucide-react'

// 0 = الأحد كما في DayOfWeek؛ الأسبوع العراقي يبدأ بالسبت
export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]

export const defaultSchedule = () =>
  WEEK_ORDER.map(day => ({ day, closed: day === 5, open: '09:00', close: '22:00' }))

// جدول كامل للأيام السبعة (الأيام الناقصة مغلقة)
export const fullSchedule = (hours) => {
  if (!hours?.length) return defaultSchedule()
  return WEEK_ORDER.map(day => {
    const d = hours.find(h => h.day === day)
    return d ? { day, closed: !!d.closed, open: d.open || '09:00', close: d.close || '22:00' } : { day, closed: true, open: '09:00', close: '22:00' }
  })
}

export const scheduleToJson = (schedule) =>
  JSON.stringify(schedule.map(d => d.closed ? { day: d.day, closed: true } : { day: d.day, closed: false, open: d.open, close: d.close }))

// 21:30 ← 9:30 م
export const formatTime = (hhmm) => {
  const [h, m] = (hhmm || '').split(':').map(Number)
  if (!Number.isFinite(h)) return hhmm
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`
}

export const StoreHoursEditor = ({ schedule, onChange }) => {
  const update = (day, patch) => onChange(schedule.map(d => d.day === day ? { ...d, ...patch } : d))
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
      {schedule.map(d => (
        <div key={d.day} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <span className="w-20 text-sm font-medium text-gray-800">{DAY_NAMES[d.day]}</span>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={!d.closed} onChange={e => update(d.day, { closed: !e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary" />
            مفتوح
          </label>
          {!d.closed ? (
            <span className="inline-flex items-center gap-1.5 mr-auto text-sm" dir="ltr">
              <input type="time" value={d.open} onChange={e => update(d.day, { open: e.target.value })}
                className="h-9 px-2 border border-gray-300 rounded-lg" aria-label={`فتح ${DAY_NAMES[d.day]}`} />
              <span className="text-gray-400">—</span>
              <input type="time" value={d.close} onChange={e => update(d.day, { close: e.target.value })}
                className="h-9 px-2 border border-gray-300 rounded-lg" aria-label={`إغلاق ${DAY_NAMES[d.day]}`} />
            </span>
          ) : (
            <span className="mr-auto text-xs text-gray-400">مغلق طوال اليوم</span>
          )}
        </div>
      ))}
    </div>
  )
}

// للزبون: الجدول مع تمييز اليوم الحالي (بتوقيت بغداد)
export const StoreHoursList = ({ hours }) => {
  if (!hours?.length) return null
  const today = new Date(Date.now() + (3 * 60 + new Date().getTimezoneOffset()) * 60000).getDay()
  return (
    <div className="text-sm">
      <p className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><Clock size={15} className="text-primary" />أوقات العمل</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {fullSchedule(hours).map(d => (
          <div key={d.day} className={`flex justify-between ${d.day === today ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
            <span>{DAY_NAMES[d.day]}</span>
            <span>{d.closed ? 'مغلق' : d.open === d.close ? '24 ساعة' : `${formatTime(d.open)} – ${formatTime(d.close)}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const ClosedBadge = ({ store, className = '' }) => store?.isOpenNow === false ? (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-900/80 text-white text-xs font-bold ${className}`}>
    <Clock size={12} />مغلق الآن
  </span>
) : null
