/**
 * Badge Component
 * 
 * @param {string} variant - primary | success | warning | error | info | gray
 * @param {string} size - sm | md | lg
 * @param {boolean} dot - إظهار نقطة فقط
 */
export const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variants = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-success-light text-success-dark',
    warning: 'bg-warning-light text-warning-dark',
    error: 'bg-error-light text-error-dark',
    info: 'bg-info-light text-info-dark',
    gray: 'bg-gray-100 text-gray-600',
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1',
  }

  if (dot) {
    const dotSizes = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
    }

    const dotColors = {
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-error',
      info: 'bg-info',
      gray: 'bg-gray-400',
    }

    return (
      <span className={`${dotSizes[size]} ${dotColors[variant]} rounded-full ${className}`} />
    )
  }

  return (
    <span 
      className={`
        inline-flex items-center font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}


/**
 * StatusBadge Component - شارة الحالة
 */
export const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    const statusUpper = status?.toUpperCase();
    
    switch (statusUpper) {
      case 'PENDING_CONFIRMATION':
        return {
          label: 'بانتظار التأكيد',
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          icon: '⏳'
        };
      
      case 'CONFIRMED':
        return {
          label: 'مؤكد',
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          icon: '✓'
        };
      
      case 'PARTIALLY_CONFIRMED':
        return {
          label: 'مؤكد جزئياً',
          bg: 'bg-cyan-100',
          text: 'text-cyan-800',
          icon: '◐'
        };
      
      case 'PREPARING':
      case 'PROCESSING':
        return {
          label: 'قيد التحضير',
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          icon: '📦'
        };
      
      case 'OUT_FOR_DELIVERY':
      case 'SHIPPED':
        return {
          label: 'في الطريق',
          bg: 'bg-indigo-100',
          text: 'text-indigo-800',
          icon: '🚚'
        };
      
      case 'DELIVERY_FAILED':
        return {
          label: 'تعذّر التسليم',
          bg: 'bg-orange-100',
          text: 'text-orange-800',
          icon: '⚠️'
        };

      case 'DELIVERED':
        return {
          label: 'تم التوصيل',
          bg: 'bg-green-100',
          text: 'text-green-800',
          icon: '✅'
        };
      
      case 'CANCELLED':
        return {
          label: 'ملغي',
          bg: 'bg-red-100',
          text: 'text-red-800',
          icon: '✖'
        };
      
      default:
        return {
          label: status || 'غير معروف',
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          icon: '•'
        };
    }
  };
  
  const config = getStatusConfig(status);
  
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};


/**
 * Avatar Component
 * 
 * @param {string} src - رابط الصورة
 * @param {string} alt - النص البديل
 * @param {string} name - الاسم (للحرف الأول)
 * @param {string} size - xs | sm | md | lg | xl
 * @param {string} shape - circle | square
 * @param {boolean} showStatus - إظهار حالة الاتصال
 * @param {string} status - online | offline | busy | away
 */
export const Avatar = ({
  src,
  alt,
  name,
  size = 'md',
  shape = 'circle',
  showStatus = false,
  status = 'offline',
  className = '',
}) => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  }

  const statusSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  }

  const statusColors = {
    online: 'bg-success',
    offline: 'bg-gray-400',
    busy: 'bg-error',
    away: 'bg-warning',
  }

  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-lg',
  }

  // الحصول على الحرف الأول من الاسم
  const getInitials = (name) => {
    if (!name) return '؟'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`
    }
    return name[0]
  }

  // ألوان خلفية متنوعة للأفاتار
  const getBackgroundColor = (name) => {
    const colors = [
      'bg-primary-light text-primary',
      'bg-success-light text-success',
      'bg-warning-light text-warning-dark',
      'bg-error-light text-error',
      'bg-info-light text-info',
    ]
    if (!name) return colors[0]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          className={`
            ${sizes[size]}
            ${shapes[shape]}
            object-cover
          `}
        />
      ) : (
        <div
          className={`
            ${sizes[size]}
            ${shapes[shape]}
            ${getBackgroundColor(name)}
            flex items-center justify-center font-semibold
          `}
        >
          {getInitials(name)}
        </div>
      )}

      {/* Status Indicator */}
      {showStatus && (
        <span
          className={`
            absolute bottom-0 left-0
            ${statusSizes[size]}
            ${statusColors[status]}
            rounded-full border-2 border-white
          `}
        />
      )}
    </div>
  )
}


/**
 * AvatarGroup Component - مجموعة الأفاتارات
 */
export const AvatarGroup = ({
  avatars = [],
  max = 4,
  size = 'md',
  className = '',
}) => {
  const displayAvatars = avatars.slice(0, max)
  const remainingCount = avatars.length - max

  const overlapSizes = {
    xs: '-mr-2',
    sm: '-mr-2',
    md: '-mr-3',
    lg: '-mr-4',
    xl: '-mr-5',
  }

  return (
    <div className={`flex items-center ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={index}
          className={`${index > 0 ? overlapSizes[size] : ''} ring-2 ring-white rounded-full`}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            size={size}
          />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={`
            ${overlapSizes[size]} ring-2 ring-white rounded-full
            ${size === 'xs' ? 'w-6 h-6 text-xs' : ''}
            ${size === 'sm' ? 'w-8 h-8 text-xs' : ''}
            ${size === 'md' ? 'w-10 h-10 text-sm' : ''}
            ${size === 'lg' ? 'w-12 h-12 text-base' : ''}
            ${size === 'xl' ? 'w-16 h-16 text-lg' : ''}
            bg-gray-200 text-gray-600 flex items-center justify-center font-medium
          `}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export default { Badge, StatusBadge, Avatar, AvatarGroup }
