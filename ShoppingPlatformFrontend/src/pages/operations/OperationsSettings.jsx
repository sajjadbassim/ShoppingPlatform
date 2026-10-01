// src/pages/operations/OperationsSettings.jsx
import { Shield } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { SettingsSection, AppearanceSection } from '../../components/settings/SettingsSection'
import DeliveryFeePolicy from '../../components/settings/DeliveryFeePolicy'
import ConfirmationTimeoutSetting from '../../components/settings/ConfirmationTimeoutSetting'
import DeliverySpeedThresholds from '../../components/settings/DeliverySpeedThresholds'

const OperationsSettings = () => {
  const { user } = useAuthStore()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1">إعدادات لوحة التشغيل</p>
      </div>

      {/* معلومات الحساب */}
      <SettingsSection icon={Shield} title="معلومات الحساب">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'الاسم الكامل',      value: user?.fullName || '—' },
            { label: 'رقم الهاتف',        value: user?.phone    || '—', dir: 'ltr' },
            { label: 'البريد الإلكتروني', value: user?.email    || '—' },
            { label: 'الدور',             value: 'فريق العمليات' },
          ].map(({ label, value, dir }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-medium text-gray-900 text-sm" dir={dir}>{value}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      <ConfirmationTimeoutSetting />

      <DeliverySpeedThresholds />

      <DeliveryFeePolicy />

      {/* المظهر */}
      <AppearanceSection />
    </div>
  )
}

export default OperationsSettings
