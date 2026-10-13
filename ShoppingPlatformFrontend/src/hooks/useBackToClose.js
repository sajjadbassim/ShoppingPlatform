// زر الرجوع (الهاتف/المتصفح) يغلق النافذة المفتوحة بدل مغادرة الصفحة — نفس فكرة TikTokFeedViewer.
// عند الفتح نضيف خطوة في السجل بنفس الرابط؛ الرجوع يزيلها فنغلق النافذة.
// الإغلاق بزر النافذة يزيل الخطوة بنفسه (history.back) حتى لا يحتاج العميل رجوعاً إضافياً.
// - إن غيّر الراوتر الرابط والنافذة مفتوحة (فلتر بـ replace) نعيد إضافة الخطوة للرابط الجديد
// - إن انتقل العميل لصفحة أخرى من داخل النافذة فخطوتنا لم تعد الحالية، فلا نرجع
// - الإزالة مؤجلة لحظة: StrictMode يشغّل التنظيف ثم يعيد التشغيل فوراً، فيلغي الإزالة
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const KEY = '__overlay'

export const useBackToClose = (isOpen, onClose) => {
  const { key: locationKey } = useLocation()
  const idRef = useRef(null)
  const backTimer = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    if (backTimer.current) { clearTimeout(backTimer.current); backTimer.current = null }

    if (!(idRef.current && window.history.state?.[KEY] === idRef.current)) {
      idRef.current = Math.random().toString(36).slice(2)
      window.history.pushState({ ...window.history.state, [KEY]: idRef.current }, '')
    }

    const onPop = () => {
      if (window.history.state?.[KEY] === idRef.current) return   // تقدّم للأمام إلى خطوتنا
      idRef.current = null
      onCloseRef.current?.()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      const id = idRef.current
      if (!id) return
      backTimer.current = setTimeout(() => {
        backTimer.current = null
        if (window.history.state?.[KEY] === id) window.history.back()
        if (idRef.current === id) idRef.current = null
      }, 0)
    }
  }, [isOpen, locationKey])
}

export default useBackToClose
