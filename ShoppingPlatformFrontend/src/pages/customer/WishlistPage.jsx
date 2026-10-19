import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, Trash2, ShoppingCart, Share2, Store } from 'lucide-react'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { ConfirmModal } from '../../components/common/Modal'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { getPrimaryImage, IMG_SIZE } from '../../utils/imageHelper'
import { variantsService } from '../../services/variantsService'

const isInStock = (item) => item.product?.isAvailable && item.product?.stockQuantity > 0

// المنتج ذو الخيارات (مقاس/لون) لا يُضاف بلا اختيار — الخادم يرفضه
const hasOptions = async (productId) =>
  variantsService.hasVariants(await variantsService.getVariants(productId).catch(() => []))

// صف منتج مضغوط (الهاتف): كل التفاصيل ظاهرة دون تمرير
const WishlistRow = ({ item, onAddToCart, onRemove }) => {
  const p = item.product || {}
  const img = getPrimaryImage(p, IMG_SIZE.THUMB)
  const inStock = p.isAvailable && p.stockQuantity > 0
  const hasDiscount = p.originalPrice && p.originalPrice > p.price
  return (
    <div className="flex gap-3 bg-white rounded-2xl border border-gray-200 p-3">
      <Link to={`/products/${item.productId}`} className="relative w-24 h-24 lg:w-32 lg:h-32 flex-shrink-0 rounded-xl product-media overflow-hidden">
        {img
          ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-300"><ShoppingCart size={28} /></div>}
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-0.5">غير متوفر</span>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col">
        {p.vendorName && (
          <p className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
            <Store size={11} className="flex-shrink-0" />{p.vendorName}
          </p>
        )}
        <Link to={`/products/${item.productId}`} className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 mt-0.5">
          {p.nameAr || p.name}
        </Link>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-bold text-primary">{(p.price || 0).toLocaleString('en-US')} د.ع</span>
          {hasDiscount && <span className="text-xs text-gray-400 line-through">{p.originalPrice.toLocaleString('en-US')}</span>}
        </div>

        <div className="flex items-center gap-2 mt-auto pt-2">
          <button onClick={() => onAddToCart(item)} disabled={!inStock}
            className="flex-1 h-9 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:bg-gray-200 disabled:text-gray-400">
            <ShoppingCart size={14} />
            {inStock ? 'أضف للسلة' : 'غير متوفر'}
          </button>
          <button onClick={() => onRemove(item.productId)}
            className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center active:bg-red-50 active:text-red-500"
            aria-label="إزالة من المفضلة">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

const WishlistPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()
  
  // Stores
  const { isAuthenticated } = useAuthStore()
  const { 
    items: wishlistItems, 
    isLoading,
    error: loadError,
    fetchWishlist,
    removeItem, 
    clearWishlist, 
  } = useWishlistStore()
  const { addItem: addToCart } = useCartStore()
  
  const [showClearModal, setShowClearModal] = useState(false)
  const [addingAll, setAddingAll] = useState(false)

  // ✅ جلب المفضلات عند التحميل
  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist().catch(err => {
        console.error('Error loading wishlist:', err)
      })
    }
  }, [isAuthenticated])

  // حذف منتج من المفضلة
  const handleRemoveItem = async (productId) => {
    try {
      await removeItem(productId)
      success('تم حذف المنتج من المفضلة')
    } catch (err) {
      error('فشل الحذف من المفضلة')
    }
  }

  // مسح كل المفضلة
  const handleClearWishlist = async () => {
    try {
      await clearWishlist()
      setShowClearModal(false)
      success('تم مسح قائمة المفضلة')
    } catch (err) {
      error('فشل مسح المفضلة')
    }
  }

  // إضافة منتج للسلة
  const handleAddToCart = async (item) => {
    if (!isAuthenticated) {
      error('يجب تسجيل الدخول أولاً')
      navigate('/login')
      return
    }

    try {
      if (await hasOptions(item.productId)) {
        navigate(`/products/${item.productId}`)
        return
      }
      await addToCart(item.productId, 1)
      success('تمت الإضافة للسلة')
    } catch (err) {
      error(err.message || 'فشل إضافة المنتج للسلة')
    }
  }

  // إضافة كل المنتجات المتوفرة للسلة
  const handleAddAllToCart = async () => {
    if (!isAuthenticated) {
      error('يجب تسجيل الدخول أولاً')
      navigate('/login')
      return
    }

    const inStockItems = wishlistItems.filter(isInStock)

    if (inStockItems.length === 0) {
      error('لا توجد منتجات متوفرة')
      return
    }

    // كل منتج على حدة: فشل منتج لا يوقف البقية، وذو الخيارات يُترك ليختار العميل مقاسه/لونه
    // الزر معطّل أثناء العمل — ضغطه مرتين كان يضيف كل منتج مرتين
    if (addingAll) return
    setAddingAll(true)
    let added = 0, needOptions = 0, failed = 0
    for (const item of inStockItems) {
      try {
        if (await hasOptions(item.productId)) { needOptions++; continue }
        await addToCart(item.productId, 1)
        added++
      } catch {
        failed++
      }
    }
    setAddingAll(false)
    if (added > 0) success(`تمت إضافة ${added} منتج للسلة`)
    if (needOptions > 0) error(`${needOptions} منتج يحتاج اختيار المقاس أو اللون — افتحه من القائمة وأضفه`)
    if (failed > 0) error(`تعذّرت إضافة ${failed} منتج`)
  }

  // مشاركة المفضلة
  // رابط /wishlist خاص بكل حساب (يفتح مفضلة من يفتحه)، فنشارك المنتجات نفسها بروابطها
  const handleShare = async () => {
    const lines = wishlistItems.slice(0, 20).map(item =>
      `• ${item.product?.nameAr || item.product?.name || 'منتج'}: ${window.location.origin}/products/${item.productId}`)
    const text = `مفضلتي في منصة واسط:\n${lines.join('\n')}`
    if (navigator.share) {
      try { await navigator.share({ title: 'مفضلتي - منصة واسط', text }) } catch { /* ألغى المستخدم */ }
    } else {
      try {
        await navigator.clipboard.writeText(text)
        success('تم نسخ قائمة المفضلة')
      } catch {
        error('تعذّر النسخ — المتصفح لا يسمح بالوصول للحافظة')
      }
    }
  }

  const breadcrumbItems = [{ label: 'المفضلة' }]

  // حساب الإحصائيات
  const inStockCount = wishlistItems.filter(isInStock).length
  const outOfStockCount = wishlistItems.length - inStockCount
  const totalPrice = wishlistItems.reduce((sum, item) => sum + (item.product?.price || 0), 0)

  // التحميل الأول فقط — الحذف والإضافة يضبطان isLoading أيضاً، ولا نخفي القائمة أثناءهما
  if (isLoading && wishlistItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // المفضلة فارغة
  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container-main py-6">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            {/* فشل التحميل ليس "فارغة" — العميل قد يظن أن مفضلته ضاعت */}
            {loadError ? (
              <div className="text-center">
                <p className="text-red-700 font-medium">تعذّر تحميل المفضلة</p>
                <Button variant="outline" className="mt-4" onClick={() => fetchWishlist().catch(() => {})}>
                  إعادة المحاولة
                </Button>
              </div>
            ) : (
            <EmptyState
              type="wishlist"
              title="قائمة المفضلة فارغة"
              description="لم تقم بإضافة أي منتجات إلى المفضلة بعد"
              action={
                <Button variant="primary" onClick={() => navigate('/products')}>
                  تصفح المنتجات
                </Button>
              }
            />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-4 lg:py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6 hidden lg:block" />

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Heart size={22} className="text-red-500" fill="currentColor" />
                المفضلة
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {wishlistItems.length} منتج • <span className="font-bold text-primary">{totalPrice.toLocaleString('en-US')} د.ع</span>
                {outOfStockCount > 0 && <span className="text-red-500"> • {outOfStockCount} غير متوفر</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleShare} aria-label="مشاركة"
                className="w-10 h-10 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center">
                <Share2 size={18} />
              </button>
              <button onClick={() => setShowClearModal(true)} aria-label="مسح الكل"
                className="w-10 h-10 rounded-full border border-red-200 text-red-500 flex items-center justify-center">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          {inStockCount > 0 && (
            <button onClick={handleAddAllToCart} disabled={addingAll}
              className="w-full lg:w-auto lg:px-8 h-11 mt-4 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              <ShoppingCart size={18} />
              إضافة الكل للسلة ({inStockCount})
            </button>
          )}
        </div>

        {/* المنتجات: صف لكل منتج — عمودان على الشاشات الكبيرة */}
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {wishlistItems.map(item => (
            <WishlistRow key={item.id} item={item} onAddToCart={handleAddToCart} onRemove={handleRemoveItem} />
          ))}
        </div>

      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearWishlist}
        title="مسح المفضلة"
        message="هل أنت متأكد من مسح جميع المنتجات من قائمة المفضلة؟"
        type="danger"
        confirmText="مسح الكل"
      />
    </div>
  )
}

export default WishlistPage