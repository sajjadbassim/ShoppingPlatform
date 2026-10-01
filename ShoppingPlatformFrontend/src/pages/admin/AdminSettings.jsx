// src/pages/admin/AdminSettings.jsx
import { Bell, Shield, Info } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { usePreferencesDraft } from '../../hooks/usePreferences'
import {
  SettingsSection, SettingsToggle, AppearanceSection,
} from '../../components/settings/SettingsSection'
import DeliveryFeePolicy from '../../components/settings/DeliveryFeePolicy'
import ConfirmationTimeoutSetting from '../../components/settings/ConfirmationTimeoutSetting'
import DeliverySpeedThresholds from '../../components/settings/DeliverySpeedThresholds'

const ROLE_LABELS = {
  ADMIN: 'مدير النظام',
  VENDOR: 'بائع',
  OPS: 'فريق العمليات',
  CUSTOMER: 'زبون',
}

const NOTIFICATION_KEYS = [
  'notifyNewOrders', 'notifyReturns', 'notifyNewUsers', 'notifyLowStock', 'notifyNewVendors',
]

const AdminSettings = () => {
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const { draft, set, save, isDirty, isLoading, isError, isSaving } = usePreferencesDraft()

  const handleSave = (keys, message) => async () => {
    try {
      await save(keys)
      success(message)
    } catch (err) {
      showError(err.message || 'فشل حفظ الإعدادات')
    }
  }

  const loadingBlock = <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
  const errorBlock = <p className="text-sm text-red-500">تعذّر تحميل الإعدادات من الخادم</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1">إعدادات لوحة التحكم</p>
      </div>

      {/* معلومات الحساب */}
      <SettingsSection icon={Shield} title="معلومات الحساب">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'الاسم الكامل',      value: user?.fullName || '—' },
            { label: 'رقم الهاتف',        value: user?.phone    || '—', dir: 'ltr' },
            { label: 'البريد الإلكتروني', value: user?.email    || '—' },
            { label: 'الدور',             value: ROLE_LABELS[user?.role] || user?.role || '—' },
          ].map(({ label, value, dir }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-medium text-gray-900 text-sm" dir={dir}>{value}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* الإشعارات */}
      <SettingsSection icon={Bell} title="إعدادات الإشعارات"
        onSave={handleSave(NOTIFICATION_KEYS, 'تم حفظ إعدادات الإشعارات')}
        saving={isSaving} saveDisabled={!isDirty(NOTIFICATION_KEYS)}>
        {isLoading ? loadingBlock : isError || !draft ? errorBlock : (
          <div>
            <SettingsToggle label="طلبات جديدة" desc="إشعار عند وصول طلب جديد"
              checked={draft.notifyNewOrders} onChange={v => set('notifyNewOrders', v)} />
            <SettingsToggle label="طلبات الإرجاع" desc="إشعار عند تقديم طلب إرجاع جديد"
              checked={draft.notifyReturns} onChange={v => set('notifyReturns', v)} />
            <SettingsToggle label="مستخدمين جدد" desc="إشعار عند تسجيل مستخدم جديد"
              checked={draft.notifyNewUsers} onChange={v => set('notifyNewUsers', v)} />
            <SettingsToggle label="نقص المخزون" desc="إشعار عند انخفاض أو نفاد مخزون منتج"
              checked={draft.notifyLowStock} onChange={v => set('notifyLowStock', v)} />
            <SettingsToggle label="متاجر جديدة" desc="إشعار عند تسجيل متجر جديد يحتاج تفعيل"
              checked={draft.notifyNewVendors} onChange={v => set('notifyNewVendors', v)} />
          </div>
        )}
      </SettingsSection>

      {/* المظهر */}
      <AppearanceSection />

      {/* معلومات النظام */}
      <ConfirmationTimeoutSetting editable />

      <DeliverySpeedThresholds editable />

      <DeliveryFeePolicy />

      <SettingsSection icon={Info} title="معلومات النظام">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'إصدار النظام', value: 'v1.0.0' },
            { label: 'البيئة',       value: import.meta.env.MODE === 'production' ? 'إنتاج' : 'تطوير' },
            { label: 'API URL',      value: import.meta.env.VITE_API_URL || 'localhost', dir: 'ltr' },
          ].map(({ label, value, dir }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-medium text-gray-900 text-sm truncate" dir={dir}>{value}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}

export default AdminSettings
