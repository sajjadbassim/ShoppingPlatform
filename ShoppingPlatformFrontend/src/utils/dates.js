// صيغة موحّدة للتواريخ في كل الشاشات (كتطبيق الهاتف):
// «24 أكتوبر 2026» و«24 أكتوبر 2026، 3:45 م» — أرقام لاتينية وتوقيت بغداد
const LOCALE = 'ar-IQ-u-nu-latn'
const TIME_ZONE = 'Asia/Baghdad'

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }) : ''

export const formatClock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString(LOCALE, { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }) : ''

export const formatDateTime = (iso) => (iso ? `${formatDate(iso)}، ${formatClock(iso)}` : '')

export const formatMonthYear = (iso) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, month: 'long', year: 'numeric' }) : ''
