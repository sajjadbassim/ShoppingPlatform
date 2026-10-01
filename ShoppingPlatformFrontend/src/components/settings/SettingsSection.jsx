import { Save, Sun, Moon, Palette } from 'lucide-react'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { useThemePreference } from '../../hooks/usePreferences'

// ملاحظة: هذه المكونات معرّفة على مستوى الملف عمداً — تعريفها داخل الصفحة
// يجعل React يعيد إنشاءها مع كل تغيير في الحالة فتفقد الحقول التركيز

export const SettingsSection = ({ icon: Icon, title, onSave, saving, saveDisabled, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-bold text-gray-900 flex items-center gap-2">
        <Icon size={18} className="text-primary" />{title}
      </h2>
      {onSave && (
        <Button variant="primary" size="sm" onClick={onSave} loading={saving} disabled={saveDisabled}>
          <Save size={14} className="ml-1" />حفظ
        </Button>
      )}
    </div>
    {children}
  </div>
)

export const SettingsToggle = ({ label, desc, checked, onChange, disabled }) => (
  <label className={`flex items-center justify-between py-3 border-b border-gray-100 last:border-0 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <div>
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
    </div>
    <input type="checkbox" checked={!!checked} disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 accent-primary" />
  </label>
)

export const ThemePicker = ({ value, onChange, disabled }) => (
  <div className="flex gap-3">
    {[
      { value: 'light', label: 'فاتح', icon: Sun  },
      { value: 'dark',  label: 'داكن', icon: Moon },
    ].map(({ value: v, label, icon: Icon }) => (
      <button key={v} type="button" disabled={disabled}
        onClick={() => onChange(v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-colors ${
          value === v
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        }`}>
        <Icon size={15} />{label}
      </button>
    ))}
  </div>
)

// قسم المظهر للوحات التحكم — التغيير يُطبَّق ويُحفظ فوراً دون زر حفظ
export const AppearanceSection = () => {
  const { success, error: showError } = useToast()
  const { theme, changeTheme, isSaving } = useThemePreference()

  const handleChange = async (value) => {
    if (value === theme) return
    try {
      await changeTheme(value)
      success(value === 'dark' ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح')
    } catch (err) {
      showError(err.message || 'تعذّر حفظ المظهر')
    }
  }

  return (
    <SettingsSection icon={Palette} title="المظهر">
      <p className="text-sm text-gray-500 mb-3">اختر مظهر الواجهة، ويُحفظ اختيارك في حسابك على جميع أجهزتك.</p>
      <ThemePicker value={theme} onChange={handleChange} disabled={isSaving} />
    </SettingsSection>
  )
}
