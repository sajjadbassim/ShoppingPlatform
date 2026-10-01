// إعداد مهلة تأكيد المتجر للطلب الجديد — الأدمن يعدّلها، والعمليات تراها فقط
import { useEffect, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { SettingsSection } from './SettingsSection'
import { useToast } from '../common/Toast'
import { useOrderSettings, useSetConfirmationTimeout } from '../../hooks/useOrderSettings'

const PRESETS = [5, 10, 15, 30, 60]

const ConfirmationTimeoutSetting = ({ editable = false }) => {
  const { success, error } = useToast()
  const { data, isLoading } = useOrderSettings()
  const { mutateAsync: save, isPending } = useSetConfirmationTimeout()
  const current = data?.confirmationTimeoutMinutes ?? 5
  const [value, setValue] = useState(current)

  useEffect(() => { setValue(current) }, [current])

  const valid = Number.isInteger(value) && value >= 1 && value <= 240
  const submit = async () => {
    try { await save(value); success('تم حفظ مهلة التأكيد — تُطبَّق على الطلبات الجديدة') }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  return (
    <SettingsSection icon={AlarmClock} title="مهلة تأكيد المتجر للطلب">
      {!editable ? (
        <p className="text-sm text-gray-600">المهلة الحالية: <b className="text-gray-900">{isLoading ? '…' : `${current} دقيقة`}</b> — يغيّرها مدير النظام.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">الوقت المسموح للمتجر ليؤكد الطلب الجديد. بعده يظهر الطلب كتحذير في الشاشة الرئيسية للعمليات والإدارة.</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(m => (
              <button key={m} type="button" onClick={() => setValue(m)}
                className={`h-9 px-4 rounded-full text-sm font-bold border ${value === m ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-700'}`}>
                {m} د
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={240} value={Number.isNaN(value) ? '' : value}
              onChange={e => setValue(parseInt(e.target.value, 10))}
              className="w-24 h-10 px-3 border border-gray-300 rounded-lg text-sm text-center" />
            <span className="text-sm text-gray-600">دقيقة (1–240)</span>
            <button type="button" onClick={submit} disabled={!valid || value === current || isPending}
              className="mr-auto h-10 px-5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
              {isPending ? '...' : 'حفظ'}
            </button>
          </div>
          <p className="text-xs text-gray-400">الطلبات الحالية تحتفظ بمهلتها؛ التغيير يُطبَّق على الطلبات الجديدة.</p>
        </div>
      )}
    </SettingsSection>
  )
}

export default ConfirmationTimeoutSetting
