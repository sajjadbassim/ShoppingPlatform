import { 
  Package, 
  ShoppingCart, 
  Search, 
  FileX, 
  WifiOff, 
  AlertTriangle,
  Heart,
  Bell,
  Users,
  FolderOpen
} from 'lucide-react'
import Button from './Button'

/**
 * EmptyState Component
 * 
 * @param {string} type - cart | search | orders | wishlist | notifications | products | users | generic
 * @param {string} title - العنوان
 * @param {string} description - الوصف
 * @param {string} actionText - نص الزر
 * @param {function} onAction - دالة الزر
 * @param {ReactNode} action - عنصر مخصص بدل الزر الافتراضي (مثل زر بأيقونة)
 */
const EmptyState = ({
  type = 'generic',
  icon: CustomIcon,
  title,
  description,
  actionText,
  onAction,
  action,
  className = '',
}) => {
  // الأنواع المحددة مسبقاً
  const presets = {
    cart: {
      icon: ShoppingCart,
      title: 'سلة التسوق فارغة',
      description: 'لم تقم بإضافة أي منتجات إلى سلة التسوق بعد',
      actionText: 'تصفح المنتجات',
    },
    search: {
      icon: Search,
      title: 'لا توجد نتائج',
      description: 'لم نتمكن من العثور على نتائج تطابق بحثك',
      actionText: 'مسح البحث',
    },
    orders: {
      icon: Package,
      title: 'لا توجد طلبات',
      description: 'لم تقم بإجراء أي طلبات بعد',
      actionText: 'تسوق الآن',
    },
    wishlist: {
      icon: Heart,
      title: 'قائمة الأمنيات فارغة',
      description: 'لم تقم بإضافة أي منتجات إلى المفضلة',
      actionText: 'تصفح المنتجات',
    },
    notifications: {
      icon: Bell,
      title: 'لا توجد إشعارات',
      description: 'ليس لديك أي إشعارات جديدة',
    },
    products: {
      icon: FolderOpen,
      title: 'لا توجد منتجات',
      description: 'لم تقم بإضافة أي منتجات بعد',
      actionText: 'إضافة منتج',
    },
    users: {
      icon: Users,
      title: 'لا يوجد مستخدمين',
      description: 'لا يوجد مستخدمين مطابقين للبحث',
    },
    error: {
      icon: AlertTriangle,
      title: 'حدث خطأ',
      description: 'عذراً، حدث خطأ أثناء تحميل البيانات',
      actionText: 'إعادة المحاولة',
    },
    offline: {
      icon: WifiOff,
      title: 'لا يوجد اتصال',
      description: 'يرجى التحقق من اتصالك بالإنترنت',
      actionText: 'إعادة المحاولة',
    },
    generic: {
      icon: FileX,
      title: 'لا توجد بيانات',
      description: 'لا توجد بيانات لعرضها حالياً',
    },
  }

  const preset = presets[type] || presets.generic
  const Icon = CustomIcon || preset.icon
  const displayTitle = title || preset.title
  const displayDescription = description || preset.description
  const displayActionText = actionText || preset.actionText

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon Container */}
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <Icon size={40} className="text-gray-400" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-gray-500 max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* Action Button */}
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>
      ) : displayActionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {displayActionText}
        </Button>
      )}
    </div>
  )
}


/**
 * ErrorState Component - حالة الخطأ
 */
export const ErrorState = ({
  title = 'حدث خطأ',
  description = 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
  onRetry,
  className = '',
}) => {
  return (
    <EmptyState
      type="error"
      title={title}
      description={description}
      actionText={onRetry ? 'إعادة المحاولة' : undefined}
      onAction={onRetry}
      className={className}
    />
  )
}


/**
 * NotFoundState Component - حالة عدم العثور
 */
export const NotFoundState = ({
  title = 'الصفحة غير موجودة',
  description = 'عذراً، لم نتمكن من العثور على الصفحة المطلوبة',
  onGoHome,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* 404 */}
      <div className="text-8xl font-bold text-gray-200 mb-4">404</div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-500 max-w-sm mb-6">
        {description}
      </p>

      {/* Action Button */}
      {onGoHome && (
        <Button variant="primary" onClick={onGoHome}>
          العودة للرئيسية
        </Button>
      )}
    </div>
  )
}


export default EmptyState
