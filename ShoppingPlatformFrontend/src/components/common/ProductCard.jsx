// src/components/common/ProductCard.jsx
import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Heart, Star, ShoppingCart, Plus, Store } from 'lucide-react'
import { getPrimaryImage } from '../../utils/imageHelper'
import { useProductVariants, variantKeys } from '../../hooks/useVariants'
import { variantsService } from '../../services/variantsService'

// أجهزة اللمس لا تدعم hover — تغيير محتوى الكرت عند "hover" يجعل iOS يحتاج ضغطتين لفتح المنتج
const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

// ===========================
// InlineVariantPicker
// ===========================

const InlineVariantPicker = ({ productId, basePrice, onConfirm }) => {
  const { data: variants = [], isLoading } = useProductVariants(productId)
  const [selectedValues, setSelectedValues] = useState({})

  const attributeOptions = variantsService.buildAttributeOptions(variants)
  const totalAttrs = attributeOptions.length
  const selectedVariant = totalAttrs > 0
    ? variantsService.findMatchingVariant(variants, selectedValues)
    : null
  const isComplete = Object.keys(selectedValues).length === totalAttrs && totalAttrs > 0
  const finalPrice = variantsService.getFinalPrice(basePrice, selectedVariant)

  if (isLoading) return (
    <div className="px-3 pb-3 pt-2 border-t border-gray-100">
      <div className="flex gap-1.5">
        {[1,2,3].map(i => <div key={i} className="h-6 w-10 bg-gray-200 rounded animate-pulse" />)}
      </div>
    </div>
  )

  if (!variantsService.hasVariants(variants)) return null

  return (
    <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2 bg-white"
      onClick={e => e.preventDefault()}>
      {attributeOptions.map(attr => (
        <div key={attr.attributeId}>
          <p className="text-xs text-gray-400 mb-1">{attr.nameAr}:</p>
          <div className="flex flex-wrap gap-1">
            {attr.values.map(val => {
              const isSelected = selectedValues[attr.nameAr] === val.valueAr
              const isUnavailable = !val.available
              return (
                <button key={val.id} disabled={isUnavailable}
                  onClick={e => {
                    e.preventDefault(); e.stopPropagation()
                    if (!isUnavailable)
                      setSelectedValues(prev => ({ ...prev, [attr.nameAr]: val.valueAr }))
                  }}
                  className={`px-2 py-0.5 rounded text-xs border transition-all ${
                    isSelected ? 'border-primary bg-primary text-white'
                    : isUnavailable ? 'border-gray-100 text-gray-300 line-through cursor-not-allowed'
                    : 'border-gray-300 hover:border-primary text-gray-700'
                  }`}>
                  {val.valueAr || val.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-primary">{finalPrice.toLocaleString()} د.ع</span>
        <button disabled={!isComplete || !selectedVariant}
          onClick={e => {
            e.preventDefault(); e.stopPropagation()
            if (isComplete && selectedVariant) onConfirm()
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isComplete && selectedVariant
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}>
          <ShoppingCart size={11} />
          {isComplete ? 'إضافة' : 'اختر'}
        </button>
      </div>
    </div>
  )
}

// ===========================
// ProductCard
// ===========================

const ProductCard = ({
  product,
  variant = 'default',
  onAddToCart,
  onToggleWishlist,
  className = '',
}) => {
  const [quantity] = useState(1)
  const [isWishlisted, setIsWishlisted] = useState(product?.isWishlisted || false)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const imageUrl = getPrimaryImage(product)

  const {
    id,
    name,
    price,
    originalPrice,
    rating,
    reviewsCount,
    discount,
    inStock = true,
    storeName,
    vendorId,
  } = product || {}

  const hasDiscount = originalPrice && originalPrice > price
  const discountPercent = hasDiscount
    ? Math.round((1 - price / originalPrice) * 100)
    : discount

  const { data: variantsList = [] } = useProductVariants(
    isHovered && variant === 'default' ? id : null
  )
  const hasVariants = variantsService.hasVariants(variantsList)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleAddToCart = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation()
    // على أجهزة اللمس لا يظهر منتقي الخيارات، فالمنتج ذو الخيارات يُفتح لاختيارها
    if (!canHover && variant === 'default') {
      try {
        const variants = await queryClient.fetchQuery({
          queryKey: variantKeys.list(id),
          queryFn: () => variantsService.getVariants(id),
          staleTime: 5 * 60 * 1000,
        })
        if (variantsService.hasVariants(variants)) {
          navigate(`/products/${id}`)
          return
        }
      } catch { /* نكمل الإضافة كالمعتاد */ }
    }
    onAddToCart?.({ ...product, quantity })
  }, [product, quantity, onAddToCart, variant, id, queryClient, navigate])

  const handleToggleWishlist = useCallback((e) => {
    e.preventDefault(); e.stopPropagation()
    setIsWishlisted(prev => !prev)
    onToggleWishlist?.(product)
  }, [product, onToggleWishlist])

  // ✅ مكون اسم البائع — يظهر في كل variants
  const StoreLabel = ({ extraClass = '' }) => {
    if (!storeName) return null
    return (
      <div
        className={`flex items-center gap-1 text-xs text-gray-500 truncate ${extraClass}`}
        onClick={e => e.preventDefault()}
      >
        <Store size={10} className="flex-shrink-0 text-gray-400" />
        {vendorId ? (
          <Link
            to={`/stores/${vendorId}`}
            onClick={e => e.stopPropagation()}
            className="truncate hover:text-primary transition-colors"
          >
            {storeName}
          </Link>
        ) : (
          <span className="truncate">{storeName}</span>
        )}
      </div>
    )
  }

  // ===== Default Variant =====
  if (variant === 'default') {
    return (
      <div
        className={`card group flex flex-col h-full overflow-hidden ${className}`}
        onMouseEnter={canHover ? () => setIsHovered(true) : undefined}
        onMouseLeave={canHover ? () => setIsHovered(false) : undefined}
      >
        <Link to={`/products/${id}`} className="flex flex-col flex-1">
          <div className="relative aspect-square bg-gray-100 overflow-hidden">
            {!imageError ? (
              <img src={imageUrl} alt={name} onError={() => setImageError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ShoppingCart size={48} />
              </div>
            )}

            {discountPercent > 0 && (
              <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-error text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                {discountPercent}% خصم
              </span>
            )}

            <button onClick={handleToggleWishlist}
              className={`absolute top-2 left-2 sm:top-3 sm:left-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                isWishlisted
                  ? 'bg-error text-white'
                  : 'bg-white/80 text-gray-600 hover:bg-white hover:text-error'
              }`}>
              <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>

            {!inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="bg-white text-gray-800 px-4 py-2 rounded-md font-medium">غير متوفر</span>
              </div>
            )}
          </div>

          <div className="p-2.5 sm:p-4 flex flex-col flex-1">
            {/* ✅ اسم البائع */}
            <StoreLabel extraClass="mb-1 sm:mb-1.5" />

            {/* ✅ ارتفاع ثابت يكفي سطرين دائماً — يمنع اختلاف مكان السعر والزر بين الكروت */}
            <h3 className="text-[13px] sm:text-base font-medium text-gray-800 leading-snug line-clamp-2 mb-1.5 sm:mb-2 min-h-[2lh] group-hover:text-primary transition-colors">
              {name}
            </h3>

            {rating > 0 && (
              <div className="flex items-center gap-1 mb-1.5 sm:mb-2">
                <Star size={14} className="text-warning fill-warning" />
                <span className="text-sm font-medium text-gray-700">{rating}</span>
                {reviewsCount > 0 && (
                  <span className="text-sm text-gray-400">({reviewsCount})</span>
                )}
              </div>
            )}

            {/* ✅ السعر والزر مثبّتان دائماً في أسفل الكرت بغض النظر عن طول الاسم */}
            <div className="mt-auto">
              <div className="flex flex-wrap items-baseline gap-x-2 mb-2 sm:mb-3">
                <span className="text-sm sm:text-lg font-bold text-primary">{price?.toLocaleString()} د.ع</span>
                {hasDiscount && (
                  <span className="text-[11px] sm:text-sm text-gray-400 line-through">{originalPrice?.toLocaleString()} د.ع</span>
                )}
              </div>

              {inStock && !hasVariants && (
                <button onClick={handleAddToCart} className="w-full btn-primary h-9 sm:h-11 px-2 text-xs sm:text-base rounded-lg gap-1">
                  <Plus size={16} /><span>إضافة للسلة</span>
                </button>
              )}
              {inStock && hasVariants && (
                <div className="w-full text-center text-xs text-gray-400 py-1">اختر من الخيارات أدناه ↓</div>
              )}
            </div>
          </div>
        </Link>

        {isHovered && inStock && (
          <InlineVariantPicker
            productId={id}
            basePrice={price}
            onConfirm={() => onAddToCart?.({ ...product, quantity: 1 })}
          />
        )}
      </div>
    )
  }

  // ===== Compact Variant =====
  if (variant === 'compact') {
    return (
      <Link to={`/products/${id}`} className={`card group block overflow-hidden ${className}`}>
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {!imageError ? (
            <img src={imageUrl} alt={name} onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ShoppingCart size={32} />
            </div>
          )}
          {discountPercent > 0 && (
            <span className="absolute top-2 right-2 bg-error text-white text-xs font-bold px-1.5 py-0.5 rounded">
              {discountPercent}%
            </span>
          )}
        </div>
        <div className="p-3">
          {/* ✅ اسم البائع */}
          <StoreLabel extraClass="mb-1" />
          <h3 className="text-sm font-medium text-gray-800 line-clamp-1 mb-1">{name}</h3>
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary">{price?.toLocaleString()} د.ع</span>
            {rating > 0 && (
              <div className="flex items-center gap-0.5">
                <Star size={12} className="text-warning fill-warning" />
                <span className="text-xs text-gray-600">{rating}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // ===== Horizontal Variant =====
  if (variant === 'horizontal') {
    return (
      <Link to={`/products/${id}`} className={`card group flex overflow-hidden ${className}`}>
        <div className="relative w-32 h-32 flex-shrink-0 bg-gray-100 overflow-hidden">
          {!imageError ? (
            <img src={imageUrl} alt={name} onError={() => setImageError(true)}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ShoppingCart size={32} />
            </div>
          )}
          {discountPercent > 0 && (
            <span className="absolute top-2 right-2 bg-error text-white text-xs font-bold px-1.5 py-0.5 rounded">
              {discountPercent}%
            </span>
          )}
        </div>
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            {/* ✅ اسم البائع */}
            <StoreLabel extraClass="mb-1" />
            <h3 className="font-medium text-gray-800 line-clamp-2 group-hover:text-primary transition-colors">
              {name}
            </h3>
            {rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={14} className="text-warning fill-warning" />
                <span className="text-sm text-gray-600">{rating}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">{price?.toLocaleString()} د.ع</span>
              {hasDiscount && (
                <span className="text-sm text-gray-400 line-through">{originalPrice?.toLocaleString()} د.ع</span>
              )}
            </div>
            {inStock && (
              <button onClick={handleAddToCart} className="btn-primary btn-sm">
                <ShoppingCart size={16} />
              </button>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return null
}

export default ProductCard