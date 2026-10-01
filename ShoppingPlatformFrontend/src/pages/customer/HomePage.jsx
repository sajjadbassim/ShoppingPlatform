import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Truck, Shield, Headphones, CreditCard, Store, Star, LayoutGrid, Heart, Plus, Search, Clock, BadgePercent } from 'lucide-react'
import ProductCard from '../../components/common/ProductCard'
import AppPromoSection from '../../components/common/AppPromoSection'
import CategoryIcon from '../../components/common/CategoryIcon'
import { variantsService } from '../../services/variantsService'
import { ProductCardSkeleton, Skeleton } from '../../components/common/Loading'
import { useCategories } from '../../hooks/useCategories'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/common/Toast'
import { getImageUrl, getPrimaryImage, getVendorLogo } from '../../utils/imageHelper'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'

// ===========================
// Hooks
// ===========================

const useHomeData = () => useQuery({
  queryKey: ['home'],
  queryFn: async () => {
    const r = await apiGet('/api/Home')
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

const useHomeBanners = () => useQuery({
  queryKey: ['home-banners'],
  queryFn: async () => {
    const r = await apiGet('/api/Home/banners', { onlyActive: true })
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
  hasDiscount: p.hasDiscount,
  discountPercentage: p.discountPercentage,
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
  const sizeClass = 'aspect-[1600/656]'

  // على الهاتف: بطاقة بزوايا دائرية وهوامش، وعلى الشاشات الأكبر: عرض كامل
  if (loading) return (
    <div className="container-main pt-3 lg:pt-6">
      <div className={`${sizeClass} bg-gray-200 animate-pulse rounded-2xl lg:rounded-3xl`} />
    </div>
  )

  return (
    <div className="container-main pt-3 lg:pt-6">
    <section className={`relative ${sizeClass} overflow-hidden rounded-2xl lg:rounded-3xl shadow-sm`}
      onTouchStart={e => { swipedRef.current = false; setTouchStartX(e.touches[0].clientX) }}
      onTouchEnd={handleTouchEnd}
      // منع فتح رابط البنر بعد السحب
      onClickCapture={e => { if (swipedRef.current) { e.preventDefault(); swipedRef.current = false } }}>
      {displaySlides.map((slide, i) => {
        const imgUrl = slide.imageUrl?.startsWith('/') ? getImageUrl(slide.imageUrl) : slide.imageUrl
        const link   = slide.id?.startsWith('f') ? slide.linkUrl : getBannerLink(slide)
        return (
          <BannerLink key={slide.id} to={link}
            tabIndex={i === current ? 0 : -1}
            aria-hidden={i !== current}
            className={`absolute inset-0 block cursor-pointer transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
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
          <button onClick={() => setCurrent(p => (p - 1 + displaySlides.length) % displaySlides.length)}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronRight size={22} />
          </button>
          <button onClick={() => setCurrent(p => (p + 1) % displaySlides.length)}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className="hidden">
            {displaySlides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2.5 rounded-full transition-all ${i === current ? 'bg-white w-8' : 'bg-white/50 w-2.5'}`} />
            ))}
          </div>
        </>
      )}
    </section>

    {/* مؤشرات الشرائح تحت البنر على الهاتف */}
    {displaySlides.length > 1 && (
      <div className="flex justify-center gap-1.5 pt-3">
        {displaySlides.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} aria-label={`الشريحة ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === current ? 'bg-primary w-5' : 'bg-gray-300 w-1.5'}`} />
        ))}
      </div>
    )}
    </div>
  )
}

// ===========================
// Section Renderer
// ===========================

// بطاقة منتج مصغّرة للتمرير الأفقي: صورة، مفضلة، إضافة سريعة، اسم، سعر، تقييم
const MobileProductCard = ({ product, onAddToCart, onToggleWishlist, boxed = false, className = 'w-[38%] min-w-[140px]' }) => {
  const img = getPrimaryImage(product)
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discount = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : product.discountPercentage
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn?.() }
  return (
    <Link to={`/products/${product.id}`}
      className={`block ${className} flex-shrink-0 snap-start text-gray-900 ${boxed ? 'bg-white rounded-2xl p-2 shadow-sm' : ''}`}>
      <div className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden">
        {img
          ? <img src={img} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
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
        {onAddToCart && product.inStock !== false && (
          <button onClick={stop(() => onAddToCart({ id: product.id, quantity: 1 }))} aria-label="إضافة للسلة"
            className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-primary text-white shadow-md flex items-center justify-center active:scale-90 transition-transform">
            <Plus size={16} />
          </button>
        )}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug line-clamp-2 min-h-[2lh]">{product.name}</p>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm font-bold">{product.price?.toLocaleString()} د.ع</span>
        {hasDiscount && <span className="text-[11px] text-gray-400 line-through">{product.originalPrice.toLocaleString()}</span>}
      </div>
      {product.rating > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Star size={12} className="text-warning fill-warning" /> {Number(product.rating).toFixed(1)}
        </p>
      )}
    </Link>
  )
}

// تحية حسب الوقت + بحث سريع
const GreetingBar = ({ user }) => {
  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const firstName = user?.fullName?.split(' ')[0]
  return (
    <section className="container-main pt-4 lg:pt-6">
      <p className="text-lg lg:text-2xl font-bold text-gray-900">
        {greeting}{firstName ? `، ${firstName}` : ''} 👋
      </p>
      <p className="text-sm text-gray-500 mt-0.5">ماذا تريد أن تتسوّق اليوم؟</p>
      <button onClick={() => window.dispatchEvent(new Event('open-global-search'))}
        className="md:hidden mt-3 w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center gap-3 text-gray-400 text-sm">
        <Search size={18} className="text-primary" />
        ابحث عن منتج، متجر، أو فئة...
      </button>
    </section>
  )
}

// أقوى الخصومات — تُجمع من منتجات أقسام الصفحة نفسها
const DealsSection = ({ products, onAddToCart, onToggleWishlist }) => {
  if (products.length < 2) return null
  return (
    <section className="container-main pt-5 lg:pt-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-rose-500 via-red-500 to-orange-400 p-4 lg:p-6">
        <div className="absolute -top-10 -left-8 w-40 h-40 rounded-full bg-white/15" />
        <div className="absolute -bottom-12 left-1/3 w-32 h-32 rounded-full bg-yellow-300/25 blur-xl" />
        <div className="relative flex items-center justify-between mb-3 lg:mb-4">
          <div>
            <h2 className="text-lg lg:text-2xl font-bold text-white">🔥 خصومات لا تفوّت</h2>
            <p className="text-xs lg:text-sm text-white/85">أفضل الأسعار على منتجات مختارة</p>
          </div>
          <Link to="/products?hasDiscount=true"
            className="h-9 px-4 rounded-full bg-white text-red-600 text-sm font-bold flex items-center gap-1 flex-shrink-0">
            الكل <ArrowLeft size={15} />
          </Link>
        </div>
        <div className="relative flex gap-3 overflow-x-auto snap-x scroll-px-4 hide-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
          {products.map((p, i) => (
            <MobileProductCard key={p.id} product={p} boxed
              className={`w-[40%] min-w-[150px] lg:w-auto lg:min-w-0 ${i >= 5 ? 'lg:hidden' : ''}`}
              onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </div>
      </div>
    </section>
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

// رأس القسم: العنوان و"عرض الكل"
const SectionHeader = ({ title, subtitle, to }) => (
  <div className="flex items-center justify-between mb-3 md:mb-6">
    <div>
      <h2 className="text-lg md:text-2xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="hidden md:block text-gray-500 mt-1">{subtitle}</p>}
    </div>
    <Link to={to} className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
      عرض الكل <ArrowLeft size={16} className="hidden md:block" />
    </Link>
  </div>
)

const ProductSection = ({ section, onAddToCart, onToggleWishlist, isInWishlist }) => {
  const products = (section.data || []).map(p => ({
    ...formatProduct(p),
    isWishlisted: isInWishlist(p.id),
  }))

  if (products.length === 0) return null

  return (
    <section className="py-5 md:py-10">
      <div className="container-main">
        <SectionHeader
          title={section.titleAr || section.title}
          subtitle={section.subtitleAr || section.subtitle}
          to={section.filterCategoryId ? `/products?category=${section.filterCategoryId}` : '/products'} />

        {/* الهاتف: تمرير أفقي */}
        <div className="md:hidden flex gap-3 overflow-x-auto snap-x scroll-px-4 hide-scrollbar -mx-4 px-4">
          {products.map(product => (
            <MobileProductCard key={product.id} product={product} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </div>

        {/* الشاشات الأكبر: شبكة */}
        <div className="product-grid hidden md:grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product}
              onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </div>
      </div>
    </section>
  )
}

// المتاجر المميزة بأسلوب "القصص": شعار دائري بإطار ملوّن + الاسم + وقت التحضير
const VendorsSection = ({ section }) => {
  const vendors = section.data || []
  if (vendors.length === 0) return null

  return (
    <section className="py-5 md:py-10">
      <div className="container-main">
        <SectionHeader title={section.titleAr || section.title} to="/stores" />
        <div className="flex gap-4 lg:gap-10 lg:justify-center overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {vendors.map(vendor => {
            const logo = getVendorLogo(vendor)
            return (
              <Link key={vendor.id} to={`/stores/${vendor.id}`}
                className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
                <span className="p-[3px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-primary group-hover:scale-105 transition-transform">
                  <span className="block p-[3px] rounded-full bg-white">
                    <span className="w-16 h-16 lg:w-[88px] lg:h-[88px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {logo
                        ? <img src={logo} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <Store size={26} className="text-gray-400" />}
                    </span>
                  </span>
                </span>
                <span className="mt-2 text-xs lg:text-sm font-medium text-gray-900 leading-tight line-clamp-2">{vendor.nameAr || vendor.name}</span>
                {vendor.estimatedPrepTime != null && (
                  <span className="mt-0.5 flex items-center gap-0.5 text-[11px] text-gray-500">
                    <Clock size={11} />{vendor.estimatedPrepTime} د
                  </span>
                )}
              </Link>
            )
          })}

          {/* عرض كل المتاجر */}
          <Link to="/stores" className="group flex-shrink-0 w-[76px] lg:w-[104px] flex flex-col items-center text-center">
            <span className="p-[3px] rounded-full bg-gray-200">
              <span className="block p-[3px] rounded-full bg-white">
                <span className="w-16 h-16 lg:w-[88px] lg:h-[88px] rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                  <ArrowLeft size={24} />
                </span>
              </span>
            </span>
            <span className="mt-2 text-xs lg:text-sm font-medium text-primary">كل المتاجر</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ===========================
// Main Page
// ===========================

const HomePage = () => {
  const navigate  = useNavigate()
  const { success, error: showError } = useToast()
  const { isAuthenticated, user } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const { data: homeData, isLoading: homeLoading } = useHomeData()
  const { data: bannersData, isLoading: bannersLoading } = useHomeBanners()
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(true)

  const banners  = bannersData || homeData?.banners || []
  const sections = homeData?.sections?.filter(s => s.isActive).sort((a,b) => a.displayOrder - b.displayOrder) || []
  const allRootCategories = (categoriesData || []).filter(c => !c.parentId)

  // أقوى الخصومات من منتجات الأقسام (بدون تكرار، الأعلى خصماً أولاً)
  const dealProducts = (() => {
    const seen = new Set()
    return sections
      .filter(sec => sec.type !== 'top_vendors')
      .flatMap(sec => sec.data || [])
      .filter(p => p.originalPrice > p.price && !seen.has(p.id) && seen.add(p.id))
      .map(p => ({ ...formatProduct(p), isWishlisted: isInWishlist(p.id) }))
      .sort((a, b) => (1 - a.price / a.originalPrice) < (1 - b.price / b.originalPrice) ? 1 : -1)
      .slice(0, 10)
  })()


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

      {/* التحية والبحث */}
      <GreetingBar user={isAuthenticated ? user : null} />

      {/* شريط الفئات — تمرير أفقي على الهاتف، ويلتف على الشاشات الكبيرة */}
      <section className="pt-4">
        <div className="flex gap-2.5 lg:gap-3 overflow-x-auto hide-scrollbar px-4 pb-1 lg:container-main lg:flex-wrap lg:overflow-visible">
          <Link to="/categories" className="flex-shrink-0 w-[72px] h-[84px] lg:w-[104px] lg:h-[104px] rounded-2xl bg-primary/10 flex flex-col items-center justify-center gap-1.5">
            <LayoutGrid size={28} className="text-primary" fill="currentColor" />
            <span className="text-[11px] font-bold text-gray-900">الكل</span>
          </Link>
          {/* العروض — بنفس روح زر العروض في الشريط السفلي: تدرّج، أيقونة تهتز، ونبض */}
          <Link to="/products?hasDiscount=true" className="relative overflow-hidden flex-shrink-0 w-[72px] h-[84px] lg:w-[104px] lg:h-[104px] rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-400 shadow-md shadow-rose-500/30 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform">
            <span className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-white/15" aria-hidden="true" />
            <span className="relative w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-white/40 motion-safe:animate-soft-ping" aria-hidden="true" />
              <BadgePercent size={24} strokeWidth={2.2} className="relative text-white motion-safe:animate-wiggle" />
            </span>
            <span className="relative text-[11px] lg:text-xs font-bold text-white">العروض</span>
          </Link>
          {categoriesLoading
            ? [...Array(4)].map((_, i) => <Skeleton key={i} className="flex-shrink-0 w-[72px] h-[84px] lg:w-[104px] lg:h-[104px] rounded-2xl" />)
            : allRootCategories.map((cat, i) => {
              return (
                <Link key={cat.id} to={`/products?category=${cat.id}`}
                  className="flex-shrink-0 w-[72px] h-[84px] lg:w-[104px] lg:h-[104px] rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-1.5 px-1">
                  <CategoryIcon category={cat} index={i} className="w-8 h-8" emojiClassName="text-[26px]" />
                  <span className="text-[11px] font-medium text-gray-800 w-full text-center truncate">{cat.nameAr || cat.name}</span>
                </Link>
              )
            })}
        </div>
      </section>

      {/* Hero */}
      <HeroSlider banners={banners} loading={bannersLoading} />

      {/* أقوى الخصومات */}
      <DealsSection products={dealProducts} onAddToCart={handleAddToCart} onToggleWishlist={handleToggleWishlist} />

      {/* النقاط والمتاجر المحلية */}
      <PromoTiles />

      {/* Dynamic Sections من الـ API */}
      {homeLoading ? (
        <section className="py-5 md:py-10">
          <div className="container-main">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="product-grid hidden md:grid">
              {[...Array(5)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
            <div className="md:hidden flex gap-3 overflow-hidden">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="w-[38%] min-w-[140px] flex-shrink-0 aspect-square rounded-2xl" />)}
            </div>
          </div>
        </section>
      ) : sections.map((section, idx) => {
        // تبادل الخلفية
        const bg = ''

        if (section.type === 'top_vendors') {
          return <div key={section.id} className={bg}><VendorsSection section={section} /></div>
        }

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
      <AppPromoSection />
    </div>
  )
}

export default HomePage