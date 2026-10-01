import { useEffect, useState } from 'react'

// مؤشر تحميل الصفحة أثناء تنزيل ملفها — مع رسالة طمأنة إن طال الانتظار (استضافة أو اتصال بطيء)
export const PageLoader = ({ fullScreen = false }) => {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div role="status" aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${fullScreen ? 'min-h-[100dvh]' : 'min-h-[60vh]'}`}>
      <div className="relative w-14 h-14">
        <span className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      <p className="text-sm text-gray-500">{slow ? 'الاتصال بطيء قليلاً، ما زلنا نحمّل الصفحة...' : 'جاري التحميل...'}</p>
    </div>
  )
}

export default PageLoader
