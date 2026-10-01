import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * إعادة التمرير لأعلى الصفحة عند الانتقال لصفحة جديدة
 * (زر الرجوع POP يُترك للمتصفح ليعيد الموضع السابق)
 */
const ScrollToTop = () => {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType !== 'POP') {
      // instant لتجاوز scroll-behavior: smooth المعرّف على html
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname, navigationType])

  return null
}

export default ScrollToTop
