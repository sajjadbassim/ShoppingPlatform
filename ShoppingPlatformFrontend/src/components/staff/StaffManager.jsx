// إدارة الحسابات المساعدة — موظفو المتجر (لصاحبه) والمسؤولون (للأدمن الكامل).
// كل شخص يدخل بحسابه (رقمه وكلمة مروره)، وكل ما يفعله يظهر باسمه في سجل النشاط
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Pencil, Power, Trash2, ShieldCheck, KeyRound } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/axios'
import Modal, { ConfirmModal } from '../common/Modal'
import { useToast } from '../common/Toast'

const inputCls = 'w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary'
const time = (d) => d ? new Date(d).toLocaleString('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', dateStyle: 'medium', timeStyle: 'short' }) : 'لم يدخل بعد'

const StaffForm = ({ kind, catalog, initial, onClose, onSubmit, busy }) => {
  const editing = !!initial
  const [form, setForm] = useState({
    fullName: initial?.fullName || '', phone: initial?.phone || '', email: initial?.email || '', password: '',
    permissions: initial?.permissions || [], fullAccess: initial?.fullAccess ?? false,
  })
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const toggle = (key) => set({ permissions: form.permissions.includes(key) ? form.permissions.filter(k => k !== key) : [...form.permissions, key] })
  const valid = form.fullName.trim() && (editing || (form.phone.trim() && form.password.length >= 6))
    && (!form.password || form.password.length >= 6) && (form.fullAccess || form.permissions.length > 0)

  const submit = (e) => {
    e.preventDefault()
    const body = editing
      ? { fullName: form.fullName, password: form.password || null, permissions: form.fullAccess ? null : form.permissions, fullAccess: kind === 'admin' ? form.fullAccess : null }
      : { fullName: form.fullName, phone: form.phone, email: form.email || null, password: form.password, permissions: form.permissions, fullAccess: form.fullAccess }
    onSubmit(body)
  }

  return (
    <Modal isOpen onClose={onClose} title={editing ? `تعديل ${initial.fullName}` : kind === 'vendor' ? 'إضافة موظف' : 'إضافة مسؤول'}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">الاسم</label>
          <input value={form.fullName} onChange={e => set({ fullName: e.target.value })} className={inputCls} maxLength={100} />
        </div>
        {!editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">رقم الهاتف (للدخول)</label>
              <input value={form.phone} onChange={e => set({ phone: e.target.value })} className={inputCls} dir="ltr" placeholder="07XX XXX XXXX" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">البريد (اختياري)</label>
              <input value={form.email} onChange={e => set({ email: e.target.value })} className={inputCls} dir="ltr" />
            </div>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
            <KeyRound size={13} />{editing ? 'كلمة مرور جديدة (اتركها فارغة بلا تغيير)' : 'كلمة المرور'}
          </label>
          <input type="password" value={form.password} onChange={e => set({ password: e.target.value })} className={inputCls} dir="ltr" placeholder="6 أحرف على الأقل" autoComplete="new-password" />
        </div>

        <div>
          <p className="text-sm font-bold text-gray-800 mb-2">الصلاحيات</p>
          {kind === 'admin' && (
            <label className="flex items-start gap-2 p-3 mb-2 rounded-xl border-2 border-amber-200 bg-amber-50 cursor-pointer">
              <input type="checkbox" checked={form.fullAccess} onChange={e => set({ fullAccess: e.target.checked })} className="w-4 h-4 mt-0.5 accent-primary" />
              <span>
                <span className="block text-sm font-bold text-amber-900">صلاحيات كاملة</span>
                <span className="block text-xs text-amber-800">كل الأقسام، ويدير المسؤولين الآخرين أيضاً</span>
              </span>
            </label>
          )}
          {!form.fullAccess && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catalog.map(p => (
                <label key={p.key} className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer ${form.permissions.includes(p.key) ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                  <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => toggle(p.key)} className="w-4 h-4 mt-0.5 accent-primary" />
                  <span>
                    <span className="block text-sm font-bold text-gray-900">{p.label}</span>
                    <span className="block text-xs text-gray-500">{p.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {editing && <p className="text-xs text-gray-500">تغيير الصلاحيات يُطبَّق فوراً على جلسته المفتوحة.</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-300 text-sm">إلغاء</button>
          <button type="submit" disabled={!valid || busy} className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
            {busy ? '...' : editing ? 'حفظ' : 'إضافة'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// kind: 'vendor' (api/vendor-staff) | 'admin' (api/admin-staff)
const StaffManager = ({ kind, endpoint, currentUserId }) => {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [editing, setEditing] = useState(null)   // null | 'new' | staff
  const [removing, setRemoving] = useState(null)
  const key = ['staff', kind]

  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: async () => (await apiGet(endpoint)).data })
  const list = data?.data || []
  const catalog = data?.permissions || []
  const labelOf = Object.fromEntries(catalog.map(p => [p.key, p.label]))

  const done = (msg) => { qc.invalidateQueries({ queryKey: key }); success(msg) }
  const fail = (e) => error(e.message || 'تعذّر الحفظ')
  const save = useMutation({
    mutationFn: async (body) => (editing === 'new' ? await apiPost(endpoint, body) : await apiPut(`${endpoint}/${editing.id}`, body)).data,
    onSuccess: (r) => { setEditing(null); done(r?.message || 'تم الحفظ') }, onError: fail,
  })
  const toggle = useMutation({ mutationFn: async (s) => (await apiPut(`${endpoint}/${s.id}/toggle`)).data, onSuccess: (r) => done(r?.message), onError: fail })
  const remove = useMutation({ mutationFn: async (s) => (await apiDelete(`${endpoint}/${s.id}`)).data, onSuccess: (r) => { setRemoving(null); done(r?.message) }, onError: fail })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-gray-500">
          {kind === 'vendor'
            ? 'كل موظف يدخل برقمه وكلمة مروره، ويرى فقط الأقسام التي تسمح بها. كل ما يفعله يظهر باسمه في سجل النشاط.'
            : 'كل مسؤول يدخل بحسابه، ويرى الأقسام التي تحددها فقط. صاحب «الصلاحيات الكاملة» يدير المسؤولين أيضاً.'}
        </p>
        <button type="button" onClick={() => setEditing('new')}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5 flex-shrink-0">
          <UserPlus size={16} />{kind === 'vendor' ? 'إضافة موظف' : 'إضافة مسؤول'}
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : isError ? (
          <p className="p-6 text-center text-sm text-red-500">تعذّر التحميل</p>
        ) : list.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">{kind === 'vendor' ? 'لا يوجد موظفون بعد' : 'لا يوجد مسؤولون'}</p>
        ) : list.map(s => {
          const self = s.id === currentUserId
          return (
            <div key={s.id} className={`p-4 flex flex-wrap items-start gap-3 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="font-bold text-gray-900 flex items-center gap-2">
                  {s.fullName}
                  {self && <span className="text-xs font-normal text-gray-400">(أنت)</span>}
                  {!s.isActive && <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">موقوف</span>}
                </p>
                <p className="text-xs text-gray-500" dir="ltr">{s.phone}{s.email ? ` · ${s.email}` : ''}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.fullAccess
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1"><ShieldCheck size={12} />صلاحيات كاملة</span>
                    : s.permissions.map(p => <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{labelOf[p] || p}</span>)}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">آخر دخول: {time(s.lastLogin)}</p>
              </div>
              {!self && (
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setEditing(s)} aria-label="تعديل" title="تعديل"
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600"><Pencil size={15} /></button>
                  <button type="button" onClick={() => toggle.mutate(s)} disabled={toggle.isPending} aria-label={s.isActive ? 'إيقاف' : 'تفعيل'} title={s.isActive ? 'إيقاف' : 'تفعيل'}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center ${s.isActive ? 'border-amber-200 text-amber-600' : 'border-green-200 text-green-600'}`}><Power size={15} /></button>
                  {kind === 'vendor' && (
                    <button type="button" onClick={() => setRemoving(s)} aria-label="إزالة" title="إزالة من المتجر"
                      className="w-9 h-9 rounded-lg border border-red-200 text-red-600 flex items-center justify-center"><Trash2 size={15} /></button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <StaffForm kind={kind} catalog={catalog} initial={editing === 'new' ? null : editing}
          onClose={() => !save.isPending && setEditing(null)} onSubmit={(body) => save.mutate(body)} busy={save.isPending} />
      )}
      <ConfirmModal isOpen={!!removing} onClose={() => !remove.isPending && setRemoving(null)} onConfirm={() => remove.mutate(removing)}
        loading={remove.isPending} title="إزالة الموظف"
        message={`سيُوقف حساب ${removing?.fullName || ''} ويُفصل عن متجرك فوراً. يبقى ما فعله ظاهراً في سجل النشاط.`}
        confirmText="إزالة" cancelText="تراجع" />
    </div>
  )
}

export default StaffManager
