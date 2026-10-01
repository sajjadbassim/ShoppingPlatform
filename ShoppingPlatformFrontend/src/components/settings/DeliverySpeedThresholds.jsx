// حدود ألوان سرعة التوصيل — الأدمن يعدّلها، والعمليات تراها
import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { SettingsSection } from './SettingsSection'
import { useToast } from '../common/Toast'
import { useOrderSettings, useSetDeliveryThresholds } from '../../hooks/useOrderSettings'

const NumberBox = ({ value, onChange }) => (
  <input type="number" min={5} max={1440} value={Number.isNaN(value) ? '' : value}
    onChange={e => onChange(parseInt(e.target.value, 10))}
    className="w-20 h-10 px-2 border border-gray-300 rounded-lg text-sm text-center" />
)

const DeliverySpeedThresholds = ({ editable = false }) => {
  const { success, error } = useToast()
  const { data, isLoading } = useOrderSettings()
  const { mutateAsync: save, isPending } = useSetDeliveryThresholds()
  const fast = data?.deliveryFastMinutes ?? 45
  const slow = data?.deliverySlowMinutes ?? 90
  const [f, setF] = useState(fast)
  const [s, setS] = useState(slow)

  useEffect(() => { setF(fast); setS(slow) }, [fast, slow])

  const valid = Number.isInteger(f) && Number.isInteger(s) && f >= 5 && s <= 1440 && s > f
  const changed = f !== fast || s !== slow

  const submit = async () => {
    try { await save({ fastMinutes: f, slowMinutes: s }); success('تم حفظ حدود سرعة التوصيل') }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  const legend = (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-lg bg-green-50 text-green-800 p-2"><b className="block">سريع</b>حتى {editable ? f : fast} د</div>
      <div className="rounded-lg bg-amber-50 text-amber-800 p-2"><b className="block">متوسط</b>بين الحدّين</div>
      <div className="rounded-lg bg-red-50 text-red-700 p-2"><b className="block">بطيء</b>{editable ? s : slow} د فأكثر</div>
    </div>
  )

  return (
    <SettingsSection icon={Timer} title="سرعة التوصيل">
      <p className="text-sm text-gray-500 mb-3">
        المدة من إنشاء الطلب حتى وصوله للزبون. تحدد لون المدة في قوائم الطلبات والتقارير.
      </p>
      {!editable ? (
        isLoading ? <div className="h-14 rounded-lg bg-gray-100 animate-pulse" /> : <>{legend}<p className="text-xs text-gray-400 mt-2">يغيّرها مدير النظام.</p></>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-700">
            <span className="flex items-center gap-2">سريع حتى <NumberBox value={f} onChange={setF} /> دقيقة</span>
            <span className="flex items-center gap-2">بطيء من <NumberBox value={s} onChange={setS} /> دقيقة</span>
          </div>
          {legend}
          {!valid && <p className="text-xs text-red-600">حد «سريع» يجب أن يكون أقل من حد «بطيء» (بين 5 و1440 دقيقة)</p>}
          <div className="flex justify-end">
            <button type="button" onClick={submit} disabled={!valid || !changed || isPending}
              className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
              {isPending ? '...' : 'حفظ'}
            </button>
          </div>
        </div>
      )}
    </SettingsSection>
  )
}

export default DeliverySpeedThresholds
