/**
 * Spinner Component - مؤشر التحميل الدائري
 * 
 * @param {string} size - sm | md | lg | xl
 * @param {string} color - primary | white | gray
 */
export const Spinner = ({ 
  size = 'md', 
  color = 'primary',
  className = '' 
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  }

  const colors = {
    primary: 'border-gray-200 border-t-primary',
    white: 'border-white/30 border-t-white',
    gray: 'border-gray-300 border-t-gray-600',
  }

  return (
    <div 
      className={`
        ${sizes[size]} 
        ${colors[color]} 
        rounded-full animate-spin
        ${className}
      `}
      role="status"
      aria-label="جاري التحميل"
    />
  )
}


/**
 * LoadingOverlay Component - طبقة التحميل
 */
export const LoadingOverlay = ({ 
  isLoading, 
  message = 'جاري التحميل...', 
  fullScreen = false 
}) => {
  if (!isLoading) return null

  return (
    <div 
      className={`
        ${fullScreen ? 'fixed inset-0' : 'absolute inset-0'} 
        bg-white/80 backdrop-blur-sm z-50 
        flex flex-col items-center justify-center gap-3
      `}
    >
      <Spinner size="lg" />
      {message && (
        <p className="text-gray-600 font-medium">{message}</p>
      )}
    </div>
  )
}


/**
 * Skeleton Component - هيكل التحميل
 * 
 * @param {string} variant - text | circle | rect | card | product
 */
export const Skeleton = ({ 
  variant = 'text', 
  width, 
  height,
  className = '',
  count = 1,
}) => {
  const baseClass = 'bg-gray-200 rounded animate-pulse'

  const variants = {
    text: 'h-4 w-full rounded',
    circle: 'rounded-full',
    rect: 'rounded-md',
  }

  const style = {
    width: width,
    height: height,
  }

  // للمتغيرات البسيطة
  if (['text', 'circle', 'rect'].includes(variant)) {
    const items = Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className={`${baseClass} ${variants[variant]} ${className}`}
        style={style}
      />
    ))

    return count > 1 ? <div className="space-y-2">{items}</div> : items[0]
  }

  return null
}


/**
 * ProductCardSkeleton - هيكل تحميل بطاقة المنتج
 */
export const ProductCardSkeleton = ({ count = 1 }) => {
  const items = Array.from({ length: count }, (_, i) => (
    <div key={i} className="card overflow-hidden">
      {/* صورة */}
      <div className="aspect-square bg-gray-200 animate-pulse" />
      
      {/* محتوى */}
      <div className="p-4 space-y-3">
        {/* اسم المنتج */}
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        
        {/* التقييم */}
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
        
        {/* السعر */}
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
        
        {/* زر */}
        <div className="h-10 bg-gray-200 rounded animate-pulse w-full" />
      </div>
    </div>
  ))

  return count > 1 ? <>{items}</> : items[0]
}


/**
 * TableSkeleton - هيكل تحميل الجدول
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 bg-gray-50">
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: columns }, (_, colIndex) => (
            <div 
              key={colIndex} 
              className="h-4 bg-gray-200 rounded animate-pulse flex-1"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}


/**
 * PageSkeleton - هيكل تحميل الصفحة
 */
export const PageSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
        <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
        <div className="h-10 bg-gray-200 rounded animate-pulse w-40" />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ProductCardSkeleton count={8} />
      </div>
    </div>
  )
}


/**
 * DotLoader - نقاط التحميل
 */
export const DotLoader = ({ size = 'md', color = 'primary' }) => {
  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  }

  const colors = {
    primary: 'bg-primary',
    white: 'bg-white',
    gray: 'bg-gray-500',
  }

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${sizes[size]} ${colors[color]} rounded-full animate-bounce`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}



