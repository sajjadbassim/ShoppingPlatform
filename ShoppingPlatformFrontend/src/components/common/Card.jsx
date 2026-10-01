import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * Card Component - البطاقة الأساسية
 * 
 * @param {string} variant - default | bordered | elevated
 * @param {boolean} hoverable - تأثير عند المرور
 * @param {boolean} clickable - قابل للنقر
 * @param {string} padding - none | sm | md | lg
 */
export const Card = ({
  children,
  variant = 'default',
  hoverable = false,
  clickable = false,
  padding = 'md',
  className = '',
  onClick,
  ...props
}) => {
  const variants = {
    default: 'bg-white border border-gray-200',
    bordered: 'bg-white border-2 border-gray-300',
    elevated: 'bg-white shadow-card',
  }

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg transition-all duration-200
        ${variants[variant]}
        ${paddings[padding]}
        ${hoverable ? 'hover:shadow-card-hover' : ''}
        ${clickable ? 'cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}


/**
 * CardHeader Component
 */
export const CardHeader = ({ children, className = '' }) => (
  <div className={`pb-4 border-b border-gray-200 mb-4 ${className}`}>
    {children}
  </div>
)


/**
 * CardTitle Component
 */
export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
)


/**
 * CardDescription Component
 */
export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </p>
)


/**
 * CardContent Component
 */
export const CardContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
)


/**
 * CardFooter Component
 */
export const CardFooter = ({ children, className = '' }) => (
  <div className={`pt-4 border-t border-gray-200 mt-4 flex items-center justify-end gap-3 ${className}`}>
    {children}
  </div>
)


/**
 * StatCard Component - بطاقة الإحصائيات
 * 
 * @param {string} title - العنوان
 * @param {string|number} value - القيمة
 * @param {string} subtitle - النص الفرعي
 * @param {number} change - نسبة التغيير
 * @param {string} changeLabel - وصف التغيير
 * @param {ReactNode} icon - الأيقونة
 * @param {string} iconBg - لون خلفية الأيقونة
 */
export const StatCard = ({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  iconBg = 'bg-primary-light',
  iconColor = 'text-primary',
  className = '',
}) => {
  const isPositive = change > 0
  const isNegative = change < 0
  const isNeutral = change === 0

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
  const trendColor = isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-gray-500'
  const trendBg = isPositive ? 'bg-success-light' : isNegative ? 'bg-error-light' : 'bg-gray-100'

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
          
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}

          {change !== undefined && (
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full ${trendBg}`}>
              <TrendIcon size={14} className={trendColor} />
              <span className={`text-xs font-medium ${trendColor}`}>
                {isPositive && '+'}{change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-gray-500 mr-1">{changeLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className={`w-9 h-9 sm:w-12 sm:h-12 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-[18px] h-[18px] sm:w-6 sm:h-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </Card>
  )
}


/**
 * InfoCard Component - بطاقة المعلومات
 */
export const InfoCard = ({
  title,
  description,
  icon: Icon,
  variant = 'info', // info | success | warning | error
  action,
  onAction,
  className = '',
}) => {
  const variants = {
    info: {
      bg: 'bg-info-light',
      iconBg: 'bg-info',
      iconColor: 'text-white',
      textColor: 'text-info-dark',
    },
    success: {
      bg: 'bg-success-light',
      iconBg: 'bg-success',
      iconColor: 'text-white',
      textColor: 'text-success-dark',
    },
    warning: {
      bg: 'bg-warning-light',
      iconBg: 'bg-warning',
      iconColor: 'text-white',
      textColor: 'text-warning-dark',
    },
    error: {
      bg: 'bg-error-light',
      iconBg: 'bg-error',
      iconColor: 'text-white',
      textColor: 'text-error-dark',
    },
  }

  const currentVariant = variants[variant]

  return (
    <div className={`${currentVariant.bg} rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`w-10 h-10 ${currentVariant.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
            <Icon size={20} className={currentVariant.iconColor} />
          </div>
        )}
        <div className="flex-1">
          <p className={`font-medium ${currentVariant.textColor}`}>{title}</p>
          {description && (
            <p className={`text-sm mt-1 ${currentVariant.textColor} opacity-80`}>{description}</p>
          )}
          {action && onAction && (
            <button
              onClick={onAction}
              className={`mt-2 text-sm font-medium ${currentVariant.textColor} hover:underline`}
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Card
