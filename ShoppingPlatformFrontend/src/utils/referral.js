// ادعُ صديقاً: رابط الدعوة /register?ref=CODE — يُحفظ الرمز عند فتح أي صفحة بالرابط (30 يوماً)
// ليُرسل مع التسجيل العادي أو بـ Google حتى لو تنقّل الزائر قبل أن يسجّل
const KEY = 'referralCode'
const TTL = 30 * 24 * 60 * 60 * 1000
const VALID = /^[A-Za-z0-9]{4,16}$/

export const captureReferral = (search = window.location.search) => {
  try {
    const code = new URLSearchParams(search).get('ref')
    if (code && VALID.test(code)) localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }))
  } catch { /* التخزين غير متاح — يُكتب الرمز يدوياً */ }
}

export const getReferral = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    return saved && Date.now() - saved.at < TTL ? saved.code : ''
  } catch { return '' }
}

export const clearReferral = () => {
  try { localStorage.removeItem(KEY) } catch { /* لا شيء */ }
}

export const referralLink = (code) => `${window.location.origin}/register?ref=${encodeURIComponent(code)}`
