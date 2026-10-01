// src/pages/operations/OperationsReports.jsx
// تقارير العمليات: مؤشرات الفترة مقارنة بالفترة السابقة، الطلبات يومياً وحسب الساعة، المتاجر، السائقون وأسباب الإلغاء.
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, Download, TrendingUp, TrendingDown, Package, CheckCircle, XCircle, Wallet, Receipt, Timer, Truck, Store, AlertCircle,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { fmtMinutes } from '../../components/common/OrderTiming'

// ===========================
// الفترات
// ===========================
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const PRESETS = [
  { key: 'today', label: 'اليوم', range: (t) => [t, t] },
  { key: 'yesterday', label: 'أمس', range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: '7d', label: 'آخر 7 أيام', range: (t) => [addDays(t, -6), t] },
  { key: '30d', label: 'آخر 30 يوماً', range: (t) => [addDays(t, -29), t] },
  { key: 'month', label: 'هذا الشهر', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
]

const money = (n) => `${Math.round(n || 0).toLocaleString()} د.ع`
const compactMoney = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} مليون` : n >= 1e3 ? `${Math.round(n / 1e3)} ألف` : String(Math.round(n || 0))
const mins = (m) => m == null ? '—' : m < 1 ? 'أقل من دقيقة' : m < 60 ? `${Math.round(m)} د` : `${Math.floor(m / 60)} س ${Math.round(m % 60)} د`
const pct = (r) => `${Math.round((r || 0) * 1000) / 10}%`

// التغيّر عن الفترة السابقة — lowerIsBetter للإلغاء والأوقات
const Delta = ({ now, prev, lowerIsBetter }) => {
  if (now == null || prev == null || prev === 0) return <span className="text-[11px] text-gray-400">—</span>
  const change = (now - prev) / prev
  if (Math.abs(change) < 0.005) return <span className="text-[11px] text-gray-400">بلا تغيير</span>
  const good = lowerIsBetter ? change < 0 : change > 0
  const Icon = change > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${good ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
      <Icon size={12} />{change > 0 ? '+' : ''}{Math.round(change * 100)}%
    </span>
  )
}

const Card = ({ title, children, action }) => (
  <section className="bg-white rounded-2xl border border-gray-200 p-4">
    <div className="flex items-center justify-between mb-3">
      <p className="text-base font-bold text-gray-900">{title}</p>
      {action}
    </div>
    {children}
  </section>
)

// أعمدة بسيطة بلا مكتبة رسوم
const Bars = ({ values, labels, format, highlight }) => {
  const max = Math.max(1, ...values)
  return (
    <div className="flex items-end gap-[3px] h-40" dir="ltr">
      {values.map((v, i) => (
        <div key={i} className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-0">
          <div className={`w-full rounded-t-md transition-colors ${highlight?.(i) ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/70'}`}
            style={{ height: `${Math.max(v ? 4 : 0, (v / max) * 100)}%` }} />
          <span className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap rounded-md bg-gray-900 text-white text-[11px] px-2 py-1 z-10" dir="rtl">
            {labels[i]}: {format(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

// تصدير CSV يفتح بالعربية في Excel (BOM)
const downloadCsv = (name, rows) => {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

const OperationsReports = () => {
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const [preset, setPreset] = useState('7d')
  const [custom, setCustom] = useState({ from: iso(addDays(today, -6)), to: iso(today) })
  const [dailyMetric, setDailyMetric] = useState('revenue')

  const [from, to] = preset === 'custom'
    ? [custom.from, custom.to]
    : PRESETS.find(p => p.key === preset).range(today).map(iso)

  const { data: report, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['ops-report', from, to],
    queryFn: async () => (await apiGet(API_ENDPOINTS.OPS.REPORTS, { from, to })).data.data,
    enabled: !!from && !!to && from <= to,
    staleTime: 60 * 1000,
  })

  const s = report?.summary
  const p = report?.previousSummary
  const kpis = s ? [
    { label: 'الطلبات', value: s.orders.toLocaleString(), icon: Package, now: s.orders, prev: p.orders, tone: 'bg-blue-100 text-blue-700' },
    { label: 'الإيرادات (المُسلّم)', value: compactMoney(s.revenue), full: money(s.revenue), icon: Wallet, now: s.revenue, prev: p.revenue, tone: 'bg-green-100 text-green-700' },
    { label: 'متوسط قيمة الطلب', value: compactMoney(s.averageOrderValue), full: money(s.averageOrderValue), icon: Receipt, now: s.averageOrderValue, prev: p.averageOrderValue, tone: 'bg-indigo-100 text-indigo-700' },
    { label: 'نسبة الإلغاء', value: pct(s.cancellationRate), sub: `${s.cancelled} من ${s.storeOrders}`, icon: XCircle, now: s.cancellationRate, prev: p.cancellationRate, lower: true, tone: 'bg-red-100 text-red-700' },
    { label: 'تم التوصيل', value: s.delivered.toLocaleString(), sub: 'طلبات متاجر', icon: CheckCircle, now: s.delivered, prev: p.delivered, tone: 'bg-emerald-100 text-emerald-700' },
    { label: 'زمن تأكيد المتجر', value: mins(s.avgConfirmMinutes), icon: Timer, now: s.avgConfirmMinutes, prev: p.avgConfirmMinutes, lower: true, tone: 'bg-amber-100 text-amber-700' },
    { label: 'من الطلب للتسليم', value: mins(s.avgDeliveryMinutes), icon: Package, now: s.avgDeliveryMinutes, prev: p.avgDeliveryMinutes, lower: true, tone: 'bg-purple-100 text-purple-700' },
    { label: 'زمن رحلة السائق', value: mins(s.avgRideMinutes), icon: Truck, now: s.avgRideMinutes, prev: p.avgRideMinutes, lower: true, tone: 'bg-cyan-100 text-cyan-700' },
  ] : []

  const daily = report?.daily || []
  const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })
  const peakHour = report ? report.hourly.indexOf(Math.max(...report.hourly)) : -1
  const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}`
  const maxReason = Math.max(1, ...(report?.cancellationReasons || []).map(r => r.count))

  const exportCsv = () => {
    if (!report) return
    downloadCsv(`تقرير-العمليات-${from}-${to}.csv`, [
      ['التاريخ', 'الطلبات', 'تم التوصيل', 'ملغي', 'الإيرادات'],
      ...daily.map(d => [d.date, d.orders, d.delivered, d.cancelled, d.revenue]),
      [],
      ['المتجر', 'الطلبات', 'تم التوصيل', 'ملغي', 'الإيرادات', 'متوسط التأكيد (دقيقة)'],
      ...report.vendors.map(v => [v.name, v.orders, v.delivered, v.cancelled, v.revenue, v.avgConfirmMinutes ?? '']),
      [],
      ['السائق', 'التوصيلات', 'متوسط الرحلة (دقيقة)'],
      ...report.drivers.map(d => [d.name, d.deliveries, d.avgRideMinutes ?? '']),
    ])
  }

  return (
    <div className="space-y-4">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-xs text-gray-500 mt-0.5">مقارنة بالفترة السابقة بنفس الطول · بتوقيت العراق</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} aria-label="تحديث" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
        <button onClick={exportCsv} disabled={!report}
          className="h-10 px-4 rounded-full border border-gray-200 bg-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
          <Download size={16} /><span className="hidden sm:inline">تصدير Excel</span>
        </button>
      </div>

      {/* الفترة */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {[...PRESETS, { key: 'custom', label: 'مخصص' }].map(pr => (
          <button key={pr.key} onClick={() => setPreset(pr.key)}
            className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap border ${preset === pr.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            {pr.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">من <input type="date" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} className="h-10 px-3 border border-gray-200 rounded-xl bg-white" /></label>
          <label className="flex items-center gap-2">إلى <input type="date" value={custom.to} min={custom.from} max={iso(today)} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} className="h-10 px-3 border border-gray-200 rounded-xl bg-white" /></label>
        </div>
      )}

      {isError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 flex flex-col items-center gap-2">
          <AlertCircle size={28} />{error?.message || 'تعذّر تحميل التقرير'}
        </div>
      ) : isLoading || !report ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* المؤشرات */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-4" title={k.full}>
                <div className="flex items-center justify-between">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.tone}`}><k.icon size={16} /></span>
                  <Delta now={k.now} prev={k.prev} lowerIsBetter={k.lower} />
                </div>
                <p className="text-xl font-bold text-gray-900 mt-2.5 truncate">{k.value}</p>
                <p className="text-xs text-gray-500 truncate">{k.label}{k.sub && <span className="text-gray-400"> · {k.sub}</span>}</p>
              </div>
            ))}
          </div>

          {s.orders === 0 ? (
            <p className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-sm text-gray-400">لا توجد طلبات في هذه الفترة</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* يومي */}
                <div className="lg:col-span-2 min-w-0">
                  <Card title="حسب اليوم" action={
                    <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-bold">
                      {[['revenue', 'الإيرادات'], ['orders', 'الطلبات']].map(([k, l]) => (
                        <button key={k} onClick={() => setDailyMetric(k)} className={`px-2.5 py-1 rounded-md ${dailyMetric === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{l}</button>
                      ))}
                    </div>
                  }>
                    <Bars values={daily.map(d => dailyMetric === 'revenue' ? d.revenue : d.orders)}
                      labels={daily.map(d => dayLabel(d.date))}
                      format={dailyMetric === 'revenue' ? money : (v) => `${v} طلب`} />
                    <div className="flex justify-between text-[11px] text-gray-400 mt-2" dir="ltr">
                      <span>{dayLabel(daily[0].date)}</span>
                      {daily.length > 2 && <span>{dayLabel(daily[Math.floor(daily.length / 2)].date)}</span>}
                      <span>{dayLabel(daily[daily.length - 1].date)}</span>
                    </div>
                  </Card>
                </div>
                {/* الساعات */}
                <Card title="أوقات الذروة">
                  <Bars values={report.hourly} labels={report.hourly.map((_, h) => hourLabel(h))} format={(v) => `${v} طلب`} highlight={(i) => i === peakHour} />
                  <div className="flex justify-between text-[11px] text-gray-400 mt-2" dir="ltr"><span>12 ص</span><span>6 ص</span><span>12 م</span><span>6 م</span><span>11 م</span></div>
                  <p className="text-xs text-gray-600 mt-3">الذروة: <b>{hourLabel(peakHour)} – {hourLabel((peakHour + 1) % 24)}</b> — جهّز سائقين أكثر في هذا الوقت</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* المتاجر */}
                <div className="lg:col-span-2 min-w-0">
                  <Card title="المتاجر">
                    <div className="overflow-x-auto -mx-4">
                      <table className="w-full text-sm min-w-[36rem]">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-100">
                            {['المتجر', 'الطلبات', 'مُسلّم', 'الإلغاء', 'الإيرادات', 'زمن التأكيد'].map(h => <th key={h} className="px-4 py-2 text-right font-bold">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {report.vendors.map(v => {
                            const rate = v.orders ? v.cancelled / v.orders : 0
                            return (
                              <tr key={v.vendorId}>
                                <td className="px-4 py-2.5 font-medium text-gray-900"><span className="inline-flex items-center gap-1.5"><Store size={14} className="text-gray-400" />{v.name}</span></td>
                                <td className="px-4 py-2.5">{v.orders}</td>
                                <td className="px-4 py-2.5">{v.delivered}</td>
                                <td className={`px-4 py-2.5 font-bold ${rate > 0.2 ? 'text-red-600' : 'text-gray-700'}`}>{pct(rate)}</td>
                                <td className="px-4 py-2.5">{money(v.revenue)}</td>
                                <td className={`px-4 py-2.5 ${v.avgConfirmMinutes > 10 ? 'text-amber-700 font-bold' : ''}`}>{mins(v.avgConfirmMinutes)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4 min-w-0">
                  {/* السائقون */}
                  <Card title="السائقون">
                    {report.drivers.length === 0 ? <p className="text-sm text-gray-400 py-3 text-center">لا توصيلات مكتملة</p> : (
                      <div className="space-y-2.5">
                        {report.drivers.map((d, i) => (
                          <div key={d.driverId} className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                            <span className="flex-1 text-sm font-medium text-gray-900 truncate">{d.name}</span>
                            <span className="text-xs text-gray-500">{d.deliveries} توصيل · {mins(d.avgRideMinutes)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* أبطأ الطلبات */}
                  <Card title="أبطأ الطلبات">
                    {!report.slowestOrders?.length ? <p className="text-sm text-gray-400 py-3 text-center">لا توصيلات مكتملة</p> : (
                      <div className="space-y-2">
                        {report.slowestOrders.map(o => (
                          <Link key={o.orderId} to={`/operations/orders?order=${o.orderId}`} className="block rounded-lg hover:bg-gray-50 -mx-1 px-1 py-1">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="font-mono text-gray-800 truncate" dir="ltr">{o.orderNumber}</span>
                              <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${o.speed === 'slow' ? 'bg-red-100 text-red-700' : o.speed === 'fast' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{fmtMinutes(o.totalMinutes)}</span>
                            </div>
                            {o.slowestStage && <p className="text-[11px] text-gray-500 truncate">أطول مرحلة: {o.slowestStage} ({fmtMinutes(o.slowestStageMinutes)})</p>}
                          </Link>
                        ))}
                        <p className="text-[11px] text-gray-400 pt-1">سريع حتى {report.deliveryFastMinutes} د · بطيء من {report.deliverySlowMinutes} د فأكثر</p>
                      </div>
                    )}
                  </Card>

                  {/* أسباب الإلغاء */}
                  <Card title="أسباب الإلغاء">
                    {report.cancellationReasons.length === 0 ? <p className="text-sm text-gray-400 py-3 text-center">لا إلغاءات 👌</p> : (
                      <div className="space-y-2.5">
                        {report.cancellationReasons.map(r => (
                          <div key={r.reason}>
                            <div className="flex justify-between text-sm"><span className="text-gray-800 truncate">{r.reason}</span><span className="font-bold text-gray-900">{r.count}</span></div>
                            <div className="h-1.5 rounded-full bg-gray-100 mt-1"><div className="h-full rounded-full bg-red-400" style={{ width: `${(r.count / maxReason) * 100}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default OperationsReports
