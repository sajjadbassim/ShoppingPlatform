// المرتجعات: بضاعة لم تُسلَّم للزبون (تعذّر التسليم أو رفض قطع عند الباب) تعود مع نفس السائق لمتجرها بأجرة صفر.
// تقرير منفصل عن الطلبات والمبيعات. المتجر يؤكد الاستلام من لوحته، والعمليات تستطيع التأكيد نيابة عنه.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, RefreshCw, Store, Truck, Package, CheckCircle } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const when = (d) => d ? new Date(d).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : ''

const TripCard = ({ trip, onReceived, busy }) => {
  const open = trip.status === 'WITH_DRIVER'
  const atCustomer = trip.status === 'AT_CUSTOMER'   // مرتجع لم يأخذه السائق من الزبون بعد
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900 text-sm" dir="ltr">{trip.subOrderNumber || trip.orderNumber}</span>
        <span className="text-xs text-gray-400">{when(trip.createdAt)}</span>
        <span className={`mr-auto text-xs font-bold px-2 py-0.5 rounded-full ${atCustomer ? 'bg-violet-100 text-violet-700' : open ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {atCustomer ? 'عند الزبون — السائق في طريقه' : open ? 'مع السائق' : `استلمه المتجر ${when(trip.receivedAt)}`}
        </span>
      </div>
      <p className="text-xs text-gray-600">
        {trip.reasonAr}{trip.returnNumber ? <> · <span dir="ltr">{trip.returnNumber}</span></> : ''} · أجرة الإرجاع: {(trip.deliveryFee || 0).toLocaleString('en-US')} د.ع
        {trip.customerName && trip.reason === 'customer_return' ? ` · الزبون: ${trip.customerName}` : ''}
      </p>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Store size={15} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{trip.vendorName}</span>
          {trip.vendorPhone && <a href={`tel:${trip.vendorPhone}`} className="text-primary text-xs mr-auto" dir="ltr">{trip.vendorPhone}</a>}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Truck size={15} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{trip.driverName}</span>
          {trip.driverPhone && <a href={`tel:${trip.driverPhone}`} className="text-primary text-xs mr-auto" dir="ltr">{trip.driverPhone}</a>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {trip.items.map((i, k) => (
          <span key={k} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full inline-flex items-center gap-1">
            <Package size={11} />{i.productName} ×{i.quantity}
          </span>
        ))}
      </div>
      {open && (
        <button onClick={() => onReceived(trip)} disabled={busy}
          className="w-full h-10 rounded-xl border border-green-600 text-green-700 text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
          <CheckCircle size={16} />تأكيد الاستلام نيابة عن المتجر
        </button>
      )}
    </div>
  )
}

const OperationsReturnTrips = () => {
  const [tab, setTab] = useState('open')
  const qc = useQueryClient()
  const { success, error } = useToast()
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ops-return-trips'],
    queryFn: async () => (await apiGet(API_ENDPOINTS.OPS.RETURN_TRIPS)).data.data,
    refetchInterval: 60000,
  })
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (id) => apiPost(API_ENDPOINTS.OPS.RETURN_TRIP_RECEIVED(id)),
  })

  const trips = (data?.trips || []).filter(t => tab === 'all' || t.status === 'WITH_DRIVER' || t.status === 'AT_CUSTOMER')
  const received = async (trip) => {
    if (!window.confirm(`تأكيد أن «${trip.vendorName}» استلم البضاعة؟ ستعود القطع للمخزون.`)) return
    try {
      await mutateAsync(trip.id)
      success('تم تأكيد الاستلام وإعادة القطع للمخزون')
      qc.invalidateQueries({ queryKey: ['ops-return-trips'] })
    } catch (e) { error(e.message || 'فشل تأكيد الاستلام') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><RotateCcw size={22} />المرتجعات</h1>
          <p className="text-sm text-gray-500 mt-0.5">بضاعة لم تُسلَّم تعود مع السائق لمتجرها — آخر 30 يوماً</p>
        </div>
        <button onClick={() => refetch()} aria-label="تحديث" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl border border-gray-200 p-3">
          <p className="text-2xl font-extrabold text-orange-600">{data?.open ?? '—'}</p>
          <p className="text-xs text-gray-500">مع السائقين الآن</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3">
          <p className="text-2xl font-extrabold text-green-600">{data?.received ?? '—'}</p>
          <p className="text-xs text-gray-500">استلمتها المتاجر</p>
        </div>
        {Object.entries(data?.byReason || {}).map(([reason, n]) => (
          <div key={reason} className="bg-white rounded-2xl border border-gray-200 p-3">
            <p className="text-2xl font-extrabold text-gray-900">{n}</p>
            <p className="text-xs text-gray-500 truncate">{reason}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {[['open', 'مع السائقين'], ['all', 'الكل']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`h-9 px-4 rounded-full text-sm font-bold ${tab === k ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>
      ) : trips.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
          {tab === 'open' ? 'لا توجد بضاعة مرتجعة مع السائقين الآن' : 'لا توجد مرتجعات في هذه الفترة'}
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {trips.map(t => <TripCard key={t.id} trip={t} onReceived={received} busy={isPending} />)}
        </div>
      )}
    </div>
  )
}

export default OperationsReturnTrips
