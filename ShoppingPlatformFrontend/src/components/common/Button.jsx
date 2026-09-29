import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Button Component
 * 
 * @param {string} variant - primary | secondary | outline | ghost | danger
 * @param {string} size - sm | md | lg
 * @param {boolean} loading - حالة التحميل
 * @param {boolean} disabled - تعطيل الزر
 * @param {boolean} fullWidth - عرض كامل
 * @param {ReactNode} icon - أيقونة (اختياري)
 * @param {string} iconPosition - right | left
 */
const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'right',
  className = '',
  type = 'button',
  ...props
}, ref) => {
  
  // أنماط الأنواع
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-700 focus:ring-primary/30',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 focus:ring-gray-300',
    outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary/30',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:ring-gray-300',
    danger: 'bg-error text-white hover:bg-error-dark active:bg-red-700 focus:ring-error/30',
  }

  // أنماط الأحجام
  const sizes = {
    sm: 'px-3 py-1.5 text-sm h-8 gap-1.5',
    md: 'px-4 py-2 text-base h-10 gap-2',
    lg: 'px-6 py-3 text-lg h-12 gap-2.5',
  }

  // أحجام الأيقونات
  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20,
  }

  const baseStyles = `
    inline-flex items-center justify-center font-medium rounded-md
    transition-all duration-200 cursor-pointer
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
  `

  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <Loader2 
          size={iconSizes[size]} 
          className="animate-spin" 
        />
      )}

      {/* Icon - Right Position (للعربية) */}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon size={iconSizes[size]} />
      )}

      {/* Content */}
      {children && <span>{children}</span>}

      {/* Icon - Left Position */}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon size={iconSizes[size]} />
      )}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
