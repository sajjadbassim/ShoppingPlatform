import { useState } from 'react'
import GoogleLinkRow from '../../components/auth/GoogleLinkRow'
import { PushDeviceRow } from '../../components/common/PushPrompt'
import { Link, useNavigate } from 'react-router-dom'
import {
  User, MapPin, Lock, Bell, Download, Share2, RefreshCw, Globe, Moon, HelpCircle, MessageCircle,
  RotateCcw, Truck, FileText, Shield, Info, LogOut, ChevronLeft, CheckCircle2, Star,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Toggle } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useMyPreferences, useUpdateMyPreferences, useThemePreference } from '../../hooks/usePreferences'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// ===========================
// عناصر القائمة (خارج الصفحة حتى لا يُعاد إنشاؤها مع كل تغيير)
// ===========================
const Group = ({ title, children }) => (
  <section>
    {title && <h2 className="px-1 mb-2 text-xs font-bold text-gray-500">{title}</h2>}
    <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {children}
    </div>
  </section>
)

const IconBox = ({ icon: Icon, color }) => (
  <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
    <Icon size={18} />
  </span>
)

// صف قابل للضغط (رابط أو زر)
const Row = ({ icon, color = 'bg-gray-100 text-gray-600', title, subtitle, to, onClick, trailing, danger }) => {
  const content = (
    <>
      <IconBox icon={icon} color={danger ? 'bg-red-50 text-red-500' : color} />
      <span className="flex-1 min-w-0 text-right">
        <span className={`block text-sm font-medium ${danger ? 'text-red-600' : 'text-gray-900'}`}>{title}</span>
        {subtitle && <span className="block text-xs text-gray-500 mt-0.5 truncate">{subtitle}</span>}
      </span>
      {trailing ?? (!danger && <ChevronLeft size={18} className="text-gray-300 flex-shrink-0" />)}
    </>
  )
  const className = 'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors'
  return to
    ? <Link to={to} className={className}>{content}</Link>
    : <button type="button" onClick={onClick} className={className}>{content}</button>
}

// صف بمفتاح تشغيل
const ToggleRow = ({ icon, color, title, subtitle, checked, onChange, disabled }) => (
  <label className={`flex items-center gap-3 px-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <IconBox icon={icon} color={color} />
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      {subtitle && <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>}
    </span>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </label>
)

// ===========================
// الصفحة
// ===========================
const SettingsPage = () => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { user, logout } = useAuthStore()
  const { data: prefs, isLoading: prefsLoading } = useMyPreferences()
  const { mutateAsync: updatePrefs, isPending: savingPrefs } = useUpdateMyPreferences()
  const { theme, changeTheme, isSaving: savingTheme } = useThemePreference()
  const { installed, canPrompt, ios, promptInstall } = useInstallPrompt()
  const [clearing, setClearing] = useState(false)

  // الحفظ فوري عند تبديل المفتاح — لا حاجة لزر "حفظ"
  const toggleOrderUpdates = async (e) => {
    const value = e.target.checked
    try {
      await updatePrefs({ notifyOrderUpdates: value })
      success(value ? 'سنُعلمك بكل تحديث على طلباتك' : 'تم إيقاف إشعارات الطلبات')
    } catch (err) {
      showError(err.message || 'تعذّر حفظ الإعداد')
    }
  }

  // المظهر يتغير فوراً ثم يُحفظ في الحساب
  const toggleDarkMode = async (e) => {
    const dark = e.target.checked
    try {
      await changeTheme(dark ? 'dark' : 'light')
    } catch (err) {
      showError(err.message || 'تعذّر حفظ المظهر')
    }
  }

  const handleInstall = async () => {
    if (canPrompt) {
      if (await promptInstall()) success('تم تثبيت التطبيق 🎉')
    } else if (ios) {
      success('من Safari: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»')
    }
  }

  const handleShare = async () => {
    const data = { title: 'منصة واسط التجارية', text: 'تسوّق من متاجر واسط المحلية بتوصيل سريع', url: window.location.origin }
    if (navigator.share) {
      try { await navigator.share(data) } catch { /* ألغى المستخدم */ }
    } else {
      await navigator.clipboard?.writeText(data.url)
      success('تم نسخ رابط التطبيق')
    }
  }

  // يحذف ملفات التطبيق المخزّنة ويعيد التحميل — يحل مشكلة ظهور نسخة قديمة
  const handleClearCache = async () => {
    setClearing(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
      success('تم مسح البيانات المؤقتة، جاري إعادة التحميل...')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      showError('تعذّر مسح البيانات المؤقتة')
      setClearing(false)
    }
  }

  const handleLogout = () => {
    if (!confirm('هل تريد تسجيل الخروج؟')) return
    logout()
    success('تم تسجيل الخروج بنجاح')
    navigate('/')
  }

  const installRow = installed
    ? <Row icon={Download} color="bg-green-50 text-green-600" title="التطبيق مثبّت على جهازك"
        trailing={<CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />} onClick={() => {}} />
    : (canPrompt || ios)
      ? <Row icon={Download} color="bg-primary/10 text-primary" title="تثبيت التطبيق" subtitle="وصول أسرع من الشاشة الرئيسية" onClick={handleInstall} />
      : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-4 lg:py-6">
        <Breadcrumb items={[{ label: 'حسابي', path: '/profile' }, { label: 'الإعدادات' }]} className="mb-6 hidden lg:block" />

        <div className="max-w-2xl mx-auto space-y-5">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">الإعدادات</h1>

          {/* بطاقة المستخدم */}
          <Link to="/profile"
            className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-l from-primary to-indigo-700 text-white shadow-sm">
            <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {user?.fullName?.charAt(0) || 'م'}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-lg truncate">{user?.fullName || 'المستخدم'}</span>
              <span className="block text-sm text-white/80 truncate text-right" dir="ltr">{user?.phone || user?.email}</span>
            </span>
            <span className="h-9 px-3 rounded-full bg-white/15 text-sm font-medium flex items-center gap-1 flex-shrink-0">
              تعديل <ChevronLeft size={15} />
            </span>
          </Link>

          <Group title="الحساب">
            <Row icon={User} color="bg-blue-50 text-blue-600" title="الملف الشخصي" subtitle="الاسم والبريد الإلكتروني" to="/profile" />
            <Row icon={MapPin} color="bg-emerald-50 text-emerald-600" title="عناوين التوصيل" subtitle="إضافة وتعديل عناوينك" to="/profile?tab=addresses" />
            <Row icon={Lock} color="bg-amber-50 text-amber-600" title="كلمة المرور والأمان" subtitle="تغيير كلمة المرور" to="/profile?tab=security" />
            <GoogleLinkRow />
            <Row icon={Star} color="bg-yellow-50 text-yellow-600" title="النقاط التشجيعية" subtitle="رصيدك ومستواك وسجل النقاط" to="/loyalty" />
          </Group>

          <Group title="الإشعارات">
            <PushDeviceRow />
            {prefsLoading ? (
              <div className="p-4"><Skeleton className="h-10 rounded-xl" /></div>
            ) : (
              <ToggleRow icon={Bell} color="bg-rose-50 text-rose-500"
                title="تحديثات الطلبات"
                subtitle="عند تأكيد طلبك وتحضيره وخروجه للتوصيل"
                checked={prefs?.notifyOrderUpdates ?? true}
                onChange={toggleOrderUpdates}
                disabled={savingPrefs} />
            )}
          </Group>

          <Group title="التطبيق">
            {installRow}
            <Row icon={Share2} color="bg-indigo-50 text-indigo-600" title="مشاركة التطبيق" subtitle="أرسل واسط لأصدقائك" onClick={handleShare} />
            <Row icon={RefreshCw} color="bg-gray-100 text-gray-600" title="مسح البيانات المؤقتة"
              subtitle="إذا ظهرت نسخة قديمة أو لم تتحدث الصفحات"
              onClick={handleClearCache}
              trailing={clearing ? <RefreshCw size={16} className="animate-spin text-gray-400" /> : undefined} />
          </Group>

          <Group title="اللغة والمظهر">
            <ToggleRow icon={Moon} color="bg-slate-100 text-slate-600" title="الوضع الداكن" subtitle="مظهر مريح للعين ليلاً"
              checked={theme === 'dark'} onChange={toggleDarkMode} disabled={savingTheme} />
            <div className="flex items-center gap-3 px-4 py-3">
              <IconBox icon={Globe} color="bg-sky-50 text-sky-600" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900">اللغة والعملة</span>
                <span className="block text-xs text-gray-500 mt-0.5">العربية • دينار عراقي</span>
              </span>
            </div>
          </Group>

          <Group title="المساعدة والمعلومات">
            <Row icon={HelpCircle} color="bg-violet-50 text-violet-600" title="مركز المساعدة" subtitle="الأسئلة الشائعة والأدلة" to="/help" />
            <Row icon={MessageCircle} color="bg-green-50 text-green-600" title="تواصل معنا" subtitle="فريق الدعم جاهز لمساعدتك" to="/contact" />
            <Row icon={RotateCcw} color="bg-orange-50 text-orange-600" title="سياسة الإرجاع" to="/return-policy" />
            <Row icon={Truck} color="bg-teal-50 text-teal-600" title="الشحن والتوصيل" to="/shipping" />
            <Row icon={FileText} color="bg-gray-100 text-gray-600" title="شروط الاستخدام" to="/terms" />
            <Row icon={Shield} color="bg-gray-100 text-gray-600" title="سياسة الخصوصية" to="/privacy" />
            <Row icon={Info} color="bg-gray-100 text-gray-600" title="من نحن" to="/about" />
          </Group>

          <Group>
            <Row icon={LogOut} title="تسجيل الخروج" onClick={handleLogout} danger />
          </Group>

          {/* معلومات التطبيق */}
          <div className="text-center py-2 space-y-1">
            <img src="/pwa-64x64.png" alt="" className="w-10 h-10 mx-auto rounded-xl" />
            <p className="text-sm font-bold text-gray-700">منصة واسط التجارية</p>
            <p className="text-xs text-gray-400">الإصدار {APP_VERSION}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
