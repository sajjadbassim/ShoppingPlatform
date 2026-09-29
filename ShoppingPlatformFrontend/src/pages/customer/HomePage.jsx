import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Truck, Shield, Headphones, CreditCard, Store, Clock } from 'lucide-react'
import ProductCard from '../../components/common/ProductCard'
import { ProductCardSkeleton, Skeleton } from '../../components/common/Loading'
import { useCategories } from '../../hooks/useCategories'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/common/Toast'
import { getImageUrl } from '../../utils/imageHelper'
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

// رابط يدعم المسارات الداخلية والروابط الخارجية
const BannerLink = ({ to, children, ...props }) =>
  isExternalLink(to)
    ? <a href={to} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
    : <Link to={to} {...props}>{children}</Link>

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

  useEffect(() => {
    if (displaySlides.length <= 1) return
    const t = setInterval(() => setCurrent(p => (p + 1) % displaySlides.length), 5000)
    return () => clearInterval(t)
  }, [displaySlides.length])

  if (loading) return <div className="h-[400px] lg:h-[500px] bg-gray-200 animate-pulse" />

  return (
    <section className="relative h-[400px] lg:h-[500px] overflow-hidden">
      {displaySlides.map((slide, i) => {
        const imgUrl = slide.imageUrl?.startsWith('/') ? getImageUrl(slide.imageUrl) : slide.imageUrl
        const link   = slide.id?.startsWith('f') ? slide.linkUrl : getBannerLink(slide)
        return (
          <BannerLink key={slide.id} to={link}
            tabIndex={i === current ? 0 : -1}
            aria-hidden={i !== current}
            className={`absolute inset-0 block cursor-pointer transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
            <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent" />
            <div className="container-main h-full flex items-center relative z-10">
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
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronRight size={22} />
          </button>
          <button onClick={() => setCurrent(p => (p + 1) % displaySlides.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {displaySlides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2.5 rounded-full transition-all ${i === current ? 'bg-white w-8' : 'bg-white/50 w-2.5'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ===========================
// Section Renderer
// ===========================

const ProductSection = ({ section, onAddToCart, onToggleWishlist, isInWishlist }) => {
  const products = (section.data || []).map(p => ({
    ...formatProduct(p),
    isWishlisted: isInWishlist(p.id),
  }))

  if (products.length === 0) return null

  return (
    <section className="py-10">
      <div className="container-main">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{section.titleAr || section.title}</h2>
            {(section.subtitleAr || section.subtitle) && (
              <p className="text-gray-500 mt-1">{section.subtitleAr || section.subtitle}</p>
            )}
          </div>
          <Link to={section.filterCategoryId ? `/products?category=${section.filterCategoryId}` : '/products'}
            className="text-primary hover:underline flex items-center gap-1 text-sm">
            عرض الكل <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="product-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product}
              onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
          ))}
        </div>
      </div>
    </section>
  )
}

const VendorsSection = ({ section }) => {
  const vendors = section.data || []
  if (vendors.length === 0) return null

  return (
    <section className="py-10 bg-gray-50">
      <div className="container-main">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{section.titleAr || section.title}</h2>
          <Link to="/stores" className="text-primary hover:underline flex items-center gap-1 text-sm">
            عرض الكل <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {vendors.map(vendor => {
            const logo = vendor.logoUrl?.startsWith('/') ? getImageUrl(vendor.logoUrl) : vendor.logoUrl
            return (
              <Link key={vendor.id} to={`/stores/${vendor.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                  {logo
                    ? <img src={logo} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                    : <Store size={24} className="text-gray-400" />
                  }
                </div>
                <p className="font-medium text-gray-900 text-sm truncate">{vendor.nameAr || vendor.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Clock size={11} className="text-gray-400" />
                  <p className="text-xs text-gray-400">{vendor.estimatedPrepTime} د</p>
                </div>
                <p className="text-xs text-primary mt-1">{vendor.deliveryFee.toLocaleString()} د.ع توصيل</p>
              </Link>
            )
          })}
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
  const { isAuthenticated } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const { data: homeData, isLoading: homeLoading } = useHomeData()
  const { data: bannersData, isLoading: bannersLoading } = useHomeBanners()
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(true)

  const banners  = bannersData || homeData?.banners || []
  const sections = homeData?.sections?.filter(s => s.isActive).sort((a,b) => a.displayOrder - b.displayOrder) || []
  const categories = (categoriesData || [])
    .filter(c => !c.parentId)
    .slice(0, 8)

  const categoryColors = ['bg-green-100','bg-blue-100','bg-purple-100','bg-orange-100','bg-red-100','bg-pink-100','bg-yellow-100','bg-cyan-100']
  const categoryIcons  = ['🛒','👕','📱','🏠','⚽','💄','🎮','📚']

  const features = [
    { icon: Truck,       title: 'توصيل سريع',  desc: 'خلال 24 ساعة'  },
    { icon: Shield,      title: 'ضمان الجودة', desc: 'منتجات أصلية'  },
    { icon: Headphones,  title: 'دعم متواصل',  desc: 'خدمة 24/7'     },
    { icon: CreditCard,  title: 'دفع آمن',     desc: 'طرق متعددة'    },
  ]

  const handleAddToCart = async ({ id, quantity = 1 }) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await addToCart(id, quantity); success('تمت الإضافة للسلة') }
    catch (err) { showError(err.message || 'فشل إضافة المنتج') }
  }

  const handleToggleWishlist = async (p) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await toggleWishlist(typeof p === 'string' ? p : p.id); success('تم') }
    catch { showError('فشلت العملية') }
  }

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <HeroSlider banners={banners} loading={bannersLoading} />

      {/* Features */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="container-main py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-10 bg-gray-50">
        <div className="container-main">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">الفئات الشائعة</h2>
            <Link to="/categories" className="text-primary hover:underline flex items-center gap-1 text-sm">
              عرض الكل <ArrowLeft size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {categoriesLoading ? (
              [...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : categories.map((cat, i) => {
              const iconUrl = cat.iconUrl?.startsWith('/') ? getImageUrl(cat.iconUrl) : cat.iconUrl
              return (
                <Link key={cat.id} to={`/products?category=${cat.id}`} className="group">
                  <div className={`${categoryColors[i % categoryColors.length]} rounded-xl p-3 text-center group-hover:scale-105 transition-transform`}>
                    {iconUrl ? (
                      <img src={iconUrl} alt={cat.nameAr || cat.name} className="w-10 h-10 mx-auto mb-1.5 object-contain" />
                    ) : (
                      <span className="text-3xl block mb-1.5">{categoryIcons[i % categoryIcons.length]}</span>
                    )}
                    <p className="font-medium text-gray-900 text-xs truncate">{cat.nameAr || cat.name}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Dynamic Sections من الـ API */}
      {homeLoading ? (
        <section className="py-10">
          <div className="container-main">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="product-grid">
              {[...Array(5)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>
        </section>
      ) : sections.map((section, idx) => {
        // تبادل الخلفية
        const bg = idx % 2 === 0 ? '' : 'bg-gray-50'

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

      {/* Newsletter */}
      <section className="py-12 bg-primary">
        <div className="container-main text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">اشترك في نشرتنا البريدية</h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">احصل على أحدث العروض والخصومات في بريدك الإلكتروني</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder="بريدك الإلكتروني"
              className="flex-1 h-12 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50" />
            <button type="submit"
              className="h-12 px-6 bg-white text-primary font-medium rounded-xl hover:bg-gray-100 transition-colors">
              اشترك
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

export default HomePage