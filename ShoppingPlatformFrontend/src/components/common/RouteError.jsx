// شاشة الخطأ لمسارات الراوتر (errorElement) — بنفس تصميم ErrorBoundary.
// الراوتر يلتقط أخطاء الصفحات قبل ErrorBoundary، فبدونها تظهر شاشة React Router الإنجليزية للمطوّرين.
import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react'
import Button from './Button'

// ملف الصفحة لم يُحمَّل: نسخة جديدة نُشرت (الملف القديم حُذف) أو انقطع الإنترنت
const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i
    .test(String(error?.message || error))

const RELOAD_KEY = 'route-error-reloaded-at'

const RouteError = () => {
  const error = useRouteError()
  const chunk = isChunkLoadError(error)
  const [offline, setOffline] = useState(!navigator.onLine)

  // بعد نشر نسخة جديدة: تحديث تلقائي مرة واحدة يجلب الملفات الجديدة
  // (لا نكرّره خلال 30 ثانية حتى لا تدخل الصفحة في حلقة تحديث)
  useEffect(() => {
    if (!chunk || !navigator.onLine) return
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0 } catch { /* التخزين محجوب */ }
    if (Date.now() - last > 30000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* التخزين محجوب */ }
      window.location.reload()
    }
  }, [chunk])

  // عودة الاتصال: نحدّث الصفحة لتحميل ما فشل
  useEffect(() => {
    const goOnline = () => { setOffline(false); if (chunk) window.location.reload() }
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [chunk])

  const noConnection = chunk && offline
  const Icon = noConnection ? WifiOff : AlertTriangle

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
            <Icon className="w-12 h-12 text-yellow-600" />
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          {noConnection ? 'لا يوجد اتصال بالإنترنت' : chunk ? 'تحديث جديد للتطبيق' : 'حدث خطأ غير متوقع'}
        </h1>
        <p className="mt-4 text-gray-600 leading-relaxed">
          {noConnection
            ? 'تعذّر فتح هذه الصفحة. تحقق من الاتصال — ستُحدَّث الصفحة تلقائياً عند عودته.'
            : chunk
              ? 'صدرت نسخة جديدة من التطبيق. حدّث الصفحة للمتابعة.'
              : <>نعتذر عن هذا الخطأ. فريقنا التقني تم إبلاغه وسيعمل على إصلاحه.<br />يمكنك تحديث الصفحة أو العودة للصفحة الرئيسية.</>}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
            <RefreshCw className="w-5 h-5 ml-2" />
            تحديث الصفحة
          </Button>
          <Button variant="outline" size="lg" onClick={() => { window.location.href = '/' }}>
            <Home className="w-5 h-5 ml-2" />
            الصفحة الرئيسية
          </Button>
        </div>

        {/* تفاصيل الخطأ (للتطوير فقط) */}
        {import.meta.env.DEV && error && (
          <div className="mt-8 p-4 bg-red-50 rounded-lg text-right">
            <p className="text-sm font-medium text-red-800 mb-2">تفاصيل الخطأ (وضع التطوير):</p>
            <pre className="text-xs text-red-600 overflow-auto max-h-40 bg-red-100 p-2 rounded" dir="ltr">
              {String(error?.stack || error?.message || error)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteError
