import axios from 'axios'

// الجلسة: توكن دخول قصير (ساعة) + رمز تجديد (30 يوماً) يتبدّل مع كل تجديد.
// الخادم يرفض الرمز القديم بعد تدويره، لذلك التجديد يجب أن يحدث مرة واحدة فقط مهما فشلت طلبات معاً.

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5010'
const ACCESS_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'
export const SESSION_EVENT = 'session-updated'

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY)

// جلسة من ردّ الخادم: الدخول، التسجيل، Google، التجديد، تغيير كلمة المرور
export const saveSession = (data) => {
  if (data?.token) localStorage.setItem(ACCESS_KEY, data.token)
  if (data?.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
  // الجلسة كاملة لا التوكن فقط: الدور ومعرّف المتجر قد يتغيران (مثل اعتماد متجر الزبون)
  if (data?.token && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: data }))
}

export const clearSession = () => {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// إبطال رمز هذا الجهاز في الخادم — لا ننتظره ولا يُفشل الخروج
export const revokeSession = () => {
  const refreshToken = getRefreshToken()
  if (refreshToken)
    axios.post(`${API_BASE_URL}/api/Auth/logout`, { refreshToken }).catch(() => {})
}

// كم بقي من عمر التوكن (بالملي ثانية) — 0 إن تعذّرت قراءته
export const expiresInMs = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 - Date.now()
  } catch {
    return 0
  }
}

const doRefresh = async () => {
  const used = getRefreshToken()
  if (!used) throw new Error('no refresh token')
  try {
    const response = await axios.post(`${API_BASE_URL}/api/Auth/refresh-token`, { refreshToken: used })
    const data = response.data?.data
    saveSession(data)
    return data.token
  } catch (error) {
    // تبويب آخر جدّد بنفس الرمز قبلنا — الجلسة الجديدة صارت في localStorage المشترك
    const current = getRefreshToken()
    if (current && current !== used) return getAccessToken()
    throw error
  }
}

let inFlight = null

// تجديد واحد في نفس الوقت: كل الطلبات التي فشلت بـ 401 معاً تنتظر نفس النتيجة
export const refreshSession = () => {
  if (!inFlight) inFlight = doRefresh().finally(() => { inFlight = null })
  return inFlight
}

// توكن صالح لدقيقة على الأقل — لاتصالات SignalR التي لا تمر عبر axios
export const getFreshAccessToken = async () => {
  const token = getAccessToken()
  if (!token) return ''
  if (expiresInMs(token) > 60_000) return token
  try {
    return await refreshSession()
  } catch {
    return token
  }
}
