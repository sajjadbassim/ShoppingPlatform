import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { onPullRefresh } from '../../utils/pullRefresh'
import PlatformLogo from '../../components/social/PlatformLogo'
import TikTokVideosTab from '../../components/tiktok/TikTokVideosTab'
import { MapPin, Phone, Clock, Share2, Heart, Package, ChevronLeft, AlertCircle, DollarSign, Star } from 'lucide-react'
import ProductCard from '../../components/common/ProductCard'
import { Skeleton } from '../../components/common/Loading'
import Breadcrumb from '../../components/common/Breadcrumb'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs'
import { useToast } from '../../components/common/Toast'
import { useVendor } from '../../hooks/useVendors'
import { useProductsByVendor } from '../../hooks/useProducts'
import { getVendorLogo, getVendorCover, getPrimaryImage } from '../../utils/imageHelper'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'

const StoreDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const { isAuthenticated } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const { data: store, isLoading, isError, error } = useVendor(id)
  const { data: productsData, isLoading: productsLoading } = useProductsByVendor(id)
  const products = productsData || []

  // منشورات حسابات التواصل للمتجر (تيك توك + إنستغرام) — التبويب يظهر فقط إن وُجد محتوى ظاهر
  const { data: socialFeed } = useQuery({
    queryKey: ['social-store-feed', id],
    queryFn: async () => { const r = await apiGet(API_ENDPOINTS.SOCIAL.STORE_FEED(id)); return r.data?.data ?? r.data },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
  const socialItems = socialFeed?.items || []
  const socialPlatforms = [...new Set((socialFeed?.accounts || []).map(a => a.platform))]

  // عند فتح المتجر أو سحبه للتحديث: جلب آخر المنشورات من المنصات (الخادم يحدّ تكرار المزامنة لكل متجر)
  const queryClient = useQueryClient()
  const [refreshingVideos, setRefreshingVideos] = useState(false)
  const refreshVideos = useCallback(() => {
    if (!id) return Promise.resolve()
    setRefreshingVideos(true)
    return apiPost(API_ENDPOINTS.SOCIAL.STORE_FEED_REFRESH(id))
      .then(r => queryClient.setQueryData(['social-store-feed', id], r.data?.data ?? r.data))
      .catch(() => { /* تبقى آخر نسخة محفوظة */ })
      .finally(() => setRefreshingVideos(false))
  }, [id, queryClient])
  const refreshedFor = useRef(null)
  useEffect(() => {
    if (!id || refreshedFor.current === id) return
    refreshedFor.current = id
    refreshVideos()
  }, [id, refreshVideos])
  useEffect(() => onPullRefresh(refreshVideos), [refreshVideos])
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'videos' && socialItems.length > 0 ? 'videos' : searchParams.get('tab') === 'about' ? 'about' : 'products'
  const setTab = (value) => setSearchParams(value === 'products' ? {} : { tab: value }, { replace: true })

  const handleAddToCart = async ({ id: productId, quantity = 1 }) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await addToCart(productId, quantity); success('تمت الإضافة للسلة') }
    catch (err) { showError(err.message || 'فشل إضافة المنتج') }
  }

  const handleToggleWishlist = async (p) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await toggleWishlist(typeof p === 'string' ? p : p.id); success('تمت الإضافة للمفضلة') }
    catch { showError('فشلت العملية') }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) { try { await navigator.share({ title: store?.nameAr || store?.name, url }) } catch {} }
    else { navigator.clipboard.writeText(url); success('تم نسخ الرابط') }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50">
      <Skeleton className="h-48 lg:h-64" />
      <div className="container-main">
        <div className="bg-white rounded-xl border border-gray-200 -mt-16 relative z-10 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            <Skeleton className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl" />
            <div className="flex-1"><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>
          </div>
        </div>
      </div>
    </div>
  )

  if (isError || !store) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">المتجر غير موجود</h2>
        <p className="text-gray-600 mb-4">{error?.message || 'لم نتمكن من العثور على هذا المتجر'}</p>
        <Button variant="primary" onClick={() => navigate('/stores')}>تصفح المتاجر</Button>
      </div>
    </div>
  )

  const breadcrumbItems = [{ label: 'المتاجر', path: '/stores' }, { label: store.nameAr || store.name }]
  const logoUrl = getVendorLogo(store)
  const coverUrl = getVendorCover(store)

  const formattedProducts = products.slice(0, 8).map(p => ({
    id: p.id, name: p.nameAr || p.name,
    image: p.primaryImageUrl || getPrimaryImage(p),
    price: p.price, originalPrice: p.originalPrice,
    rating: p.rating || 0, reviewsCount: p.reviewsCount || 0,
    storeName: store.nameAr || store.name,
    vendorId: store.id,
    inStock: p.isAvailable && p.stockQuantity > 0,
    isWishlisted: isInWishlist(p.id),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover */}
      <div className="h-48 lg:h-64 relative bg-gradient-to-br from-primary/30 to-primary/60">
        {coverUrl && <img src={coverUrl} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="container-main">
        <div className="py-4"><Breadcrumb items={breadcrumbItems} /></div>

        {/* Store Header */}
        <div className="bg-white rounded-xl border border-gray-200 -mt-20 relative z-10 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            {/* Logo */}
            <div className="w-24 h-24 lg:w-32 lg:h-32 bg-white rounded-2xl shadow-lg flex items-center justify-center text-5xl -mt-16 lg:-mt-20 border-4 border-white overflow-hidden flex-shrink-0">
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} /> : <span>🏪</span>}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{store.nameAr || store.name}</h1>
                  {store.ratingsCount > 0 ? (
                    <div className="flex items-center gap-1.5 mt-1.5" aria-label={`تقييم المتجر ${store.rating} من 5`}>
                      <span className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={16} className={i <= Math.round(store.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                        ))}
                      </span>
                      <b className="text-sm text-gray-900">{Number(store.rating).toFixed(1)}</b>
                      <span className="text-sm text-gray-500">({store.ratingsCount} {store.ratingsCount === 1 ? 'تقييم' : 'تقييمات'})</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1.5 flex items-center gap-1"><Star size={14} /> لا توجد تقييمات بعد</p>
                  )}
                  <p className="text-gray-500 mt-1 text-sm" dir="ltr">{store.phone}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={handleShare}>
                    <Share2 size={15} className="ml-1" />مشاركة
                  </Button>
                </div>
              </div>

              {/* Info chips */}
              <div className="flex flex-wrap gap-3 mt-4">
                {store.address && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <MapPin size={15} className="text-primary" />{store.address}
                  </span>
                )}
                {store.estimatedPrepTime > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock size={15} className="text-primary" />{store.estimatedPrepTime} دقيقة تحضير
                  </span>
                )}
                {store.deliveryFee > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <DollarSign size={15} className="text-primary" />{store.deliveryFee.toLocaleString()} د.ع توصيل
                  </span>
                )}
                {store.minOrderAmount > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Package size={15} className="text-primary" />حد أدنى {store.minOrderAmount.toLocaleString()} د.ع
                  </span>
                )}
              </div>
            </div>
          </div>

          {store.description && !store.description.includes('?') && (
            <p className="text-gray-600 mt-4 pt-4 border-t border-gray-200">{store.description}</p>
          )}

          {/* Policies */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <span>🚚</span>توصيل سريع
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <span>↩️</span>إرجاع خلال 14 يوم
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <span>🛡️</span>منتجات أصلية
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-6 border-b border-gray-200">
              <TabsList>
                <TabsTrigger value="products">المنتجات ({products.length})</TabsTrigger>
                {socialItems.length > 0 && (
                  <TabsTrigger value="videos">
                    <span className="inline-flex items-center gap-1.5">
                      {socialPlatforms.map(p => <PlatformLogo key={p} platform={p} className="w-4 h-4" />)}
                      المنشورات ({socialItems.length})
                    </span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="about">عن المتجر</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="products" className="p-6">
              {productsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
                </div>
              ) : formattedProducts.length === 0 ? (
                <EmptyState title="لا توجد منتجات" description="هذا المتجر لم يضف منتجات بعد" />
              ) : (
                <>
                  <div className="product-grid">
                    {formattedProducts.map(product => (
                      <ProductCard key={product.id} product={product}
                        onAddToCart={handleAddToCart} onToggleWishlist={handleToggleWishlist} />
                    ))}
                  </div>
                  {products.length > 8 && (
                    <div className="text-center mt-6">
                      <Link to={`/products?vendor=${store.id}`}>
                        <Button variant="outline">
                          عرض جميع المنتجات ({products.length})
                          <ChevronLeft size={18} className="mr-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {socialItems.length > 0 && (
              <TabsContent value="videos" className="p-0 sm:p-6">
                <TikTokVideosTab videos={socialItems} refreshing={refreshingVideos} />
              </TabsContent>
            )}

            <TabsContent value="about" className="p-6">
              <div className="space-y-5">
                {store.description && !store.description.includes('?') && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">عن المتجر</h3>
                    <p className="text-gray-600">{store.description}</p>
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">معلومات المتجر</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {store.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone size={16} className="text-primary" />
                        <div><p className="text-xs text-gray-400">الهاتف</p><p className="font-medium" dir="ltr">{store.phone}</p></div>
                      </div>
                    )}
                    {store.address && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <MapPin size={16} className="text-primary" />
                        <div><p className="text-xs text-gray-400">العنوان</p><p className="font-medium">{store.address}</p></div>
                      </div>
                    )}
                    {store.deliveryFee > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-primary">🚚</span>
                        <div><p className="text-xs text-gray-400">رسوم التوصيل</p><p className="font-medium">{store.deliveryFee.toLocaleString()} د.ع</p></div>
                      </div>
                    )}
                    {store.minOrderAmount > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Package size={16} className="text-primary" />
                        <div><p className="text-xs text-gray-400">الحد الأدنى للطلب</p><p className="font-medium">{store.minOrderAmount.toLocaleString()} د.ع</p></div>
                      </div>
                    )}
                    {store.estimatedPrepTime > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Clock size={16} className="text-primary" />
                        <div><p className="text-xs text-gray-400">وقت التحضير</p><p className="font-medium">{store.estimatedPrepTime} دقيقة</p></div>
                      </div>
                    )}
                    {store.createdAt && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-primary">📅</span>
                        <div><p className="text-xs text-gray-400">انضم للمنصة</p><p className="font-medium">{new Date(store.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' })}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default StoreDetailsPage