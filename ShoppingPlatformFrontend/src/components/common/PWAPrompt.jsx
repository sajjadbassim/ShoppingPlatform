import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff, X } from 'lucide-react'

// فحص وجود نسخة جديدة كل ساعة
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000

/**
 * PWA Prompt - إشعار بتوفر تحديث للتطبيق + مؤشر انقطاع الاتصال
 */
const PWAPrompt = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update()
      }, UPDATE_CHECK_INTERVAL)
    },
  })

  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-[var(--bottom-nav-h)] inset-x-0 z-[100] bg-warning text-white text-sm py-2 px-4 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>أنت غير متصل بالإنترنت - قد لا تكون بعض البيانات محدّثة</span>
        </div>
      )}

      {needRefresh && (
        <div className="fixed bottom-[calc(1rem+var(--bottom-nav-h))] right-4 left-4 sm:left-auto sm:w-96 z-[100] bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">يتوفر تحديث جديد</p>
              <p className="text-sm text-gray-600 mt-1">اضغط على تحديث لتحميل أحدث نسخة من التطبيق.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg"
                >
                  تحديث
                </button>
                <button
                  onClick={() => setNeedRefresh(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg"
                >
                  لاحقاً
                </button>
              </div>
            </div>
            <button onClick={() => setNeedRefresh(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default PWAPrompt
