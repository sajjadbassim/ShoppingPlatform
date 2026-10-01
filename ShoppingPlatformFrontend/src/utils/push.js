// src/utils/push.js
// اشتراك هذا الجهاز في إشعارات الدفع (Web Push) وربطه بالحساب الحالي
import { apiGet, apiPost } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5010'

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// على الآيفون الإشعارات تعمل فقط للتطبيق المثبّت على الشاشة الرئيسية (iOS 16.4+)
export const needsInstallForPush = () => isIOS() && !isStandalone()

export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

const toKey = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

const registration = () => navigator.serviceWorker.ready

const sendToServer = (sub) => {
  const json = sub.toJSON()
  return apiPost(API_ENDPOINTS.PUSH.SUBSCRIBE, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
}

// يطلب الإذن (يجب أن يُستدعى من ضغطة زر) ثم يشترك ويربط الجهاز بالحساب
export const enablePush = async () => {
  if (!pushSupported()) throw new Error(needsInstallForPush()
    ? 'على الآيفون: أضف التطبيق للشاشة الرئيسية ثم افتحه من الأيقونة'
    : 'هذا المتصفح لا يدعم الإشعارات')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('لم يُسمح بالإشعارات — يمكنك تفعيلها من إعدادات المتصفح')

  const { data } = await apiGet(API_ENDPOINTS.PUSH.PUBLIC_KEY)
  const publicKey = data?.data?.publicKey
  if (!publicKey) throw new Error('الإشعارات غير مفعّلة على الخادم')

  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) })
  await sendToServer(sub)
  return true
}

// عند فتح التطبيق: إن كان الإذن ممنوحاً نربط الجهاز بالحساب الحالي (قد يكون تغيّر الحساب على نفس الجهاز)
export const syncPush = async () => {
  if (pushPermission() !== 'granted') return false
  try {
    const reg = await registration()
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const { data } = await apiGet(API_ENDPOINTS.PUSH.PUBLIC_KEY)
      const publicKey = data?.data?.publicKey
      if (!publicKey) return false
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) })
    }
    await sendToServer(sub)
    return true
  } catch {
    return false
  }
}

export const isPushActive = async () => {
  if (pushPermission() !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return !!(await reg?.pushManager.getSubscription())
  } catch {
    return false
  }
}

// عند تسجيل الخروج: نفصل الجهاز عن الحساب حتى لا تصل إشعاراته لمن يستخدم الجهاز بعده.
// التوكن يُمرَّر صراحةً لأن الخروج يحذفه فوراً
export const detachPush = async (token) => {
  if (!token || pushPermission() !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await fetch(`${API_BASE_URL}${API_ENDPOINTS.PUSH.UNSUBSCRIBE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true,
    })
  } catch { /* لا يمنع الخروج */ }
}
