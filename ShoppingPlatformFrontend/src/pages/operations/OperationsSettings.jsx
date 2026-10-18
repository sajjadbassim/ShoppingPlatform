// src/pages/operations/OperationsSettings.jsx
import { Shield, Bell } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { usePreferencesDraft } from '../../hooks/usePreferences'
import { SettingsSection, SettingsToggle, AppearanceSection } from '../../components/settings/SettingsSection'
import DeliveryFeePolicy from '../../components/settings/DeliveryFeePolicy'
import ConfirmationTimeoutSetting from '../../components/settings/ConfirmationTimeoutSetting'
import DeliverySpeedThresholds from '../../components/settings/DeliverySpeedThresholds'
import GrocerySlotsSetting from '../../components/settings/GrocerySlotsSetting'

// العمليات تستلم إشعارات محفوظة لهاتين الفئتين فقط (NotifyOpsAsync)
const NOTIFICATION_KEYS = ['notifyNewOrders', 'notifyReturns']

const OperationsSettings = () => {
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const { draft, set, save, isDirty, isLoading, isError, isSaving } = usePreferencesDraft()

  const saveNotifications = async () => {
    try {
      await save(NOTIFICATION_KEYS)
      success('تم حفظ إعدادات الإشعارات')
    } catch (err) {
      showError(err.message || 'فشل حفظ الإعدادات')
    }
  }

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

      {/* الإشعارات */}
      <SettingsSection icon={Bell} title="إعدادات الإشعارات"
        onSave={saveNotifications} saving={isSaving} saveDisabled={!isDirty(NOTIFICATION_KEYS)}>
        {isLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : isError || !draft ? (
          <p className="text-sm text-red-500">تعذّر تحميل الإعدادات من الخادم</p>
        ) : (
          <div>
            <SettingsToggle label="مشاكل الطلبات" desc="تعذّر التسليم، إلغاء الزبون، رفض المتجر، وتأخر تأكيد المتجر"
              checked={draft.notifyNewOrders} onChange={v => set('notifyNewOrders', v)} />
            <SettingsToggle label="الإرجاع" desc="طلب إرجاع جديد، إرجاع ينتظر سائقاً، تعذّر استلام مرتجع، ووصول القطع للمتجر"
              checked={draft.notifyReturns} onChange={v => set('notifyReturns', v)} />
          </div>
        )}
      </SettingsSection>

      {/* إعدادات التشغيل — يعدّلها فريق العمليات */}
      <ConfirmationTimeoutSetting editable />
      <DeliverySpeedThresholds editable />
      <GrocerySlotsSetting editable />

      <DeliveryFeePolicy readOnly />

      {/* المظهر */}
      <AppearanceSection />
    </div>
  )
}

export default OperationsSettings
