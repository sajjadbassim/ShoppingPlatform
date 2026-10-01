// حالات الطلب: النص العربي والألوان وجمل الإشعارات (مطابقة لـ OrderStatusText في الخادم)

export const ORDER_STATUS_AR = {
  PENDING_CONFIRMATION: 'بانتظار التأكيد',
  PARTIALLY_CONFIRMED: 'مؤكد جزئياً',
  CONFIRMED: 'مؤكد',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز',
  OUT_FOR_DELIVERY: 'في الطريق',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغي',
  DELIVERY_FAILED: 'تعذّر التسليم',
}

// شارة الحالة في الإشعارات
export const ORDER_STATUS_CHIP = {
  PENDING_CONFIRMATION: 'bg-amber-100 text-amber-800',
  PARTIALLY_CONFIRMED: 'bg-cyan-100 text-cyan-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-indigo-100 text-indigo-800',
  READY: 'bg-violet-100 text-violet-800',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
  DELIVERY_FAILED: 'bg-orange-100 text-orange-800',
}

const CODES = Object.keys(ORDER_STATUS_AR)
const CODE_RE = new RegExp(`\\b(${CODES.join('|')})\\b`, 'g')
const byArabic = Object.fromEntries(Object.entries(ORDER_STATUS_AR).map(([k, v]) => [v, k]))
const toCode = (s) => {
  const v = (s || '').replace(/[«»"]/g, '').trim()
  return ORDER_STATUS_AR[v] ? v : byArabic[v] || null
}

// الرموز الإنجليزية داخل أي نص ← عربي
export const localizeStatusCodes = (text) =>
  typeof text === 'string' ? text.replace(CODE_RE, (code) => ORDER_STATUS_AR[code]) : text

// جملة للزبون: ماذا حدث لطلبه
export const customerStatusMessage = (status, n) => ({
  CONFIRMED: `تم تأكيد طلبك ${n} ✅ وسيبدأ تحضيره قريباً`,
  PARTIALLY_CONFIRMED: `تم تأكيد جزء من طلبك ${n} — بعض المنتجات غير متوفرة`,
  PREPARING: `طلبك ${n} قيد التحضير الآن 📦`,
  READY: `طلبك ${n} جاهز وبانتظار السائق`,
  OUT_FOR_DELIVERY: `طلبك ${n} في الطريق إليك 🛵`,
  DELIVERED: `تم توصيل طلبك ${n} 🎉 نتمنى أن ينال إعجابك`,
  CANCELLED: `تم إلغاء طلبك ${n}`,
  DELIVERY_FAILED: `تعذّر تسليم طلبك ${n} — سيتواصل معك فريقنا`,
}[status] || `تم تحديث طلبك ${n}: ${ORDER_STATUS_AR[status] || status}`)

// جملة للفريق (العمليات/الإدارة/التاجر)
export const staffStatusMessage = (status, n) => {
  const num = n ? ` ${n}` : ''
  return ({
    CONFIRMED: `تم تأكيد الطلب${num} من المتجر`,
    PARTIALLY_CONFIRMED: `تأكيد جزئي للطلب${num}: بعض المتاجر أكدت`,
    PREPARING: `بدأ تحضير الطلب${num}`,
    READY: `الطلب${num} جاهز ويحتاج سائقاً`,
    OUT_FOR_DELIVERY: `الطلب${num} خرج للتوصيل 🛵`,
    DELIVERED: `تم توصيل الطلب${num} ✅`,
    CANCELLED: `تم إلغاء الطلب${num}`,
    DELIVERY_FAILED: `تعذّر تسليم الطلب${num} ⚠️ يحتاج قراراً`,
  }[status] || `تحديث الطلب${num}: ${ORDER_STATUS_AR[status] || status}`)
}

/**
 * الإشعارات القديمة المحفوظة بصيغة "من X إلى Y" أو "أصبح في حالة: X" (بالرموز أو بالعربي)
 * تُعاد صياغتها بنفس الجمل الجديدة. تُرجع { message, status }.
 */
export const friendlyStatusNotification = (message, knownStatus) => {
  if (typeof message !== 'string') return { message, status: knownStatus || null }

  let m = message.match(/^طلبك\s+(\S+)\s+أصبح في حالة:\s*(.+)$/)
  if (m) {
    const status = toCode(m[2]) || knownStatus
    if (status) return { message: customerStatusMessage(status, m[1]), status }
  }
  m = message.match(/^(?:تم تحديث حالة الطلب|تغيرت حالة الطلب)\s*(\S*?)\s*من\s+(.+?)\s+إلى\s+(.+)$/)
  if (m) {
    const status = toCode(m[3]) || knownStatus
    if (status) return { message: staffStatusMessage(status, m[1]), status }
  }
  return { message: localizeStatusCodes(message), status: knownStatus || null }
}
