import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

// شريط رفيع أعلى الشاشة يظهر أثناء جلب البيانات أو حفظها، حتى لا يبدو التطبيق متجمداً مع الاستضافة البطيئة.
// يظهر فقط إن تجاوز الطلب 300ms حتى لا يومض مع الطلبات السريعة
const SHOW_DELAY = 300

const TopLoadingBar = () => {
  const busy = useIsFetching() + useIsMutating() > 0
  const [visible, setVisible] = useState(false)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    if (busy) {
      setFinishing(false)
      const t = setTimeout(() => setVisible(true), SHOW_DELAY)
      return () => clearTimeout(t)
    }
    if (!visible) return
    // إكمال الشريط ثم إخفاؤه بسلاسة
    setFinishing(true)
    const t = setTimeout(() => { setVisible(false); setFinishing(false) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy])

  if (!visible) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-[3px] overflow-hidden pointer-events-none" role="progressbar" aria-label="جاري التحميل">
      <div className={`h-full bg-gradient-to-l from-primary via-indigo-400 to-primary transition-all duration-300 ${
        finishing ? 'w-full opacity-0' : 'w-[85%] animate-loading-bar'}`} />
    </div>
  )
}

export default TopLoadingBar
