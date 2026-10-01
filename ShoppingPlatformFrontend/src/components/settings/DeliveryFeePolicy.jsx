// إعداد: من يدفع أجرة التوصيل عندما يرفض الزبون الطلب عند الباب — للعمليات والإدارة
// سؤالان منفصلان: الرفض الكامل، ورفض بعض القطع
import { Truck } from 'lucide-react'
import { SettingsSection } from './SettingsSection'
import { useToast } from '../common/Toast'
import { useDeliverySettings, useUpdateDeliverySettings } from '../../hooks/useDriverApp'

const FULL_OPTIONS = [
  { value: 'CUSTOMER', title: 'الزبون يدفعها', desc: 'يدفع للسائق أجرة التوصيل فقط، ويعود الطلب للمتجر' },
  { value: 'VENDOR', title: 'المتجر يتحمّلها', desc: 'لا يدفع الزبون شيئاً، وتُسجَّل الأجرة على المتجر' },
  { value: 'NONE', title: 'المنصة تتحمّلها', desc: 'لا يدفع الزبون ولا المتجر شيئاً' },
]

const SHORT = { CUSTOMER: 'الزبون', VENDOR: 'المتجر', NONE: 'المنصة' }

const Option = ({ selected, title, desc, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-right transition-colors disabled:opacity-60 ${selected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-primary' : 'border-gray-300'}`}>
      {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
    </span>
    <span className="flex-1">
      <span className="block text-sm font-bold text-gray-900">{title}</span>
      <span className="block text-xs text-gray-500">{desc}</span>
    </span>
  </button>
)

const DeliveryFeePolicy = () => {
  const { success, error } = useToast()
  const { data, isLoading } = useDeliverySettings()
  const { mutateAsync: save, isPending } = useUpdateDeliverySettings()
  const full = data?.refusalFeePayer || 'CUSTOMER'
  const partialOnCustomer = !!data?.partialRefusalCustomerPays
  const busy = isLoading || isPending

  const update = async (patch, message) => {
    try { await save({ refusalFeePayer: full, partialRefusalCustomerPays: partialOnCustomer, ...patch }); success(message) }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  return (
    <SettingsSection icon={Truck} title="أجرة التوصيل عند الرفض">
      <p className="text-sm text-gray-500 mb-4">إذا رفض الزبون الطلب عند الباب، من يدفع أجرة التوصيل؟</p>

      <div className="space-y-5">
        {/* الرفض الكامل */}
        <div>
          <p className="text-sm font-bold text-gray-800 mb-2">عند رفض الطلب كاملاً</p>
          <div className="space-y-2">
            {FULL_OPTIONS.map(o => (
              <Option key={o.value} selected={full === o.value} title={o.title} desc={o.desc} disabled={busy}
                onClick={() => full !== o.value && update({ refusalFeePayer: o.value }, `الرفض الكامل: ${o.title}`)} />
            ))}
          </div>
        </div>

        {/* رفض بعض القطع */}
        <div>
          <p className="text-sm font-bold text-gray-800 mb-2">عند رفض بعض القطع واستلام الباقي</p>
          <div className="space-y-2">
            <Option selected={partialOnCustomer} disabled={busy}
              title="الزبون يدفعها"
              desc="يُخصم ثمن القطع المرفوضة فقط، وتبقى أجرة التوصيل ضمن المبلغ"
              onClick={() => !partialOnCustomer && update({ partialRefusalCustomerPays: true }, 'رفض بعض القطع: الزبون يدفع الأجرة')} />
            <Option selected={!partialOnCustomer} disabled={busy}
              title="مثل الرفض الكامل"
              desc={full === 'CUSTOMER'
                ? 'حالياً: الزبون يدفعها (حسب خيار الرفض الكامل)'
                : `حالياً: ${SHORT[full]} يتحمّلها، وتُخصم الأجرة من مبلغ الزبون`}
              onClick={() => partialOnCustomer && update({ partialRefusalCustomerPays: false }, 'رفض بعض القطع: مثل الرفض الكامل')} />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">يُطبَّق على عمليات الرفض الجديدة، ويُحفظ على كل طلب من تحمّل أجرته.</p>
    </SettingsSection>
  )
}

export default DeliveryFeePolicy
