// src/pages/admin/AdminDeliveryZones.jsx
// مناطق التوصيل: سعر موحّد لكل منطقة، وتطبيقها على كل المتاجر أو متاجر محددة
import { useEffect, useMemo, useState } from 'react'
import { MapPinned, Plus, Pencil, Trash2, Search, Info } from 'lucide-react'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { Skeleton } from '../../components/common/Loading'
import { money } from '../../components/finance/Ledger'
import {
  useZonesAdmin, useSetZonesMode, useCreateZone, useUpdateZone, useDeleteZone,
} from '../../hooks/useDeliveryZones'

const inputCls = 'w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary'

const MODES = [
  { value: 'OFF',      label: 'إيقاف',          hint: 'كل متجر بسعر توصيله الثابت' },
  { value: 'ALL',      label: 'كل المتاجر',     hint: 'سعر المنطقة لكل المتاجر' },
  { value: 'SELECTED', label: 'متاجر محددة',    hint: 'سعر المنطقة للمتاجر المختارة فقط' },
]

// تطبيق المناطق: إيقاف / الكل / متاجر محددة
const ModeCard = ({ data }) => {
  const { success, error } = useToast()
  const { mutateAsync: save, isPending } = useSetZonesMode()
  const [mode, setMode] = useState(data.mode)
  const [selected, setSelected] = useState(() => new Set(data.vendors.filter(v => v.useDeliveryZones).map(v => v.id)))
  const [q, setQ] = useState('')

  useEffect(() => {
    setMode(data.mode)
    setSelected(new Set(data.vendors.filter(v => v.useDeliveryZones).map(v => v.id)))
  }, [data])

  const vendors = useMemo(() => data.vendors.filter(v => !q.trim() || v.name.includes(q.trim())), [data.vendors, q])
  const toggle = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const submit = async () => {
    if (mode === 'SELECTED' && selected.size === 0) { error('اختر متجراً واحداً على الأقل'); return }
    try {
      await save({ mode, vendorIds: mode === 'SELECTED' ? [...selected] : undefined })
      success('تم حفظ إعداد المناطق')
    } catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-4">
      <div>
        <h2 className="font-bold text-gray-900">تطبيق المناطق</h2>
        <p className="text-xs text-gray-500">على أي متاجر يُطبَّق سعر المنطقة بدل سعر توصيل المتجر الثابت</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {MODES.map(m => (
          <button key={m.value} type="button" onClick={() => setMode(m.value)}
            className={`text-right p-3 rounded-xl border-2 transition-colors ${mode === m.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <span className={`block font-bold text-sm ${mode === m.value ? 'text-primary' : 'text-gray-800'}`}>{m.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{m.hint}</span>
          </button>
        ))}
      </div>

      {mode === 'SELECTED' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">المتاجر المشمولة ({selected.size})</p>
            <div className="relative w-48">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث" className={inputCls + ' pr-9 h-9'} />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
            {vendors.map(v => (
              <label key={v.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} className="w-4 h-4 accent-primary" />
                <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                  {v.name} {!v.isActive && <span className="text-xs text-gray-400">(غير مفعّل)</span>}
                </span>
                <span className="text-xs text-gray-500">سعره الثابت {money(v.deliveryFee)}</span>
              </label>
            ))}
            {vendors.length === 0 && <p className="p-4 text-center text-sm text-gray-400">لا توجد متاجر</p>}
          </div>
        </div>
      )}

      <Button variant="primary" size="sm" loading={isPending} onClick={submit}>حفظ</Button>
    </div>
  )
}

const emptyForm = { name: '', fee: '', isActive: true, sortOrder: 0 }

const ZoneModal = ({ zone, open, onClose }) => {
  const { success, error } = useToast()
  const { mutateAsync: create, isPending: creating } = useCreateZone()
  const { mutateAsync: update, isPending: updating } = useUpdateZone()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (open) setForm(zone ? { name: zone.name, fee: zone.fee, isActive: zone.isActive, sortOrder: zone.sortOrder } : emptyForm)
  }, [open, zone])

  const submit = async (e) => {
    e.preventDefault()
    const body = { ...form, name: form.name.trim(), fee: Number(form.fee), sortOrder: Number(form.sortOrder) || 0 }
    if (!body.name) { error('اسم المنطقة مطلوب'); return }
    if (form.fee === '' || body.fee < 0) { error('أدخل سعر التوصيل'); return }
    try {
      if (zone) await update({ id: zone.id, ...body }); else await create(body)
      success(zone ? 'تم حفظ المنطقة' : 'تمت إضافة المنطقة')
      onClose()
    } catch (err) { error(err.message || 'تعذّر الحفظ') }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={zone ? 'تعديل المنطقة' : 'منطقة جديدة'} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنطقة</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100}
            placeholder="مثال: بغداد - الكرادة" className={inputCls} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">سعر التوصيل</label>
            <div className="relative">
              <input type="number" min={0} value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} className={inputCls + ' pl-12'} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">د.ع</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
            <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary" />
          مفعّلة (تظهر للزبائن)
        </label>
        <Button type="submit" variant="primary" fullWidth loading={creating || updating}>حفظ</Button>
      </form>
    </Modal>
  )
}

const AdminDeliveryZones = () => {
  const { success, error } = useToast()
  const { data, isLoading } = useZonesAdmin()
  const { mutateAsync: remove } = useDeleteZone()
  const { mutateAsync: update } = useUpdateZone()
  const [editing, setEditing] = useState(null)      // null | 'new' | zone

  const zones = data?.zones || []

  const onDelete = async (z) => {
    const note = z.addressCount ? `\n${z.addressCount} عنوان مرتبط بها سيصبح بلا منطقة (سعر المتجر الثابت).` : ''
    if (!confirm(`حذف منطقة «${z.name}»؟${note}`)) return
    try { await remove(z.id); success('تم حذف المنطقة') } catch (e) { error(e.message || 'تعذّر الحذف') }
  }

  const toggleActive = async (z) => {
    try { await update({ id: z.id, name: z.name, fee: z.fee, sortOrder: z.sortOrder, isActive: !z.isActive }) }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><MapPinned className="text-primary" /> مناطق التوصيل</h1>
        <p className="text-sm text-gray-500">سعر توصيل موحّد لكل منطقة يختارها الزبون في عنوانه</p>
      </div>

      {isLoading || !data ? <Skeleton className="h-40 rounded-2xl" /> : <ModeCard data={data} />}

      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900">المناطق ({zones.length})</h2>
            <p className="text-xs text-gray-500">الموقوفة لا تظهر للزبائن</p>
          </div>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing('new')}>منطقة جديدة</Button>
        </div>

        {isLoading ? <Skeleton className="h-32 rounded-xl" /> : zones.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">لا توجد مناطق بعد — أضف أول منطقة</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {zones.map(z => (
              <div key={z.id} className="flex items-center gap-3 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${z.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{z.name}</p>
                  <p className="text-xs text-gray-500">{money(z.fee)} · {z.addressCount} عنوان</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={z.isActive} onChange={() => toggleActive(z)} className="w-4 h-4 accent-primary" />
                  مفعّلة
                </label>
                <button onClick={() => setEditing(z)} aria-label="تعديل" className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center"><Pencil size={16} /></button>
                <button onClick={() => onDelete(z)} aria-label="حذف" className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 flex gap-2 text-sm text-blue-900">
        <Info size={18} className="flex-shrink-0 mt-0.5" />
        <ul className="space-y-1 list-disc pr-4">
          <li>العنوان بلا منطقة أو في منطقة موقوفة يُحسب بسعر توصيل المتجر الثابت.</li>
          <li>كل متجر في الطلب له رسوم توصيل خاصة به (كما هو الآن) — بسعر المنطقة إن كان مشمولاً.</li>
          <li>تغيير الأسعار يُطبَّق على الطلبات الجديدة فقط.</li>
        </ul>
      </div>

      <ZoneModal open={!!editing} zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export default AdminDeliveryZones
