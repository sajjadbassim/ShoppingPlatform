import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Trash2, ShoppingCart, Share2 } from 'lucide-react'
import ProductCard from '../../components/common/ProductCard'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { ConfirmModal } from '../../components/common/Modal'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { getPrimaryImage } from '../../utils/imageHelper'

const WishlistPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()
  
  // Stores
  const { isAuthenticated } = useAuthStore()
  const { 
    items: wishlistItems, 
    isLoading,
    fetchWishlist,
    removeItem, 
    clearWishlist, 
    getCount 
  } = useWishlistStore()
  const { addItem: addToCart } = useCartStore()
  
  const [showClearModal, setShowClearModal] = useState(false)

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
      await addToCart(item.productId, 1)
      success('تمت الإضافة للسلة')
    } catch (err) {
      error('فشل إضافة المنتج للسلة')
    }
  }

  // إضافة كل المنتجات المتوفرة للسلة
  const handleAddAllToCart = async () => {
    if (!isAuthenticated) {
      error('يجب تسجيل الدخول أولاً')
      navigate('/login')
      return
    }

    const inStockItems = wishlistItems.filter(item => item.product?.isAvailable)
    
    if (inStockItems.length === 0) {
      error('لا توجد منتجات متوفرة')
      return
    }

    try {
      for (const item of inStockItems) {
        await addToCart(item.productId, 1)
      }
      success(`تمت إضافة ${inStockItems.length} منتج للسلة`)
    } catch (err) {
      error('فشل إضافة بعض المنتجات')
    }
  }

  // مشاركة المفضلة
  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'قائمة المفضلة - منصة واسط',
          url: url,
        })
      } catch (err) {
        // المستخدم ألغى المشاركة
      }
    } else {
      navigator.clipboard.writeText(url)
      success('تم نسخ الرابط')
    }
  }

  const breadcrumbItems = [{ label: 'المفضلة' }]

  // حساب الإحصائيات
  const inStockCount = wishlistItems.filter(item => item.product?.isAvailable).length
  const outOfStockCount = wishlistItems.length - inStockCount
  const totalPrice = wishlistItems.reduce((sum, item) => sum + (item.product?.price || 0), 0)

  // ✅ Loading
  if (isLoading) {
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Heart className="text-red-500" fill="currentColor" />
                المفضلة
              </h1>
              <p className="text-gray-500 mt-1">
                {wishlistItems.length} منتج • {inStockCount} متوفر
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 size={18} className="ml-1" />
                مشاركة
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowClearModal(true)}
                className="text-red-500 border-red-200 hover:bg-red-50"
              >
                <Trash2 size={18} className="ml-1" />
                مسح الكل
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddAllToCart}>
                <ShoppingCart size={18} className="ml-1" />
                إضافة الكل للسلة
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">إجمالي القيمة</p>
              <p className="text-xl font-bold text-primary">{totalPrice.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">متوفر</p>
              <p className="text-xl font-bold text-green-600">{inStockCount}</p>
            </div>
            {outOfStockCount > 0 && (
              <div>
                <p className="text-sm text-gray-500">غير متوفر</p>
                <p className="text-xl font-bold text-red-500">{outOfStockCount}</p>
              </div>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistItems.map(item => (
            <div key={item.id} className="relative group">
              <ProductCard
                product={{
                  id: item.productId,
                  name: item.product?.nameAr || item.product?.name,
image: item.product?.primaryImageUrl,
                  price: item.product?.price,
                  originalPrice: item.product?.originalPrice,
                  rating: item.product?.rating || 0,
                  reviewsCount: item.product?.reviewsCount || 0,
                  storeName: item.product?.vendorName,
                  inStock: item.product?.isAvailable && item.product?.stockQuantity > 0,
                }}
                onAddToCart={() => handleAddToCart(item)}
              />
              
              {/* Remove Button Overlay */}
              <button
                onClick={() => handleRemoveItem(item.productId)}
                className="absolute top-2 left-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="إزالة من المفضلة"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Out of Stock Notice */}
        {outOfStockCount > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-yellow-700 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              بعض المنتجات في قائمتك غير متوفرة حالياً. سنُعلمك عند توفرها.
            </p>
          </div>
        )}
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