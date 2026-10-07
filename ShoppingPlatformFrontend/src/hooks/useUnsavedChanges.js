import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

// تنبيه قبل مغادرة صفحة فيها تغييرات غير محفوظة: التنقل داخل الموقع (روابط، زر الرجوع، رجوع المتصفح)
// عبر useBlocker، وإغلاق التبويب أو تحديثه عبر beforeunload.
// allowNext(): تجاوز التنبيه مرة واحدة (مثل الانتقال بعد الحفظ الناجح)
export const useUnsavedChanges = (dirty) => {
  const allow = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allow.current && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return { blocker, allowNext: () => { allow.current = true } }
}
