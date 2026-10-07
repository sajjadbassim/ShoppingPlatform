// أدوات المنتجات الجماعية للتاجر: تعديل الأسعار والخصومات، وتصدير/استيراد CSV
// الحسابات على السعر المخزّن (regularPrice) لا السعر بعد العروض — وإلا ينقص السعر الحقيقي بقيمة العرض
import { useMemo, useState } from 'react'
import { Download, Upload, RefreshCw, Percent, Tag, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import Modal from '../common/Modal'
import { apiPostForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import productService from '../../services/productService'

// الأسعار بالدينار تُقرَّب لأقرب 250
export const roundIqd = (n) => Math.max(250, Math.round(n / 250) * 250)
const storedPrice = (p) => p.regularPrice ?? p.price ?? 0
const storedOriginal = (p) => (p.regularOriginalPrice !== undefined ? p.regularOriginalPrice : p.originalPrice) || null
const storedStock = (p) => p.regularStockQuantity ?? p.stockQuantity ?? 0
const fmt = (n) => (n ?? 0).toLocaleString()

// ===========================
// تعديل الأسعار جماعياً
// ===========================
const MODES = [
  { key: 'change', label: 'تغيير السعر بنسبة', icon: Percent, hint: 'موجب للرفع وسالب للخفض، مثل 10 أو ‎-10' },
  { key: 'discount', label: 'تطبيق خصم', icon: Tag, hint: 'يظهر السعر الأصلي مشطوباً بجانب السعر الجديد' },
  { key: 'remove', label: 'إلغاء الخصم', icon: X, hint: 'يعود السعر إلى السعر الأصلي المشطوب' },
]

// التغيير المطلوب لمنتج واحد — null إن لم يتغير شيء
export const planPriceChange = (p, mode, percent) => {
  const price = storedPrice(p)
  const original = storedOriginal(p)
  if (mode === 'change') {
    if (!percent) return null
    const next = roundIqd(price * (1 + percent / 100))
    const nextOriginal = original ? roundIqd(original * (1 + percent / 100)) : null
    return next === price ? null : {
      Price: next,
      ...(nextOriginal && nextOriginal > next ? { OriginalPrice: nextOriginal } : original ? { ClearOriginalPrice: true } : {}),
    }
  }
  if (mode === 'discount') {
    if (!(percent > 0 && percent < 100)) return null
    const base = original || price
    const next = roundIqd(base * (1 - percent / 100))
    return next >= base ? null : { Price: next, OriginalPrice: base }
  }
  if (mode === 'remove') {
    return original ? { Price: original, ClearOriginalPrice: true } : null
  }
  return null
}

export const BulkPriceModal = ({ isOpen, onClose, products, onDone }) => {
  const [mode, setMode] = useState('discount')
  const [percent, setPercent] = useState('')
  const [running, setRunning] = useState(false)
  const pct = Number(percent)

  const plan = useMemo(() => products
    .map(p => ({ p, change: planPriceChange(p, mode, pct) }))
    .filter(x => x.change), [products, mode, pct])

  const apply = async () => {
    setRunning(true)
    const results = await Promise.allSettled(plan.map(({ p, change }) => productService.update(p.id, change)))
    setRunning(false)
    onDone({
      ok: plan.filter((_, i) => results[i].status === 'fulfilled').map(x => ({ id: x.p.id, change: x.change })),
      failed: results.filter(r => r.status === 'rejected').length,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={running ? undefined : onClose} title={`تعديل أسعار ${products.length} منتج`} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => (
            <button key={m.key} type="button" onClick={() => setMode(m.key)}
              className={`p-3 rounded-xl border text-sm font-bold flex flex-col items-center gap-1.5 ${mode === m.key ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-700'}`}>
              <m.icon size={18} />{m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{MODES.find(m => m.key === mode).hint} — الأسعار تُقرَّب لأقرب 250 د.ع</p>
        {mode !== 'remove' && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{mode === 'discount' ? 'نسبة الخصم %' : 'نسبة التغيير %'}</span>
            <input type="number" inputMode="decimal" value={percent} onChange={e => setPercent(e.target.value)} autoFocus
              placeholder={mode === 'discount' ? '15' : '10'} className="mt-1 w-full h-11 px-3 border border-gray-200 rounded-xl text-sm" />
          </label>
        )}

        <div className="rounded-xl border border-gray-200 max-h-56 overflow-y-auto divide-y divide-gray-100">
          {plan.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">لا تغيير على المنتجات المحددة</p>
          ) : plan.map(({ p, change }) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate text-gray-800">{p.nameAr || p.name}</span>
              <span className="flex-shrink-0 tabular-nums">
                <span className="text-gray-400 line-through ml-2">{fmt(storedPrice(p))}</span>
                <b className="text-gray-900">{fmt(change.Price)}</b>
                {change.OriginalPrice && <span className="text-xs text-rose-600 mr-1">(كان {fmt(change.OriginalPrice)})</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={running} className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-gray-700">إلغاء</button>
          <button type="button" onClick={apply} disabled={running || plan.length === 0}
            className="flex-1 h-11 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {running && <RefreshCw size={16} className="animate-spin" />}تطبيق على {plan.length}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ===========================
// CSV
// ===========================
export const CSV_COLUMNS = ['sku', 'name_ar', 'name_en', 'price', 'original_price', 'stock', 'category', 'visible']

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const productsToCsv = (products) => [
  CSV_COLUMNS.join(','),
  ...products.map(p => [
    p.sku || '', p.nameAr || '', p.name || '', storedPrice(p), storedOriginal(p) ?? '',
    p.hasVariants ? '' : storedStock(p), p.categoryNameAr || p.categoryName || '', p.isActive ? 'yes' : 'no',
  ].map(csvCell).join(',')),
].join('\r\n')

export const downloadProductsCsv = (products, storeName = 'products') => {
  // BOM حتى يفتح Excel العربية بشكل صحيح
  const blob = new Blob(['﻿' + productsToCsv(products)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `${storeName}-${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// محلل CSV بسيط (RFC 4180): علامات اقتباس، فواصل وأسطر داخل الخلايا
export const parseCsv = (text) => {
  const rows = []
  let row = [], cell = '', quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

const toNumber = (s) => {
  const n = Number(String(s ?? '').replace(/[,\s]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return Number.isFinite(n) ? n : NaN
}
const YES = ['yes', 'true', '1', 'نعم', 'ظاهر']

// كل صف ← إنشاء منتج جديد، أو تحديث منتج موجود بنفس SKU، أو خطأ
export const planImport = (rows, products, categories) => {
  if (rows.length < 2) return { error: 'الملف فارغ — يجب أن يحتوي سطر العناوين وصفاً واحداً على الأقل' }
  const header = rows[0].map(h => h.trim().toLowerCase())
  const idx = Object.fromEntries(CSV_COLUMNS.map(c => [c, header.indexOf(c)]))
  if (idx.name_ar < 0 || idx.price < 0)
    return { error: `العناوين المطلوبة: name_ar و price (الأعمدة المدعومة: ${CSV_COLUMNS.join(', ')})` }

  const bySku = new Map(products.filter(p => p.sku).map(p => [p.sku.trim().toLowerCase(), p]))
  const byCategory = new Map(categories.flatMap(c => [[(c.nameAr || '').trim(), c.id], [(c.name || '').trim().toLowerCase(), c.id]]).filter(([k]) => k))
  const get = (r, col) => (idx[col] >= 0 ? (r[idx[col]] ?? '').trim() : '')

  return {
    lines: rows.slice(1).map((r, i) => {
      const line = i + 2
      const sku = get(r, 'sku')
      const price = toNumber(get(r, 'price'))
      const originalRaw = get(r, 'original_price')
      const original = originalRaw ? toNumber(originalRaw) : null
      const stockRaw = get(r, 'stock')
      const stock = stockRaw ? toNumber(stockRaw) : null
      const categoryName = get(r, 'category')
      const categoryId = categoryName ? byCategory.get(categoryName) ?? byCategory.get(categoryName.toLowerCase()) : null
      const visibleRaw = get(r, 'visible')
      const existing = sku ? bySku.get(sku.toLowerCase()) : null
      const nameAr = get(r, 'name_ar') || existing?.nameAr || ''

      const fail = (message) => ({ line, action: 'error', name: nameAr || sku || `سطر ${line}`, message })
      if (!(price > 0)) return fail('السعر غير صحيح')
      if (original !== null && !(original > price)) return fail('السعر الأصلي يجب أن يكون أعلى من سعر البيع')
      if (stock !== null && !(Number.isInteger(stock) && stock >= 0)) return fail('الكمية غير صحيحة')
      if (categoryName && !categoryId) return fail(`فئة غير موجودة: ${categoryName}`)

      // عمود السعر الأصلي غائب ← لا يُمس الخصم الحالي؛ موجود وفارغ ← يُلغى الخصم
      const fields = {
        Price: price,
        ...(original ? { OriginalPrice: original } : idx.original_price >= 0 ? { ClearOriginalPrice: true } : {}),
        ...(stock !== null && !existing?.hasVariants ? { StockQuantity: stock } : {}),
        ...(categoryId ? { CategoryId: categoryId } : {}),
        ...(visibleRaw ? { IsActive: YES.includes(visibleRaw.toLowerCase()) } : {}),
      }
      if (existing) {
        if (get(r, 'name_ar')) fields.NameAr = get(r, 'name_ar')
        if (get(r, 'name_en')) fields.Name = get(r, 'name_en')
        return { line, action: 'update', id: existing.id, name: nameAr, fields }
      }
      if (!nameAr) return fail('اسم المنتج (name_ar) مطلوب للمنتج الجديد')
      delete fields.ClearOriginalPrice
      return {
        line, action: 'create', name: nameAr,
        fields: { ...fields, NameAr: nameAr, Name: get(r, 'name_en') || nameAr, Sku: sku || undefined, StockQuantity: stock ?? 0, IsActive: fields.IsActive ?? false },
      }
    }),
  }
}

const runLine = (line, vendorId) => {
  if (line.action === 'update') return productService.update(line.id, line.fields)
  const fd = new FormData()
  fd.append('VendorId', vendorId)
  fd.append('Description', '-')
  fd.append('IsAvailable', 'true')
  Object.entries(line.fields).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)) })
  return apiPostForm(API_ENDPOINTS.PRODUCTS.BASE, fd)
}

export const CsvImportModal = ({ isOpen, onClose, products, categories, vendorId, onDone }) => {
  const [plan, setPlan] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const reset = () => { setPlan(null); setResult(null); setProgress(0) }
  const close = () => { if (!running) { reset(); onClose() } }

  const readFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResult(null)
    setPlan(planImport(parseCsv(await file.text()), products, categories))
  }

  const lines = plan?.lines ?? []
  const valid = lines.filter(l => l.action !== 'error')
  const counts = { create: lines.filter(l => l.action === 'create').length, update: lines.filter(l => l.action === 'update').length, error: lines.length - valid.length }

  const run = async () => {
    setRunning(true)
    let ok = 0
    const failures = []
    for (let i = 0; i < valid.length; i++) {
      try { await runLine(valid[i], vendorId); ok++ }
      catch (err) { failures.push({ line: valid[i].line, name: valid[i].name, message: err.message || 'فشل' }) }
      setProgress(i + 1)
    }
    setRunning(false)
    setResult({ ok, failures })
    onDone()
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="استيراد المنتجات من CSV" size="lg">
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-gray-50 p-3 text-gray-600 space-y-1">
          <p>الأعمدة: <code dir="ltr" className="text-xs">{CSV_COLUMNS.join(', ')}</code> — المطلوب: <b>name_ar</b> و <b>price</b>.</p>
          <p>صفّ بـ <b>sku</b> موجود يحدّث المنتج (السعر، الخصم، الكمية، الفئة، الظهور)، وغيره يُنشئ منتجاً جديداً <b>مخفياً</b> حتى تضيف صوره (إلا إن كتبت visible = yes).</p>
          <p>أسهل طريقة: صدّر منتجاتك الحالية، عدّل الملف في Excel، ثم استورده.</p>
        </div>

        {!plan && !result && (
          <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary hover:bg-primary/5">
            <Upload size={24} className="text-gray-400" />
            <span className="font-bold text-gray-700">اختر ملف CSV</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={readFile} />
          </label>
        )}

        {plan?.error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{plan.error}</p>
        )}

        {lines.length > 0 && !result && (
          <>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">{counts.create} جديد</span>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{counts.update} تحديث</span>
              {counts.error > 0 && <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700">{counts.error} خطأ (لن يُنفَّذ)</span>}
            </div>
            <div className="rounded-xl border border-gray-200 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {lines.map(l => (
                <div key={l.line} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs text-gray-400 w-10">#{l.line}</span>
                  <span className="flex-1 truncate text-gray-800">{l.name}</span>
                  {l.action === 'error'
                    ? <span className="text-xs text-red-600">{l.message}</span>
                    : <span className={`text-xs font-bold ${l.action === 'create' ? 'text-green-700' : 'text-blue-700'}`}>
                        {l.action === 'create' ? 'جديد' : 'تحديث'} · {fmt(l.fields.Price)} د.ع
                      </span>}
                </div>
              ))}
            </div>
          </>
        )}

        {running && (
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(progress / Math.max(1, valid.length)) * 100}%` }} />
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-green-700 font-bold"><CheckCircle2 size={18} />تم تنفيذ {result.ok} من {result.ok + result.failures.length}</p>
            {result.failures.map(f => <p key={f.line} className="text-xs text-red-600">سطر {f.line} ({f.name}): {f.message}</p>)}
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={result ? close : plan ? reset : close} disabled={running}
            className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-gray-700">{result ? 'إغلاق' : plan ? 'ملف آخر' : 'إلغاء'}</button>
          {!result && (
            <button type="button" onClick={run} disabled={running || valid.length === 0}
              className="flex-1 h-11 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {running ? <><RefreshCw size={16} className="animate-spin" />{progress}/{valid.length}</> : <><Download size={16} className="rotate-180" />استيراد {valid.length}</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
