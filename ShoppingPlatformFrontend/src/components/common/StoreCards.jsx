import { Link } from 'react-router-dom'
import { MapPin, Package, Clock, Truck, ArrowLeft, Sparkles, Star } from 'lucide-react'
import { Skeleton } from './Loading'
import { useProductsByVendor } from '../../hooks/useProducts'
import { getVendorLogo, getVendorCover, getPrimaryImage } from '../../utils/imageHelper'

// بطاقات المتاجر المشتركة بين صفحة المتاجر والصفحة الرئيسية

// أيقونات افتراضية للمتاجر بلا شعار
const STORE_ICONS = ['🏪', '🛍️', '📦', '🎁', '🛒', '💼']

// تدرجات للأغلفة المفقودة
const COVER_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-rose-500 to-orange-400',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-amber-500 to-orange-600',
]

// ===========================
// أجزاء مشتركة
// ===========================
const StoreLogo = ({ store, index, className = 'w-14 h-14' }) => {
  const logoUrl = getVendorLogo(store)
  return (
    <div className={`${className} flex-shrink-0 rounded-2xl bg-white ring-2 ring-white shadow-lg overflow-hidden flex items-center justify-center text-2xl`}>
      {logoUrl
        ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        : <span>{STORE_ICONS[index % STORE_ICONS.length]}</span>}
    </div>
  )
}

const StoreCover = ({ store, index, className }) => {
  const coverUrl = getVendorCover(store)
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${COVER_GRADIENTS[index % COVER_GRADIENTS.length]} ${className}`}>
      {coverUrl && (
        <img src={coverUrl} alt="" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />
    </div>
  )
}

const StoreStats = ({ store, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
    {store.ratingsCount > 0 && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-800 font-bold">
        <Star size={12} className="text-yellow-500 fill-yellow-500" />{Number(store.rating).toFixed(1)}
        <span className="font-normal text-yellow-700">({store.ratingsCount})</span>
      </span>
    )}
    {store.productsCount != null && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
        <Package size={12} className="text-primary" />{store.productsCount} منتج
      </span>
    )}
    {store.estimatedPrepTime != null && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
        <Clock size={12} className="text-primary" />{store.estimatedPrepTime} د
      </span>
    )}
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${store.deliveryFee > 0 ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700 font-medium'}`}>
      <Truck size={12} className={store.deliveryFee > 0 ? 'text-primary' : ''} />
      {store.deliveryFee > 0 ? `${Number(store.deliveryFee).toLocaleString()} د.ع` : 'توصيل مجاني'}
    </span>
  </div>
)

// معاينة منتجات المتجر (تُجلب لكل متجر وتُخزَّن — نفس بيانات صفحة المتجر)
const ProductsPreview = ({ storeId, count = 4, size = 'h-16' }) => {
  const { data, isLoading } = useProductsByVendor(storeId)
  const products = (Array.isArray(data) ? data : data?.items || []).filter(p => getPrimaryImage(p))
  const shown = products.slice(0, count)
  const more = products.length - shown.length

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-1.5">
        {[...Array(count)].map((_, i) => <Skeleton key={i} className={`${size} rounded-xl`} />)}
      </div>
    )
  }
  if (shown.length === 0) return null

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {shown.map((p, i) => (
        <div key={p.id} className={`relative ${size} rounded-xl overflow-hidden bg-gray-100`}>
          <img src={getPrimaryImage(p)} alt="" loading="lazy" className="w-full h-full object-cover" />
          {i === shown.length - 1 && more > 0 && (
            <span className="absolute inset-0 bg-black/55 text-white text-sm font-bold flex items-center justify-center" dir="ltr">+{more}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ===========================
// المتجر المميز (الأول في الترتيب الحالي)
// ===========================
export const FeaturedStore = ({ store }) => (
  <Link to={`/stores/${store.id}`}
    className="group block bg-white rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow lg:flex">
    <div className="relative lg:w-1/2">
      <StoreCover store={store} index={0} className="h-44 sm:h-56 lg:h-full lg:min-h-[280px]" />
      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-bold shadow">
        <Sparkles size={13} />متجر مميز
      </span>
      <div className="absolute bottom-0 inset-x-0 p-4 flex items-end gap-3">
        <StoreLogo store={store} index={0} className="w-16 h-16" />
        <div className="min-w-0 pb-1">
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug line-clamp-1 drop-shadow">{store.nameAr || store.name}</h2>
          {store.address && (
            <p className="flex items-center gap-1 text-xs text-white/85 truncate"><MapPin size={12} />{store.address}</p>
          )}
        </div>
      </div>
    </div>

    <div className="p-4 sm:p-5 lg:w-1/2 lg:flex lg:flex-col">
      {store.description && <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">{store.description}</p>}
      <StoreStats store={store} className="mb-4" />
      <p className="text-xs font-bold text-gray-500 mb-2">من منتجات المتجر</p>
      <ProductsPreview storeId={store.id} count={4} size="h-20 sm:h-24" />
      <span className="mt-4 lg:mt-auto lg:pt-4 inline-flex items-center justify-center gap-2 h-11 w-full rounded-full bg-gray-900 text-white text-sm font-bold group-hover:bg-primary transition-colors">
        زيارة المتجر <ArrowLeft size={16} />
      </span>
    </div>
  </Link>
)

// ===========================
// بطاقة المتجر
// ===========================
export const StoreCard = ({ store, index, className = '' }) => (
  <Link to={`/stores/${store.id}`}
    className={`${className} group flex flex-col bg-white rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all`}>
    <div className="relative">
      <StoreCover store={store} index={index} className="h-32" />
      <div className="absolute bottom-0 inset-x-0 p-3 flex items-end gap-3">
        <StoreLogo store={store} index={index} className="w-12 h-12" />
        <div className="min-w-0 pb-0.5">
          <h3 className="text-base font-bold text-white leading-snug line-clamp-1 drop-shadow">{store.nameAr || store.name}</h3>
          {store.address && (
            <p className="flex items-center gap-1 text-[11px] text-white/85 truncate"><MapPin size={11} />{store.address}</p>
          )}
        </div>
      </div>
    </div>

    <div className="p-3 sm:p-4 flex-1 flex flex-col gap-3">
      <ProductsPreview storeId={store.id} count={4} size="h-16" />
      <StoreStats store={store} />
      <div className="mt-auto flex items-center justify-between pt-1">
        {store.minOrderAmount > 0
          ? <span className="text-[11px] text-gray-500">أقل طلب {Number(store.minOrderAmount).toLocaleString()} د.ع</span>
          : <span />}
        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          زيارة المتجر <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
        </span>
      </div>
    </div>
  </Link>
)
