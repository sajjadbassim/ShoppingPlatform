import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { goBack, isRootPath } from '../../utils/backNavigation'

// زر الرجوع في الشريط العلوي — يظهر في كل الصفحات عدا الصفحة الأم لكل قسم.
// تظليل المرور بالماوس فقط: على اللمس يبقى hover «عالقاً» بعد النقر، والزر لا يختفي عند تغيّر الصفحة فيبدو مضغوطاً
const BackButton = ({ className = '' }) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (isRootPath(pathname)) return null

  return (
    <button
      type="button"
      onClick={() => goBack(navigate, pathname)}
      aria-label="رجوع"
      title="رجوع"
      className={`w-10 h-10 rounded-full [@media(hover:hover)]:hover:bg-gray-100 active:bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0 transition-colors ${className}`}
    >
      <ArrowRight size={22} />
    </button>
  )
}

export default BackButton
