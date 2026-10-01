// src/pages/admin/AdminFinance.jsx
// مستحقات المتاجر: رصيد كل متجر، كشف حسابه، تسجيل الدفعات والتسويات، والعمولات
import { useEffect, useState } from 'react'
import { Wallet, Download, RefreshCw, Percent, ChevronLeft, Calculator } from 'lucide-react'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { Skeleton } from '../../components/common/Loading'
import { SummaryCards, LedgerList, money, commissionLabel } from '../../components/finance/Ledger'
import {
  useVendorBalances, useVendorStatement, useDefaultCommission, useRecordPayout, useRecordAdjustment,
  useSetVendorCommission, useSetDefaultCommission, useBackfill, downloadStatementCsv,
} from '../../hooks/useFinance'

const inputCls = 'w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary'

// نوع العمولة + قيمتها
const CommissionEditor = ({ value, onSave, saving, allowDefault }) => {
  const [useDefault, setUseDefault] = useState(!!value?.isDefault && allowDefault)
  const [type, setType] = useState(value?.type || 'PERCENTAGE')
  const [amount, setAmount] = useState(value?.value ?? 0)
  useEffect(() => { setUseDefault(!!value?.isDefault && allowDefault); setType(value?.type || 'PERCENTAGE'); setAmount(value?.value ?? 0) }, [value, allowDefault])

  return (
    <div className="space-y-2">
      {allowDefault && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={useDefault} onChange={e => setUseDefault(e.target.checked)} className="w-4 h-4 accent-primary" />
          يتبع العمولة العامة
        </label>
      )}
      {!useDefault && (
        <div className="grid grid-cols-2 gap-2">
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            <option value="PERCENTAGE">نسبة من قيمة المنتجات</option>
            <option value="FIXED">مبلغ ثابت عن كل طلب</option>
          </select>
          <div className="relative">
            <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className={inputCls + ' pl-12'} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{type === 'FIXED' ? 'د.ع' : '%'}</span>
          </div>
        </div>
      )}
      <Button size="sm" variant="outline" loading={saving}
        onClick={() => onSave(useDefault ? { useDefault: true } : { type, value: Number(amount) })}>حفظ العمولة</Button>
    </div>
  )
}

const VendorPanel = ({ vendor, onClose }) => {
  const { success, error } = useToast()
  const { data: st, isLoading } = useVendorStatement(vendor?.vendorId)
  const { mutateAsync: payout, isPending: paying } = useRecordPayout()
  const { mutateAsync: adjust, isPending: adjusting } = useRecordAdjustment()
  const { mutateAsync: setCommission, isPending: savingC } = useSetVendorCommission()
  const [tab, setTab] = useState('ledger')
  const [form, setForm] = useState({ amount: '', reference: '', note: '' })

  useEffect(() => { setTab('ledger'); setForm({ amount: '', reference: '', note: '' }) }, [vendor?.vendorId])

  const run = async (fn, msg) => {
    try { await fn(); success(msg); setForm({ amount: '', reference: '', note: '' }); setTab('ledger') }
    catch (e) { error(e.message || 'تعذّر الحفظ') }
  }

  return (
    <Modal isOpen={!!vendor} onClose={onClose} title={vendor?.vendorName || ''} size="lg">
      {vendor && (isLoading || !st ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          <SummaryCards s={st.summary} />

          <div className="grid grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1 text-sm font-bold">
            {[['ledger', 'الحركات'], ['payout', 'دفعة'], ['adjust', 'تسوية'], ['commission', 'العمولة']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`h-9 rounded-lg ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>

          {tab === 'ledger' && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button type="button" onClick={() => downloadStatementCsv(vendor.vendorName, st.entries)}
                  className="h-9 px-3 rounded-lg border border-gray-300 text-sm font-bold text-gray-700 inline-flex items-center gap-1.5">
                  <Download size={15} /> كشف حساب (Excel)
                </button>
              </div>
              <LedgerList entries={st.entries} orderLink={(e) => `/admin/orders/${e.orderId}`} />
            </div>
          )}

          {tab === 'payout' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">سجّل مبلغاً حوّلته للمتجر (نقداً أو تحويلاً). يُخصم من رصيده المستحق.</p>
              <input type="number" min={1} placeholder={`المبلغ (المستحق ${money(st.summary.balance)})`} value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
              <input placeholder="طريقة التحويل / رقم العملية (اختياري)" value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className={inputCls} />
              <input placeholder="ملاحظة (اختياري)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inputCls} />
              {Number(form.amount) > st.summary.balance && <p className="text-xs text-amber-700">المبلغ أكبر من الرصيد المستحق — سيصبح على المتجر للمنصة.</p>}
              <Button variant="primary" fullWidth loading={paying} disabled={!(Number(form.amount) > 0)}
                onClick={() => run(() => payout({ vendorId: vendor.vendorId, amount: Number(form.amount), reference: form.reference || undefined, note: form.note || undefined }), 'تم تسجيل الدفعة')}>
                تسجيل الدفعة
              </Button>
            </div>
          )}

          {tab === 'adjust' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">تسوية يدوية: مبلغ موجب لصالح المتجر، أو سالب عليه (مثل تعويض أو غرامة). السبب إلزامي.</p>
              <input type="number" placeholder="المبلغ (مثلاً 5000 أو -5000)" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} dir="ltr" />
              <input placeholder="السبب" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inputCls} />
              <Button variant="primary" fullWidth loading={adjusting} disabled={!Number(form.amount) || !form.note.trim()}
                onClick={() => run(() => adjust({ vendorId: vendor.vendorId, amount: Number(form.amount), note: form.note }), 'تم تسجيل التسوية')}>
                تسجيل التسوية
              </Button>
            </div>
          )}

          {tab === 'commission' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">العمولة الحالية: <b>{commissionLabel(st.summary.commissionRule)}</b>. التغيير يُطبَّق على الطلبات التي تُسلَّم بعده فقط.</p>
              <CommissionEditor value={vendor.commissionRule} allowDefault saving={savingC}
                onSave={(body) => run(() => setCommission({ vendorId: vendor.vendorId, ...body }), 'تم حفظ عمولة المتجر')} />
            </div>
          )}
        </div>
      ))}
    </Modal>
  )
}

const AdminFinance = () => {
  const { success, error } = useToast()
  const { data: balances = [], isLoading, refetch, isFetching } = useVendorBalances()
  const { data: defaultCommission } = useDefaultCommission()
  const { mutateAsync: setDefault, isPending: savingDefault } = useSetDefaultCommission()
  const { mutateAsync: backfill, isPending: backfilling } = useBackfill()
  const [selected, setSelected] = useState(null)
  const [showDefault, setShowDefault] = useState(false)

  const totalDue = balances.reduce((s, b) => s + Math.max(0, b.balance), 0)
  const totalCommission = balances.reduce((s, b) => s + b.commission, 0)
  const empty = !isLoading && balances.every(b => b.sales === 0 && b.payouts === 0)

  const runBackfill = async () => {
    if (!confirm('احتساب كل الطلبات المسلَّمة سابقاً بالعمولات الحالية؟ (آمن — لا يكرر ما سُجّل)')) return
    try { const r = await backfill(); success(`تم — ${r?.processed ?? 0} عملية`) } catch (e) { error(e.message || 'تعذّر الاحتساب') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">مستحقات المتاجر</h1>
          <p className="text-sm text-gray-500">ما تدين به المنصة لكل متجر بعد العمولة والخصومات والدفعات</p>
        </div>
        <button onClick={() => refetch()} aria-label="تحديث" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Wallet size={13} /> مستحق للمتاجر</p>
          <p className="text-xl font-extrabold text-primary mt-1">{money(totalDue)}</p>
          <p className="text-[11px] text-gray-400 mt-1">ما يجب تحويله للمتاجر</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Percent size={13} /> أرباح المنصة (العمولات)</p>
          <p className="text-xl font-extrabold text-gray-900 mt-1">{money(totalCommission)}</p>
          <p className="text-[11px] text-gray-400 mt-1">حصة المنصة من مبيعات المتاجر</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <button type="button" onClick={() => setShowDefault(s => !s)} className="w-full flex items-center justify-between text-right">
          <span>
            <span className="block font-bold text-gray-900">العمولة العامة</span>
            <span className="block text-xs text-gray-500">للمتاجر بلا عمولة خاصة: {commissionLabel(defaultCommission)}</span>
          </span>
          <ChevronLeft size={18} className={`text-gray-400 transition-transform ${showDefault ? '-rotate-90' : ''}`} />
        </button>
        {showDefault && defaultCommission && (
          <div className="mt-3">
            <CommissionEditor value={defaultCommission} saving={savingDefault}
              onSave={async (body) => { try { await setDefault(body); success('تم حفظ العمولة العامة') } catch (e) { error(e.message || 'تعذّر الحفظ') } }} />
          </div>
        )}
      </div>

      {empty && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Calculator className="text-amber-600 flex-shrink-0" />
          <p className="flex-1 text-sm text-amber-900">لا توجد حركات بعد. اضبط العمولات أولاً ثم احسب الطلبات المسلَّمة سابقاً.</p>
          <Button size="sm" variant="primary" loading={backfilling} onClick={runBackfill}>احتساب السابق</Button>
        </div>
      )}

      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : (
        <div className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100">
          {balances.map(b => (
            <button key={b.vendorId} type="button" onClick={() => setSelected(b)} className="w-full flex items-center gap-3 p-4 text-right hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{b.vendorName}</p>
                <p className="text-xs text-gray-500">مبيعات {money(b.sales)} · عمولة {commissionLabel(b.commissionRule)}</p>
              </div>
              <div className="text-left">
                <p className={`font-extrabold ${b.balance > 0 ? 'text-primary' : b.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>{money(Math.abs(b.balance))}</p>
                <p className="text-[11px] text-gray-400">{b.balance > 0 ? 'مستحق له' : b.balance < 0 ? 'عليه' : 'مسدَّد'}</p>
              </div>
              <ChevronLeft size={16} className="text-gray-300" />
            </button>
          ))}
        </div>
      )}

      {!empty && !isLoading && (
        <div className="flex justify-center">
          <button type="button" onClick={runBackfill} disabled={backfilling} className="text-xs text-gray-500 hover:text-primary">
            {backfilling ? '...' : 'إعادة فحص الطلبات السابقة (يضيف ما فات فقط)'}
          </button>
        </div>
      )}

      <VendorPanel vendor={selected ? balances.find(b => b.vendorId === selected.vendorId) || selected : null} onClose={() => setSelected(null)} />
    </div>
  )
}

export default AdminFinance
