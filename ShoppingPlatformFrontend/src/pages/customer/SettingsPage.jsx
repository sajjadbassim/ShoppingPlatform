import { Settings, Globe, Sun, Moon, Bell, Shield, CreditCard, HelpCircle, FileText, MessageCircle, ChevronLeft, Save, CheckCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Toggle } from '../../components/common/FormControls'
import Select from '../../components/common/Select'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useUIStore } from '../../stores/uiStore'
import { usePreferencesDraft } from '../../hooks/usePreferences'

// المكونات على مستوى الملف — تعريفها داخل الصفحة يعيد إنشاءها مع كل تغيير فتُغلق القوائم وتفقد الحقول التركيز
const SettingSection = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
      <Icon size={20} className="text-primary" />
      <h2 className="font-bold text-gray-900">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </div>
)

const SettingRow = ({ title, description, children }) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
    <div>
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
)

const LinkRow = ({ title, description, icon: Icon, href }) => (
  <a href={href} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-6 px-6 transition-colors">
    <div className="flex items-center gap-3">
      <Icon size={20} className="text-gray-400" />
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
    <ChevronLeft size={20} className="text-gray-400" />
  </a>
)

const PREFERENCE_KEYS = ['language', 'currency', 'theme', 'notifyOrderUpdates']

const SettingsPage = () => {
  const { success, error: showError } = useToast()
  const { setTheme, setLanguage } = useUIStore()
  const { draft, set, save, isDirty, isLoading, isError, isSaving } = usePreferencesDraft()

  const hasChanges = isDirty(PREFERENCE_KEYS)

  const handleSave = async () => {
    try {
      const saved = await save(PREFERENCE_KEYS)
      // تطبيق المظهر واللغة بعد نجاح الحفظ حتى تبقى الواجهة مطابقة لما في الخادم
      setTheme(saved.theme)
      setLanguage(saved.language)
      success('تم حفظ الإعدادات بنجاح')
    } catch (err) {
      showError(err.message || 'فشل حفظ الإعدادات')
    }
  }

  const breadcrumbItems = [{ label: 'حسابي', path: '/profile' }, { label: 'الإعدادات' }]

  const languages = [
    { value: 'ar', label: 'العربية' },
    { value: 'en', label: 'English' },
    { value: 'ku', label: 'کوردی' },
  ]

  const currencies = [
    { value: 'IQD', label: 'دينار عراقي (IQD)' },
    { value: 'USD', label: 'دولار أمريكي (USD)' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Settings size={24} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
                <p className="text-gray-500">إدارة تفضيلات حسابك</p>
              </div>
            </div>
            {hasChanges && (
              <Button variant="primary" onClick={handleSave} loading={isSaving}>
                <Save size={18} className="ml-1" />
                حفظ التغييرات
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : isError || !draft ? (
            <p className="text-center text-red-500 py-8">تعذّر تحميل الإعدادات من الخادم</p>
          ) : (
            <>
              {/* Language & Region */}
              <SettingSection title="اللغة والمنطقة" icon={Globe}>
                <SettingRow title="اللغة" description="اختر لغة العرض">
                  <Select
                    options={languages}
                    value={draft.language}
                    onChange={v => set('language', v)}
                    className="w-40"
                  />
                </SettingRow>
                <SettingRow title="العملة" description="العملة الافتراضية للأسعار">
                  <Select
                    options={currencies}
                    value={draft.currency}
                    onChange={v => set('currency', v)}
                    className="w-48"
                  />
                </SettingRow>
              </SettingSection>

              {/* Appearance */}
              <SettingSection title="المظهر" icon={Sun}>
                <SettingRow title="الوضع" description="اختر مظهر التطبيق">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => set('theme', 'light')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        draft.theme === 'light' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Sun size={18} />فاتح
                    </button>
                    <button
                      onClick={() => set('theme', 'dark')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                        draft.theme === 'dark' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Moon size={18} />داكن
                    </button>
                  </div>
                </SettingRow>
              </SettingSection>

              {/* Notifications */}
              <SettingSection title="الإشعارات" icon={Bell}>
                <SettingRow title="تحديثات الطلبات" description="إشعارات عند إنشاء طلبك أو تأكيده أو تغيير حالته">
                  <Toggle checked={draft.notifyOrderUpdates} onChange={(e) => set('notifyOrderUpdates', e.target.checked)} />
                </SettingRow>
              </SettingSection>
            </>
          )}

          {/* Payment Methods */}
          <SettingSection title="طرق الدفع" icon={CreditCard}>
            <LinkRow title="إدارة طرق الدفع" description="إضافة أو إزالة بطاقات الدفع" icon={CreditCard} href="/profile?tab=payment" />
          </SettingSection>

          {/* Help & Support */}
          <SettingSection title="المساعدة والدعم" icon={HelpCircle}>
            <LinkRow title="مركز المساعدة" description="الأسئلة الشائعة والأدلة" icon={HelpCircle} href="/help" />
            <LinkRow title="تواصل معنا" description="تحدث مع فريق الدعم" icon={MessageCircle} href="/contact" />
            <LinkRow title="شروط الاستخدام" description="الشروط والأحكام" icon={FileText} href="/terms" />
            <LinkRow title="سياسة الخصوصية" description="كيف نحمي بياناتك" icon={Shield} href="/privacy" />
          </SettingSection>

          {/* App Info */}
          <div className="text-center text-gray-500 text-sm py-4 space-y-1">
            <p className="font-medium">منصة واسط التجارية</p>
            <p>الإصدار 1.0.0</p>
            <p className="flex items-center justify-center gap-1">
              <CheckCircle size={14} className="text-green-500" />
              <span>جميع الخدمات تعمل بشكل طبيعي</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
