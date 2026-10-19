import { useState, useEffect, useRef, Children } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Truck, Shield, Headphones, CreditCard, Store, Star, Heart, Plus, Clock, LayoutGrid, BadgePercent, ShoppingBasket, Search, Zap, RotateCcw } from 'lucide-react'
import AppPromoSection from '../../components/common/AppPromoSection'
import CategoryIcon from '../../components/common/CategoryIcon'
import { variantsService } from '../../services/variantsService'
import { Skeleton } from '../../components/common/Loading'
import { useCategories } from '../../hooks/useCategories'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/common/Toast'
import { getImageUrl, getPrimaryImage, getVendorLogo, IMG_SIZE } from '../../utils/imageHelper'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { useAdvancedFilter } from '../../hooks/useProducts'
import { SCOPE, SUPERMARKET_PATH, isGroceryCategory } from '../../utils/shopScope'
import { formatPrice, pricePerKg } from '../../utils/weight'
import { API_ENDPOINTS } from '../../api/endpoints'
import { StoreClosedBadge, isStoreClosed } from '../../components/common/StoreClosedBadge'
import { usePublicZones, vendorUsesZones } from '../../hooks/useDeliveryZones'

// ===========================
// Hooks
// ===========================

// page: general (الرئيسية) | grocery (السوبرماركت) — لكل صفحة سلايدرها وأقسامها
const useHomeData = (page) => useQuery({
  queryKey: ['home', page],
  queryFn: async () => {
    const r = await apiGet('/api/Home', { page })
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

const useHomeBanners = (page) => useQuery({
  queryKey: ['home-banners', page],
  queryFn: async () => {
    // السلايدر العلوي فقط — بانرات البلوكات تأتي مع أقسامها
    const r = await apiGet('/api/Home/banners', { onlyActive: true, heroOnly: true, page })
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

// ===========================
// Helpers
// ===========================

const formatProduct = (p) => ({
  id: p.id,
  name: p.nameAr || p.name,
  image: p.primaryImageUrl,
  price: p.price,
  originalPrice: p.originalPrice,
  rating: p.averageRating || 0,
  reviewsCount: p.reviewCount || 0,
  storeName: p.vendorName,
  inStock: p.isAvailable && p.stockQuantity > 0,
  storeClosed: isStoreClosed(p),
  storeStatus: p.vendorOpenStatus,
  hasDiscount: p.hasDiscount,
  discountPercentage: p.discountPercentage,
  weightStepKg: p.weightStepKg,
})

// الوجهة تُحدَّد حسب نوع الرابط أولاً، حتى لا يبقى معرّف قديم يطغى على رابط مخصص
const getBannerLink = (banner) => {
  const id = banner.linkEntityId
  switch (banner.linkType) {
    case 'url':      return banner.linkUrl?.trim() || '/products'
    case 'category': return id ? `/products?category=${id}` : '/products'
    case 'vendor':   return id ? `/stores/${id}` : '/products'
    case 'product':  return id ? `/products/${id}` : '/products'
    default:         return banner.linkUrl?.trim() || '/products'
  }
}

const isExternalLink = (url) => /^(https?:)?\/\//i.test(url) || /^(mailto|tel):/i.test(url)

// الروابط الكاملة التي تشير لموقعنا نفسه (أو لـ localhost المحفوظ أثناء التطوير)
// تتحول لمسار داخلي، حتى تفتح داخل التطبيق وليس في المتصفح
const LOCAL_HOSTS = ['localhost', '127.0.0.1']
const toInternalPath = (url) => {
  if (!/^(https?:)?\/\//i.test(url)) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.origin === window.location.origin || LOCAL_HOSTS.includes(u.hostname)) {
      return u.pathname + u.search + u.hash
    }
  } catch { /* رابط غير صالح — يُعامل كما هو */ }
  return url
}

// رابط يدعم المسارات الداخلية والروابط الخارجية
const BannerLink = ({ to, children, ...props }) => {
  const target = toInternalPath(to)
  return isExternalLink(target)
    ? <a href={target} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
    : <Link to={target} {...props}>{children}</Link>
}

// ===========================
// Hero Slider
// ===========================

const HeroSlider = ({ banners, loading }) => {
  const [current, setCurrent] = useState(0)

  const slides = banners?.filter(b => b.imageUrl) || []

  // fallback slide إذا لا توجد بانرات
  const fallbackSlides = [
    { id: 'f1', titleAr: 'مرحباً بك في منصة واسط', subtitleAr: 'تسوق من أفضل المتاجر بأسعار منافسة', imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=500&fit=crop', linkUrl: '/products' },
    { id: 'f2', titleAr: 'أحدث الإلكترونيات',       subtitleAr: 'اكتشف أحدث الأجهزة بأسعار منافسة',   imageUrl: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&h=500&fit=crop', linkUrl: '/products' },
  ]

  const displaySlides = slides.length > 0 ? slides : fallbackSlides

  // تحميل صور الشرائح عند الحاجة فقط: الظاهرة والتالية (وما ظهر سابقاً يبقى محمَّلاً)
  // — كانت الخمس تُحمَّل فوراً (~3.6 MB) مع أن واحدة فقط ظاهرة
  const [seen, setSeen] = useState(() => new Set([0, 1]))
  useEffect(() => {
    const next = (current + 1) % Math.max(1, displaySlides.length)
    setSeen(prev => (prev.has(current) && prev.has(next) ? prev : new Set([...prev, current, next])))
  }, [current, displaySlides.length])

  const [touchStartX, setTouchStartX] = useState(null)
  const swipedRef = useRef(false)

  useEffect(() => {
    if (displaySlides.length <= 1) return
    const t = setInterval(() => setCurrent(p => (p + 1) % displaySlides.length), 5000)
    return () => clearInterval(t)
  }, [displaySlides.length, current])

  // السحب بالإصبع على الهاتف (RTL: السحب لليسار = الشريحة السابقة)
  const handleTouchEnd = (e) => {
    if (touchStartX === null) return
    const dx = e.changedTouches[0].clientX - touchStartX
    setTouchStartX(null)
    if (Math.abs(dx) < 40) return
    swipedRef.current = true
    const n = displaySlides.length
    setCurrent(p => dx > 0 ? (p + 1) % n : (p - 1 + n) % n)
  }

  // على الهاتف نعتمد نسبة أبعاد البنر (1600×656) حتى تظهر الصورة كاملة دون قص
  // على الشاشات الكبيرة: أقل ارتفاعاً قليلاً (قص بسيط من الأعلى والأسفل) حتى لا يملأ الشاشة
  const sizeClass = 'aspect-[1600/656] lg:aspect-[2.8/1]'

  // على الهاتف: من الحافة للحافة بلا هوامش (مثل التطبيقات)، وعلى الشاشات الكبيرة: بطاقة بزوايا دائرية
  if (loading) return (
    <div className="lg:container-main lg:pt-6">
      <div className={`${sizeClass} bg-gray-200 animate-pulse lg:rounded-3xl`} />
    </div>
  )

  return (
    <div className="lg:container-main lg:pt-6">
    <section className={`relative ${sizeClass} overflow-hidden lg:rounded-3xl lg:shadow-sm`}
      onTouchStart={e => { swipedRef.current = false; setTouchStartX(e.touches[0].clientX) }}
      onTouchEnd={handleTouchEnd}
      // منع فتح رابط البنر بعد السحب
      onClickCapture={e => { if (swipedRef.current) { e.preventDefault(); swipedRef.current = false } }}>
      {displaySlides.map((slide, i) => {
        const imgUrl = slide.imageUrl?.startsWith('/') ? getImageUrl(slide.imageUrl) : slide.imageUrl
        const link   = slide.id?.startsWith('f') ? slide.linkUrl : getBannerLink(slide)
        return (
          <BannerLink key={slide.id} to={link}
            aria-label={slide.titleAr || slide.title || `عرض ${i + 1}`}
            tabIndex={i === current ? 0 : -1}
            aria-hidden={i !== current}
            className={`absolute inset-0 block cursor-pointer transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {seen.has(i) && (
              <img src={imgUrl} alt="" className="w-full h-full object-cover"
                fetchpriority={i === 0 ? 'high' : 'auto'} onError={e => e.target.style.display='none'} />
            )}
            {/* النص فوق البنر يُخفى على الهاتف لأن المساحة لا تكفيه */}
            <div className={`${slide.id?.startsWith('f') ? 'hidden sm:block' : 'hidden'} absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent`} />
            <div className={`${slide.id?.startsWith('f') ? 'hidden sm:flex' : 'hidden'} h-full px-10 items-center relative z-10`}>
              <div className="max-w-xl text-white">
                {(slide.titleAr || slide.title) && (
                  <h1 className="text-3xl lg:text-5xl font-bold mb-4 drop-shadow-lg">
                    {slide.titleAr || slide.title}
                  </h1>
                )}
                {(slide.subtitleAr || slide.subtitle) && (
                  <p className="text-lg opacity-90 mb-6">{slide.subtitleAr || slide.subtitle}</p>
                )}
                <span
                  className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors shadow-lg">
                  تسوق الآن <ArrowLeft size={18} />
                </span>
              </div>
            </div>
          </BannerLink>
        )
      })}

      {displaySlides.length > 1 && (
        <>
          <button onClick={() => setCurrent(p => (p - 1 + displaySlides.length) % displaySlides.length)} aria-label="الشريحة السابقة"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronRight size={22} />
          </button>
          <button onClick={() => setCurrent(p => (p + 1) % displaySlides.length)} aria-label="الشريحة التالية"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronLeft size={22} />
          </button>
          {/* مؤشرات الشرائح فوق أسفل الصورة */}
          {/* منطقة اللمس 28px حول كل نقطة (كانت 12×6 بكسل)، والنقطة المرئية بنفس شكلها */}
          <div className="absolute bottom-1 right-2 lg:right-1/2 lg:translate-x-1/2 flex z-10">
            {displaySlides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} aria-label={`الشريحة ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                className="h-7 px-[3px] flex items-center">
                <span className={`block h-1.5 rounded-full shadow transition-all ${i === current ? 'bg-white w-6' : 'bg-white/60 w-3'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
    </div>
  )
}

// رأس صفحة السوبرماركت حين لا توجد بانرات لها بعد
const GroceryHero = () => (
  <div className="lg:container-main lg:pt-6">
    <section className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 lg:rounded-3xl px-5 py-7 lg:px-12 lg:py-12 text-white">
      <ShoppingBasket className="absolute -left-6 -bottom-8 w-40 h-40 lg:w-64 lg:h-64 text-white/10 -rotate-12" aria-hidden="true" />
      <h1 className="relative text-2xl lg:text-4xl font-bold">السوبرماركت</h1>
      <p className="relative mt-1 lg:mt-2 text-sm lg:text-lg text-white/85 max-w-xl">
        خضار وفواكه، ألبان، لحوم ومشروبات — في نفس سلتك مع باقي طلباتك
      </p>
      <button onClick={() => window.dispatchEvent(new Event('open-global-search'))}
        className="relative mt-4 lg:mt-6 w-full max-w-md h-11 rounded-full bg-white text-gray-500 flex items-center gap-2 px-4 text-sm shadow-sm">
        <Search size={18} /> ابحث في السوبرماركت...
      </button>
    </section>
  </div>
)

// ===========================
// Section Renderer
// ===========================

// بطاقة منتج مصغّرة للتمرير الأفقي: صورة، مفضلة، إضافة سريعة، اسم، سعر، تقييم
// العرض: 38% على الهاتف، و4/5/6 بطاقات في الصف على الشاشات الأكبر (مع فراغ 16px بينها)
const RAIL_CARD_WIDTH = 'w-[38%] min-w-[140px] md:min-w-0 md:w-[calc((100%-48px)/4)] lg:w-[calc((100%-64px)/5)] xl:w-[calc((100%-80px)/6)]'

const MobileProductCard = ({ product, onAddToCart, onToggleWishlist, boxed = false, className = RAIL_CARD_WIDTH }) => {
  const img = getPrimaryImage(product, IMG_SIZE.CARD)
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discount = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : product.discountPercentage
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn?.() }
  return (
    <Link to={`/products/${product.id}`}
      className={`group block ${className} flex-shrink-0 snap-start text-gray-900 ${boxed ? 'bg-white rounded-2xl p-2 shadow-sm' : 'md:card md:rounded-2xl md:p-2.5 md:hover:shadow-card-hover'}`}>
      <div className="relative aspect-square product-media rounded-2xl md:rounded-xl overflow-hidden">
        {img
          ? <img src={img} alt={product.name} loading="lazy" className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center text-gray-300"><Store size={32} /></div>}
        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md" dir="ltr">-{discount}%</span>
        )}
        {onToggleWishlist && (
          <button onClick={stop(() => onToggleWishlist(product))} aria-label="المفضلة"
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
            <Heart size={15} className={product.isWishlisted ? 'text-error fill-error' : 'text-gray-700'} />
          </button>
        )}
        <StoreClosedBadge closed={product.storeClosed} status={product.storeStatus} />
        {onAddToCart && product.inStock !== false && (
          <button onClick={stop(() => onAddToCart({ id: product.id, quantity: 1 }))} aria-label="إضافة للسلة"
            className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-primary text-white shadow-md flex items-center justify-center active:scale-90 transition-transform">
            <Plus size={16} />
          </button>
        )}
      </div>
      <p className="mt-2 text-[13px] md:text-sm font-medium leading-snug line-clamp-2 min-h-[2lh] md:group-hover:text-primary transition-colors">{product.name}</p>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm md:text-base font-bold">{formatPrice(product.price, product.weightStepKg)}</span>
        {hasDiscount && <span className="text-[11px] text-gray-400 line-through">{Math.round(pricePerKg(product.originalPrice, product.weightStepKg)).toLocaleString('en-US')}</span>}
      </div>
      {product.rating > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Star size={12} className="text-warning fill-warning" /> {Number(product.rating).toFixed(1)}
        </p>
      )}
    </Link>
  )
}

// بطاقتان ملوّنتان: النقاط التشجيعية والمتاجر المحلية
const PromoTiles = () => (
  <section className="container-main pt-5 lg:pt-8">
    <div className="grid grid-cols-2 gap-3 lg:gap-4">
      <Link to="/loyalty" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 p-4 lg:p-6 min-h-[110px]">
        <Star className="absolute -left-3 -bottom-3 w-20 h-20 lg:w-24 lg:h-24 text-white/40 fill-white/40 rotate-12" aria-hidden="true" />
        <p className="relative font-bold text-amber-950 lg:text-lg">اكسب نقاط تشجيعية</p>
        <p className="relative text-xs lg:text-sm text-amber-900/80 mt-1 max-w-[75%]">مع كل طلب وكل تقييم، واستبدلها بخصومات</p>
      </Link>
      <Link to="/stores" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-4 lg:p-6 min-h-[110px]">
        <Store className="absolute -left-3 -bottom-3 w-20 h-20 lg:w-24 lg:h-24 text-white/25 -rotate-12" aria-hidden="true" />
        <p className="relative font-bold text-white lg:text-lg">تسوّق محلياً</p>
        <p className="relative text-xs lg:text-sm text-white/85 mt-1 max-w-[75%]">متاجر من مدينتك بتوصيل سريع</p>
      </Link>
    </div>
  </section>
)

// "عرض الكل" يفتح نفس محتوى القسم:
// - المختار يدوياً: منتجات القسم نفسها
// - المميز: نفس فلتر الفئة/المتجر ونفس الترتيب (الأكثر مبيعاً)
// - أقسام صفحة السوبرماركت تبقى داخل السوبرماركت
const getSectionLink = (section) => {
  if (section.type === 'custom_products' || section.type === 'flash_deals') return `/products?section=${section.id}`
  const params = new URLSearchParams()
  if (section.filterCategoryId) params.set('category', section.filterCategoryId)
  if (section.filterVendorId) params.set('vendor', section.filterVendorId)
  if (section.page === SCOPE.GROCERY) params.set('scope', SCOPE.GROCERY)
  params.set('sort', 'sales')
  return `/products?${params}`
}

// رأس القسم: العنوان و"عرض الكل"
const SectionHeader = ({ title, subtitle, to }) => (
  <div className="flex items-center justify-between mb-3 md:mb-4">
    <div>
      <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    <Link to={to} className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
      عرض المزيد <ArrowLeft size={16} className="hidden md:block" />
    </Link>
  </div>
)

const bannerSrc = (url) => (url?.startsWith('/') ? getImageUrl(url) : url)

// رأس قسم بصورة بانر: العنوان والوصف وزر "عرض المزيد" فوق الصورة
const BannerSectionHeader = ({ image, title, subtitle, to }) => (
  <div className="relative overflow-hidden -mx-4 md:mx-0 md:rounded-3xl bg-gray-100">
    <img src={bannerSrc(image)} alt="" loading="lazy" className="w-full aspect-[2.3/1] md:aspect-[3.4/1] lg:aspect-[4.2/1] object-cover" />
    {/* تدرّج من جهة النص (اليمين) ليبقى العنوان مقروءاً على أي صورة */}
    <div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/15 to-transparent" />
    <div className="absolute inset-y-0 right-0 w-3/5 flex flex-col justify-center gap-1.5 md:gap-2 p-4 md:p-8 lg:px-10 pb-14 md:pb-8">
      <h2 className="text-white font-bold text-lg md:text-2xl lg:text-3xl leading-snug drop-shadow">{title}</h2>
      {subtitle && <p className="text-white/85 text-xs md:text-sm lg:text-base line-clamp-2">{subtitle}</p>}
      <Link to={to} className="self-start mt-1 md:mt-2 px-4 md:px-5 py-1.5 rounded-xl border border-white/80 text-white text-sm font-medium hover:bg-white/15 active:bg-white/25 transition-colors">
        عرض المزيد
      </Link>
    </div>
  </div>
)

// بلوك بانرات: 1 → عريض، 2 → متجاوران، 3+ → الأول عريض والبقية شبكة من عمودين
// على الشاشات الكبيرة (3+): صف واحد — العريض بعرض عمودين والبقية مربعات بجانبه
const tileClass = (wide, mosaic) => wide
  ? (mosaic ? 'aspect-[2.15/1] md:aspect-[3/1] lg:aspect-auto lg:col-span-2' : 'aspect-[2.15/1] md:aspect-[3/1] lg:aspect-[4/1]')
  : (mosaic ? 'aspect-square md:aspect-[16/10] lg:aspect-square' : 'aspect-square md:aspect-[16/10]')

const BannerTile = ({ banner, wide, mosaic }) => (
  <BannerLink to={getBannerLink(banner)}
    className={`block overflow-hidden rounded-2xl md:rounded-3xl bg-gray-100 active:scale-[0.99] transition-transform ${tileClass(wide, mosaic)}`}>
    <img src={bannerSrc(banner.imageUrl)} alt={banner.titleAr || banner.title || ''} loading="lazy" className="w-full h-full object-cover" />
  </BannerLink>
)

const BannerBlockSection = ({ section }) => {
  const banners = (section.data || []).filter(b => b.imageUrl)
  if (banners.length === 0) return null
  const [wide, ...grid] = banners.length === 2 ? [null, ...banners] : banners
  const mosaic = !!wide && grid.length >= 2

  return (
    <section className="py-3 md:py-5">
      <div className={`container-main space-y-3 md:space-y-4 ${mosaic ? 'lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-4' : ''}`}>
        {wide && <BannerTile banner={wide} wide mosaic={mosaic} />}
        {grid.length > 0 && (
          <div className={`grid grid-cols-2 gap-3 md:gap-4 ${mosaic ? 'lg:contents' : ''}`}>
            {grid.map(b => <BannerTile key={b.id} banner={b} mosaic={mosaic} />)}
          </div>
        )}
      </div>
    </section>
  )
}

// العدّاد التنازلي للعروض المحدودة (ساعات:دقائق:ثوانٍ، أو «يومان و03:12:45»)
const useCountdown = (endsAt) => {
  const end = endsAt ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(endsAt) ? endsAt : `${endsAt}Z`).getTime() : 0
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()))
  useEffect(() => {
    if (!end) return
    const t = setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000)
    return () => clearInterval(t)
  }, [end])
  return left
}

const pad = (n) => String(n).padStart(2, '0')
const CountdownText = ({ ms }) => {
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return <span dir="ltr" className="tabular-nums">{days > 0 ? `${clock} + ${days}d` : clock}</span>
}

// عروض محدودة: رأس بعدّاد تنازلي، ويختفي القسم عند انتهاء الوقت
const FlashDealsSection = ({ section, onAddToCart, onToggleWishlist, isInWishlist }) => {
  const left = useCountdown(section.endsAt)
  const products = (section.data || []).map(p => ({ ...formatProduct(p), isWishlisted: isInWishlist(p.id) }))
  if (products.length === 0 || left <= 0) return null

  return (
    <section className="py-5 md:py-6">
      <div className="container-main">
        <div className="rounded-2xl md:rounded-3xl bg-gradient-to-l from-rose-600 via-red-500 to-orange-500 p-3 md:p-5 text-white">
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Zap size={20} className="fill-white" />{section.titleAr || section.title}</h2>
              {(section.subtitleAr || section.subtitle) && <p className="text-xs md:text-sm text-white/85 mt-0.5 truncate">{section.subtitleAr || section.subtitle}</p>}
            </div>
            <div className="flex-shrink-0 text-center bg-white/15 rounded-xl px-3 py-1.5">
              <p className="text-[10px] md:text-xs text-white/80">ينتهي خلال</p>
              <p className="text-base md:text-xl font-bold"><CountdownText ms={left} /></p>
            </div>
          </div>
          <ProductRail>
            {products.map(product => (
              <MobileProductCard key={product.id} product={product} boxed onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
            ))}
          </ProductRail>
        </div>
      </div>
    </section>
  )
}

// اشترِ مجدداً: ما طلبه الزبون سابقاً ومتوفر الآن (ضمن قسم الصفحة) — يظهر للمسجّل فقط
const BuyAgainSection = ({ page, onAddToCart, onToggleWishlist, isInWishlist }) => {
  const { isAuthenticated } = useAuthStore()
  const { data: items = [] } = useQuery({
    queryKey: ['buy-again', page],
    queryFn: async () => (await apiGet(API_ENDPOINTS.PRODUCTS.BUY_AGAIN, { scope: page, max: 20 })).data.data || [],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
  if (!isAuthenticated || items.length < 2) return null
  const products = items.map(p => ({ ...formatProduct(p), isWishlisted: isInWishlist(p.id) }))

  return (
    <section className="py-5 md:py-6">
      <div className="container-main">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2"><RotateCcw size={18} className="text-primary" />اشترِ مجدداً</h2>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">منتجات طلبتها سابقاً — أضفها بضغطة</p>
          </div>
          <Link to="/orders" className="text-primary hover:underline text-sm font-medium">طلباتي</Link>
        </div>
        <ProductRail>
          {products.map(product => (
            <MobileProductCard key={product.id} product={product} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </ProductRail>
      </div>
    </section>
  )
}

const ProductSection = ({ section, onAddToCart, onToggleWishlist, isInWishlist }) => {
  const products = (section.data || []).map(p => ({
    ...formatProduct(p),
    isWishlisted: isInWishlist(p.id),
  }))

  if (products.length === 0) return null
  const hasBanner = !!section.bannerImageUrl

  return (
    <section className="py-5 md:py-6">
      <div className="container-main">
        {hasBanner ? (
          <BannerSectionHeader
            image={section.bannerImageUrl}
            title={section.titleAr || section.title}
            subtitle={section.subtitleAr || section.subtitle}
            to={getSectionLink(section)} />
        ) : (
          <SectionHeader
            title={section.titleAr || section.title}
            subtitle={section.subtitleAr || section.subtitle}
            to={getSectionLink(section)} />
        )}

        {/* صف واحد بتمرير أفقي — على الهاتف تتداخل البطاقات مع أسفل بانر الرأس */}
        <ProductRail className={hasBanner ? 'relative -mt-10 md:mt-4' : ''}>
          {products.map(product => (
            <MobileProductCard key={product.id} product={product} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </ProductRail>
      </div>
    </section>
  )
}

// شريط تمرير أفقي، مع أسهم على الشاشات الكبيرة تظهر فقط حين يوجد محتوى في ذلك الاتجاه
const ProductRail = ({ children, className = '' }) => {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ atStart: true, atEnd: true })

  const update = () => {
    const el = ref.current
    if (!el) return
    // في RTL تكون scrollLeft صفراً في البداية وسالبة كلما تقدّمنا يساراً
    const x = Math.abs(el.scrollLeft)
    const next = { atStart: x < 4, atEnd: x + el.clientWidth >= el.scrollWidth - 4 }
    setEdges(prev => (prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next))
  }

  const count = Children.count(children)
  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [count])

  const scrollPage = (dir) => {
    const el = ref.current
    if (el) el.scrollBy({ left: -dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const arrow = 'hidden md:flex absolute top-[38%] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-primary hover:border-primary transition-colors'

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} onScroll={update}
        className="flex gap-3 md:gap-4 overflow-x-auto snap-x scroll-px-4 md:scroll-px-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:py-1">
        {children}
      </div>
      {!edges.atStart && (
        <button onClick={() => scrollPage(-1)} aria-label="السابق" className={`${arrow} right-0 translate-x-1/2`}>
          <ChevronRight size={20} />
        </button>
      )}
      {!edges.atEnd && (
        <button onClick={() => scrollPage(1)} aria-label="التالي" className={`${arrow} left-0 -translate-x-1/2`}>
          <ChevronLeft size={20} />
        </button>
      )}
    </div>
  )
}

// المتاجر المميزة: بطاقات أفقية بغلاف المتجر وشعاره، التقييم، وقت التحضير ورسوم التوصيل
const StoreCardMini = ({ vendor }) => {
  const { data: zonesCfg } = usePublicZones()
  const logo = getVendorLogo(vendor, IMG_SIZE.THUMB)
  const cover = vendor.coverImageUrl ? bannerSrc(vendor.coverImageUrl) : null
  const rating = vendor.rating ? Number(vendor.rating).toFixed(1) : null

  return (
    <Link to={`/stores/${vendor.id}`}
      className="group flex-shrink-0 w-[62%] min-w-[210px] max-w-[260px] md:w-auto md:max-w-none snap-start rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      <div className="relative h-24 lg:h-28 bg-gradient-to-br from-primary/20 to-primary/40">
        {cover && <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />}
        <span className="absolute -bottom-6 right-3 w-14 h-14 rounded-2xl bg-white shadow-md ring-2 ring-white overflow-hidden flex items-center justify-center">
          {logo
            ? <img src={logo} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <Store size={22} className="text-gray-400" />}
        </span>
      </div>
      <div className="pt-8 px-3 pb-3">
        <p className="font-bold text-sm text-gray-900 truncate">{vendor.nameAr || vendor.name}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
          {rating && (
            <span className="flex items-center gap-0.5 font-medium text-gray-800">
              <Star size={12} className="text-warning fill-warning" />{rating}
              {vendor.ratingsCount > 0 && <span className="text-gray-400 font-normal">({vendor.ratingsCount})</span>}
            </span>
          )}
          {vendor.estimatedPrepTime != null && (
            <span className="flex items-center gap-0.5"><Clock size={12} />{vendor.estimatedPrepTime} د</span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <Truck size={12} />
          {vendorUsesZones(zonesCfg, vendor.id) ? 'توصيل حسب منطقتك'
            : vendor.deliveryFee > 0 ? `توصيل ${Number(vendor.deliveryFee).toLocaleString('en-US')} د.ع` : 'توصيل مجاني'}
        </p>
      </div>
    </Link>
  )
}

const VendorsSection = ({ section }) => {
  const vendors = section.data || []
  if (vendors.length === 0) return null

  return (
    <section className="py-5 md:py-6">
      <div className="container-main">
        <SectionHeader title={section.titleAr || section.title} subtitle={section.subtitleAr || section.subtitle}
          to={`/stores?section=${section.id}`} />
        <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 overflow-x-auto md:overflow-visible snap-x scroll-px-4 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {vendors.map(vendor => <StoreCardMini key={vendor.id} vendor={vendor} />)}
        </div>
      </div>
    </section>
  )
}

// ===========================
// Main Page
// ===========================

const HomePage = ({ page = SCOPE.GENERAL }) => {
  const grocery   = page === SCOPE.GROCERY
  const navigate  = useNavigate()
  const { success, error: showError } = useToast()
  const { isAuthenticated } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const { data: homeData, isLoading: homeLoading, isError: homeError, refetch: refetchHome } = useHomeData(page)
  const { data: bannersData, isLoading: bannersLoading } = useHomeBanners(page)
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(true)

  const banners  = bannersData || homeData?.banners || []
  const configuredSections = homeData?.sections?.filter(s => s.isActive).sort((a,b) => a.displayOrder - b.displayOrder) || []

  // صفحة السوبرماركت قبل أن تُضاف لها أقسام: الأكثر مبيعاً فيه تلقائياً
  const needsGroceryFallback = grocery && !homeLoading && configuredSections.length === 0
  const { data: groceryTop } = useAdvancedFilter(
    { scope: SCOPE.GROCERY, isActive: true, isAvailable: true, sortBy: 'sales', pageSize: 12 }, needsGroceryFallback)
  const sections = needsGroceryFallback && groceryTop?.items?.length
    ? [{ id: 'grocery-top', type: 'featured_products', page: SCOPE.GROCERY, isActive: true, titleAr: 'الأكثر مبيعاً في السوبرماركت', data: groceryTop.items }]
    : configuredSections

  // شريط الفئات (التي فيها منتجات فقط — فئة فارغة تفتح صفحة بلا نتائج):
  // الرئيسية → الفئات الرئيسية خارج السوبرماركت | السوبرماركت → فئاته الفرعية (أو الرئيسية إن لم تكن لها فروع)
  const withProducts = (categoriesData || []).filter(c => c.productsCount > 0)
  const groceryRoots = withProducts.filter(c => !c.parentId && isGroceryCategory(c))
  const groceryChildren = withProducts.filter(c => groceryRoots.some(r => r.id === c.parentId))
  const barCategories = grocery
    ? (groceryChildren.length > 0 ? groceryChildren : groceryRoots)
    : withProducts.filter(c => !c.parentId && !isGroceryCategory(c))


  const features = [
    { icon: Truck,       title: 'توصيل سريع',  desc: 'خلال 24 ساعة'  },
    { icon: Shield,      title: 'ضمان الجودة', desc: 'منتجات أصلية'  },
    { icon: Headphones,  title: 'دعم متواصل',  desc: 'خدمة 24/7'     },
    { icon: CreditCard,  title: 'دفع آمن',     desc: 'طرق متعددة'    },
  ]

  const handleAddToCart = async ({ id, quantity = 1 }) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try {
      // المنتج ذو الخيارات (مقاس/لون) يُفتح لاختيارها بدل إضافته بدون خيار
      const variants = await variantsService.getVariants(id).catch(() => [])
      if (variantsService.hasVariants(variants)) { navigate(`/products/${id}`); return }
      await addToCart(id, quantity)
      success('تمت الإضافة للسلة')
    }
    catch (err) { showError(err.message || 'فشل إضافة المنتج') }
  }

  const handleToggleWishlist = async (p) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await toggleWishlist(typeof p === 'string' ? p : p.id); success('تم') }
    catch { showError('فشلت العملية') }
  }

  return (
    <div className="min-h-screen">

      {/* السلايدر العلوي — من الحافة للحافة على الهاتف */}
      {grocery && !bannersLoading && banners.length === 0
        ? <GroceryHero />
        : <HeroSlider banners={banners} loading={bannersLoading} />}

      {/* الفئات: دوائر بصورة واسم تحتها — تمرير أفقي على الهاتف */}
      <section className="pt-4 lg:pt-8">
        <div className="flex gap-3 lg:gap-6 overflow-x-auto hide-scrollbar px-4 pb-1 lg:container-main lg:flex-wrap lg:justify-center lg:overflow-visible">
          {/* العروض — بنفس روح زر العروض في الشريط السفلي: تدرّج، أيقونة تهتز، ونبض */}
          <Link to={`/products?hasDiscount=true${grocery ? '&scope=grocery' : ''}`} className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
            <span className="relative w-[72px] h-[72px] lg:w-24 lg:h-24 rounded-full overflow-hidden bg-gradient-to-br from-rose-500 via-red-500 to-orange-400 shadow-md shadow-rose-500/30 flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-white/15" aria-hidden="true" />
              <span className="relative w-11 h-11 lg:w-14 lg:h-14 rounded-full bg-white/20 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-white/40 motion-safe:animate-soft-ping" aria-hidden="true" />
                <BadgePercent size={26} strokeWidth={2.2} className="relative text-white motion-safe:animate-wiggle" />
              </span>
            </span>
            <span className="mt-2 text-xs lg:text-sm font-bold text-rose-600 leading-tight">العروض</span>
          </Link>

          {/* مدخل السوبرماركت — قسم منفصل عن بقية المنتجات */}
          {!grocery && (
            <Link to={SUPERMARKET_PATH} className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
              <span className="relative w-[72px] h-[72px] lg:w-24 lg:h-24 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/30 flex items-center justify-center group-active:scale-95 transition-transform">
                <span className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-white/15" aria-hidden="true" />
                <ShoppingBasket size={30} strokeWidth={2.1} className="relative text-white lg:w-9 lg:h-9" />
              </span>
              <span className="mt-2 text-xs lg:text-sm font-bold text-emerald-600 leading-tight">السوبرماركت</span>
            </Link>
          )}

          {categoriesLoading
            ? [...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center gap-2">
                <Skeleton className="w-[72px] h-[72px] lg:w-24 lg:h-24 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))
            : barCategories.map((cat, i) => (
              <Link key={cat.id} to={`/products?category=${cat.id}`}
                className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
                <span className="w-[72px] h-[72px] lg:w-24 lg:h-24 rounded-full product-media overflow-hidden flex items-center justify-center group-active:scale-95 transition-transform">
                  <CategoryIcon category={cat} index={i} className="w-[80%] h-[80%]" emojiClassName="text-[34px] lg:text-[44px]" />
                </span>
                <span className="mt-2 text-xs lg:text-sm font-medium text-gray-800 leading-tight line-clamp-2">{cat.nameAr || cat.name}</span>
              </Link>
            ))}

          {/* عرض كل الفئات — في السوبرماركت: كل منتجاته */}
          <Link to={grocery ? '/products?scope=grocery' : '/categories'} className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
            <span className="w-[72px] h-[72px] lg:w-24 lg:h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white group-active:scale-95 transition-all">
              <LayoutGrid size={28} fill="currentColor" />
            </span>
            <span className="mt-2 text-xs lg:text-sm font-bold text-primary leading-tight">{grocery ? 'كل المنتجات' : 'عرض الكل'}</span>
          </Link>
        </div>
      </section>

      {/* اشترِ مجدداً — للمسجّل الذي له طلبات سابقة */}
      <BuyAgainSection page={page} onAddToCart={handleAddToCart} onToggleWishlist={handleToggleWishlist} isInWishlist={isInWishlist} />

      {/* فشل تحميل الأقسام: رسالة وإعادة محاولة بدل صفحة تختفي أقسامها بصمت */}
      {homeError && !homeData && (
        <section className="container-main py-5">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-red-700 font-medium">تعذّر تحميل المنتجات — تحقق من الاتصال</p>
            <button onClick={() => refetchHome()} className="mt-3 px-5 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-medium">
              إعادة المحاولة
            </button>
          </div>
        </section>
      )}

      {/* Dynamic Sections من الـ API */}
      {homeLoading ? (
        <section className="py-5 md:py-6">
          <div className="container-main">
            <Skeleton className="h-7 w-48 mb-4" />
            <div className="flex gap-3 md:gap-4 overflow-hidden">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className={`${RAIL_CARD_WIDTH} flex-shrink-0 aspect-square rounded-2xl`} />)}
            </div>
          </div>
        </section>
      ) : sections.map((section, idx) => {
        // تبادل الخلفية
        const bg = ''

        if (section.type === 'top_vendors') {
          return <div key={section.id} className={bg}><VendorsSection section={section} /></div>
        }

        if (section.type === 'banners') {
          return <div key={section.id} className={bg}><BannerBlockSection section={section} /></div>
        }

        if (section.type === 'flash_deals') {
          return (
            <div key={section.id} className={bg}>
              <FlashDealsSection section={section} onAddToCart={handleAddToCart}
                onToggleWishlist={handleToggleWishlist} isInWishlist={isInWishlist} />
            </div>
          )
        }

        // أنواع لا تعرضها الصفحة (مثل أفضل الفئات) بدل عرضها كبطاقات منتجات معطوبة
        if (section.type !== 'featured_products' && section.type !== 'custom_products') return null

        // featured_products أو custom_products
        return (
          <div key={section.id} className={bg}>
            <ProductSection
              section={section}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              isInWishlist={isInWishlist}
            />
          </div>
        )
      })}

      {/* النقاط والمتاجر المحلية */}
      {!grocery && <PromoTiles />}

      {/* Features — على الهاتف: 3 في صف واحد بشكل مضغوط */}
      <section className="bg-white border-y border-gray-100 mt-2">
        <div className="container-main py-3 md:py-5">
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className={`${i === 3 ? 'hidden lg:flex' : 'flex'} items-center gap-1.5 md:gap-3 min-w-0`}>
                <div className="md:w-11 md:h-11 md:bg-primary/10 md:rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="text-primary w-5 h-5 md:w-[22px] md:h-[22px]" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-[11px] md:text-sm leading-tight truncate">{title}</p>
                  <p className="text-[10px] md:text-xs text-gray-500 leading-tight truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* تثبيت التطبيق + المساعدة (بديل النشرة البريدية) */}
      {!grocery && <AppPromoSection />}
    </div>
  )
}

export default HomePage