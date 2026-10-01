import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Share, PlusSquare, HelpCircle, MessageCircle, ChevronLeft, X } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'

/**
 * قسم نهاية الصفحة الرئيسية: تثبيت التطبيق + روابط المساعدة
 * (بديل قسم النشرة البريدية)
 */
const AppPromoSection = () => {
  const { installed, canPrompt, ios, promptInstall } = useInstallPrompt()
  const [showIosSteps, setShowIosSteps] = useState(false)

  const handleInstall = async () => {
    if (canPrompt) await promptInstall()
    else setShowIosSteps(true)
  }

  // يظهر زر التثبيت فقط حين يكون التثبيت ممكناً فعلاً
  const showInstall = !installed && (canPrompt || ios)

  return (
    <section className="py-6 md:py-12">
      <div className="container-main space-y-3 md:space-y-4 max-w-3xl">

        {showInstall && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#1e3a8a] via-[#1e40af] to-[#3730a3] text-white p-5 md:p-8">
            {/* لمسة ذهبية من ألوان الأيقونة */}
            <div className="absolute -left-10 -bottom-12 w-44 h-44 rounded-full bg-amber-400/20 blur-2xl" />

            <div className="relative flex items-center gap-4">
              <img src="/pwa-192x192.png" alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-2xl font-bold text-white">ثبّت تطبيق واسط</h2>
                <p className="text-sm text-white/80 mt-1 leading-relaxed">
                  تسوّق أسرع وتابع طلباتك وإشعاراتك مباشرة من شاشتك الرئيسية
                </p>
              </div>
            </div>

            <button onClick={handleInstall}
              className="relative mt-4 w-full md:w-auto md:px-8 h-12 rounded-full bg-white text-[#1e3a8a] font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition">
              <Download size={18} />
              تثبيت التطبيق
            </button>

            {/* خطوات iPhone — التثبيت فيه يدوي */}
            {showIosSteps && (
              <div className="relative mt-4 bg-white/10 rounded-2xl p-4 text-sm">
                <button onClick={() => setShowIosSteps(false)} className="absolute top-3 left-3 text-white/70" aria-label="إغلاق">
                  <X size={16} />
                </button>
                <p className="font-bold mb-2 text-white">للتثبيت على iPhone:</p>
                <ol className="space-y-2 text-white/90">
                  <li className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
                    اضغط زر المشاركة <Share size={16} className="inline" /> في أسفل Safari
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
                    اختر «إضافة إلى الشاشة الرئيسية» <PlusSquare size={16} className="inline" />
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* المساعدة */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3">تحتاج مساعدة؟</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/help" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 active:bg-gray-100 text-gray-900">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <HelpCircle size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">مركز المساعدة</span>
                <span className="block text-xs text-gray-500 truncate">الأسئلة الشائعة</span>
              </span>
              <ChevronLeft size={16} className="text-gray-300 hidden sm:block" />
            </Link>
            <Link to="/contact" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 active:bg-gray-100 text-gray-900">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <MessageCircle size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">تواصل معنا</span>
                <span className="block text-xs text-gray-500 truncate">فريق الدعم</span>
              </span>
              <ChevronLeft size={16} className="text-gray-300 hidden sm:block" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AppPromoSection
