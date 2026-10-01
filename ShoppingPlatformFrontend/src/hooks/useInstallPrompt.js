import { useEffect, useState } from 'react'

// حدث التثبيت (Android/Chrome) يصل مرة واحدة غالباً عند تحميل الصفحة،
// لذلك نلتقطه على مستوى الملف قبل أن تُعرض أي صفحة ونحتفظ به
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)

/**
 * حالة تثبيت التطبيق (PWA)
 * - installed: يعمل الآن كتطبيق مثبّت
 * - canPrompt: يمكن فتح نافذة التثبيت مباشرة (Android/Chrome)
 * - ios: iPhone/iPad — التثبيت يدوي من زر المشاركة
 */
export const useInstallPrompt = () => {
  const [, force] = useState(0)

  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    notify()
    return outcome === 'accepted'
  }

  return {
    installed: isStandalone(),
    canPrompt: !!deferredPrompt,
    ios: isIOS(),
    promptInstall,
  }
}
