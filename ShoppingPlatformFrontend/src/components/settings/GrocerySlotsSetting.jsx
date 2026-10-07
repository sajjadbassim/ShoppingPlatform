// مواعيد توصيل السوبرماركت — الأدمن يحدد ساعات التوصيل وطول الفترة، والزبون يختار فترة عند الدفع
import { useEffect, useState } from 'react'
import { ShoppingBasket } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SettingsSection } from './SettingsSection'
import { useToast } from '../common/Toast'
import { apiGet, apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data
const SLOT_LENGTHS = [60, 90, 120, 180, 240]
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 || h === 24 ? 'ص' : 'م'}`

const NumberSelect = ({ value, onChange, options, label }) => (
  <select value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label}
    className="h-10 px-2 border border-gray-300 rounded-lg text-sm bg-white">
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

const GrocerySlotsSetting = ({ editable = false }) => {
  const { success, error } = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['grocery-slot-settings'],
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.ORDER_SETTINGS.GROCERY_SLOTS)),
  })
  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (dto) => unwrap(await apiPut(API_ENDPOINTS.ORDER_SETTINGS.GROCERY_SLOTS, dto)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grocery-slot-settings'] })
      qc.invalidateQueries({ queryKey: ['delivery-slots'] })
    },
  })
  const [form, setForm] = useState(null)
  useEffect(() => { if (data) setForm(data) }, [data])

  if (isLoading || !form) return (
    <SettingsSection icon={ShoppingBasket} title="مواعيد توصيل السوبرماركت">
      <div className="h-14 rounded-lg bg-gray-100 animate-pulse" />
    </SettingsSection>
  )

  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const valid = form.endHour > form.startHour && form.slotMinutes <= (form.endHour - form.startHour) * 60
  const changed = JSON.stringify(form) !== JSON.stringify(data)
  const slotsPerDay = valid ? Math.floor(((form.endHour - form.startHour) * 60) / form.slotMinutes) : 0
  const hours = Array.from({ length: 25 }, (_, h) => ({ value: h, label: hourLabel(h) }))

  const submit = async () => {
    try { await save(form); success('تم حفظ مواعيد التوصيل') }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  const summary = form.enabled
    ? `من ${hourLabel(form.startHour)} حتى ${hourLabel(form.endHour)}، فترات ${form.slotMinutes} دقيقة (${slotsPerDay} يومياً)، لـ${form.days === 1 ? 'اليوم فقط' : `${form.days} أيام`}، وأول فترة بعد ${form.leadMinutes} دقيقة من الطلب`
    : 'معطّلة — طلبات السوبرماركت تُوصَّل في أقرب وقت بلا اختيار موعد'

  return (
    <SettingsSection icon={ShoppingBasket} title="مواعيد توصيل السوبرماركت">
      <p className="text-sm text-gray-500 mb-3">يختار الزبون فترة توصيل عند الدفع إن كانت في سلته منتجات سوبرماركت.</p>
      {!editable ? (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{summary}</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => set({ enabled: e.target.checked })} className="w-4 h-4 accent-primary" />
            اختيار موعد التوصيل مفعّل
          </label>
          {form.enabled && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-700">
              <span className="flex items-center gap-2">من <NumberSelect label="بداية التوصيل" value={form.startHour} onChange={v => set({ startHour: v })} options={hours.slice(0, 24)} /></span>
              <span className="flex items-center gap-2">حتى <NumberSelect label="نهاية التوصيل" value={form.endHour} onChange={v => set({ endHour: v })} options={hours.slice(1)} /></span>
              <span className="flex items-center gap-2">طول الفترة <NumberSelect label="طول الفترة" value={form.slotMinutes} onChange={v => set({ slotMinutes: v })}
                options={SLOT_LENGTHS.map(m => ({ value: m, label: m % 60 === 0 ? `${m / 60} ساعة` : `${m} دقيقة` }))} /></span>
              <span className="flex items-center gap-2">مهلة التحضير <NumberSelect label="مهلة التحضير" value={form.leadMinutes} onChange={v => set({ leadMinutes: v })}
                options={[0, 30, 60, 90, 120, 180].map(m => ({ value: m, label: m === 0 ? 'بلا مهلة' : `${m} دقيقة` }))} /></span>
              <span className="flex items-center gap-2">الأيام <NumberSelect label="عدد الأيام" value={form.days} onChange={v => set({ days: v })}
                options={[1, 2, 3, 4, 5, 6, 7].map(d => ({ value: d, label: d === 1 ? 'اليوم فقط' : `${d} أيام` }))} /></span>
            </div>
          )}
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">{summary}</p>
          {!valid && <p className="text-xs text-red-600">ساعة النهاية يجب أن تكون بعد البداية، وطول الفترة لا يتجاوز ساعات التوصيل</p>}
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

export default GrocerySlotsSetting
