// استثناء العمليات: من يتحمّل أجرة التوصيل لطلب/إرجاع واحد بدل إعداد الأدمن العام — مع سبب إلزامي
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, ChevronLeft } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useToast } from './Toast'
import Modal from './Modal'

export const PAYER_AR = { CUSTOMER: 'الزبون', VENDOR: 'المتجر', NONE: 'المنصة' }
const PAYERS = ['CUSTOMER', 'VENDOR', 'NONE']
const unwrap = (r) => r.data?.data ?? r.data

// المحرّر نفسه: اختيار من يتحمّل + سبب
const Editor = ({ current, onSave, onClear, saving, clearLabel }) => {
  const [payer, setPayer] = useState(current)
  const [reason, setReason] = useState('')
  const valid = payer && payer !== current && reason.trim().length > 0

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {PAYERS.map(p => (
          <button key={p} type="button" onClick={() => setPayer(p)}
            className={`h-9 rounded-lg text-sm font-bold border ${payer === p ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300 text-gray-700'}`}>
            {PAYER_AR[p]}
          </button>
        ))}
      </div>
      <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
        placeholder="السبب (إلزامي) — مثال: المتجر أرسل قطعة خاطئة"
        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white" />
      <div className="flex gap-2">
        <button type="button" disabled={!valid || saving} onClick={() => onSave(payer, reason.trim())}
          className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
          {saving ? '...' : 'حفظ الاستثناء'}
        </button>
        {onClear && (
          <button type="button" disabled={saving} onClick={onClear}
            className="h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-50">
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  )
}

const Box = ({ title, payer, isException, note, open, setOpen, children }) => (
  <div className={`rounded-2xl border p-4 ${isException ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
    <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 text-right">
      <Truck size={16} className={isException ? 'text-amber-600' : 'text-gray-400'} />
      <span className="flex-1">
        <span className="block text-sm font-bold text-gray-900">{title}: {PAYER_AR[payer] || '—'}</span>
        <span className="block text-xs text-gray-500">{note}</span>
      </span>
      <ChevronLeft size={16} className={`text-gray-400 transition-transform ${open ? '-rotate-90' : ''}`} />
    </button>
    {open && children}
  </div>
)

// الطلب: قبل أن يسجّل السائق الرفض فقط (open = في الطلب جزء لم يُسلَّم/يُلغَ/يفشل بعد)
export const OrderRefusalFeeException = ({ orderId, open: orderOpen }) => {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [expanded, setExpanded] = useState(false)
  const key = ['refusal-fee', orderId]
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.DRIVERS.REFUSAL_FEE(orderId))),
    enabled: !!orderId,
  })
  const { mutate, isPending } = useMutation({
    mutationFn: async (body) => unwrap(await apiPut(API_ENDPOINTS.DRIVERS.REFUSAL_FEE(orderId), body)),
    onSuccess: (res, body) => {
      qc.setQueryData(key, res)
      setExpanded(false)
      success(body.payer ? `الاستثناء محفوظ — الأجرة على ${PAYER_AR[body.payer]}، والسائق أُبلغ` : 'عاد الطلب لإعداد الأدمن')
    },
    onError: (e) => error(e.message || 'تعذّر الحفظ'),
  })

  if (!data || (!orderOpen && !data.overridePayer)) return null
  const override = data.overridePayer
  const payer = override || data.defaultFullPayer
  const note = override
    ? `استثناء لهذا الطلب: ${data.overrideReason}`
    : data.defaultPartialPayer !== data.defaultFullPayer
      ? `حسب إعداد الأدمن (رفض بعض القطع: ${PAYER_AR[data.defaultPartialPayer]})`
      : 'حسب إعداد الأدمن'

  return (
    <Box title="إن رفض الزبون، أجرة التوصيل على" payer={payer} isException={!!override} note={note}
      open={expanded && orderOpen} setOpen={orderOpen ? setExpanded : () => {}}>
      <p className="text-xs text-gray-500 mt-3">يُطبَّق على هذا الطلب فقط، ويجب ضبطه قبل أن يسجّل السائق الرفض.</p>
      <Editor current={override} saving={isPending}
        onSave={(p, reason) => mutate({ payer: p, reason })}
        onClear={override ? () => mutate({ payer: null, reason: null }) : null} clearLabel="إلغاء الاستثناء" />
    </Box>
  )
}

// الإرجاع: بعد الموافقة وقبل وصول القطع للمتجر
export const ReturnPickupFeeException = ({ ret, onChanged, defaultOpen = false }) => {
  const { success, error } = useToast()
  const [expanded, setExpanded] = useState(defaultOpen)
  const { mutate, isPending } = useMutation({
    mutationFn: async (body) => unwrap(await apiPost(API_ENDPOINTS.RETURNS.PICKUP_FEE(ret.id), body)),
    onSuccess: (res) => {
      setExpanded(false)
      success(`أجرة الاستلام على ${PAYER_AR[res?.pickupFeePayer]} — يُردّ للزبون ${(res?.refundAmount ?? 0).toLocaleString('en-US')} د.ع`)
      onChanged?.(res)
    },
    onError: (e) => error(e.message || 'تعذّر الحفظ'),
  })

  const editable = ret.status?.toUpperCase() === 'APPROVED' && !ret.itemsReceivedAt && !!ret.pickupFeePayer
  if (!ret.pickupFeePayer) return null
  const fee = ret.pickupFeeAmount > 0 ? ` (${ret.pickupFeeAmount.toLocaleString('en-US')} د.ع)` : ''
  const note = ret.pickupFeeOverrideReason
    ? `غيّرته العمليات: ${ret.pickupFeeOverrideReason}`
    : editable ? 'حسب إعداد الأدمن — يمكن تغييره قبل وصول القطع للمتجر' : 'حسب إعداد الأدمن'

  return (
    <Box title={`أجرة استلام المرتجع${fee} على`} payer={ret.pickupFeePayer} isException={!!ret.pickupFeeOverrideReason}
      note={note} open={expanded && editable} setOpen={editable ? setExpanded : () => {}}>
      <Editor current={ret.pickupFeePayer} saving={isPending}
        onSave={(p, reason) => mutate({ payer: p, reason })} />
    </Box>
  )
}

// شارة صغيرة في جدول الإرجاعات: من يتحمّل أجرة الاستلام، وتفتح نافذة التغيير إن أمكن
export const ReturnPickupFeeChip = ({ ret, onChanged }) => {
  const [open, setOpen] = useState(false)
  if (!ret.pickupFeePayer || ret.isDoorRefusal) return null
  const editable = ret.status?.toUpperCase() === 'APPROVED' && !ret.itemsReceivedAt
  const fee = ret.pickupFeeAmount > 0 ? ` ${ret.pickupFeeAmount.toLocaleString('en-US')} د.ع` : ''
  const label = `أجرة الاستلام${fee} على ${PAYER_AR[ret.pickupFeePayer]}`
  const tone = ret.pickupFeeOverrideReason ? 'text-amber-800 bg-amber-50' : 'text-gray-600 bg-gray-50'
  return (
    <>
      <button type="button" disabled={!editable} onClick={() => setOpen(true)}
        title={ret.pickupFeeOverrideReason ? `غيّرته العمليات: ${ret.pickupFeeOverrideReason}` : editable ? 'تغيير من يتحمّل الأجرة لهذا الإرجاع' : undefined}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full whitespace-nowrap ${tone} ${editable ? 'hover:ring-1 hover:ring-primary cursor-pointer' : 'cursor-default'}`}>
        <Truck size={12} />{label}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={`أجرة استلام الإرجاع #${ret.returnNumber || ''}`}>
        <p className="text-sm text-gray-500 mb-3">استثناء لهذا الإرجاع فقط — مثلاً القطعة معيبة أو خاطئة فلا يدفع الزبون أجرة إرجاعها. يُعاد حساب المبلغ المردود ويُبلَّغ الزبون.</p>
        <ReturnPickupFeeException ret={ret} defaultOpen onChanged={(res) => { setOpen(false); onChanged?.(res) }} />
      </Modal>
    </>
  )
}
