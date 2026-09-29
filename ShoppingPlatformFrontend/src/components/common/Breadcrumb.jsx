import { Link } from 'react-router-dom'
import { ChevronLeft, Home } from 'lucide-react'

/**
 * Breadcrumb Component
 * 
 * @param {Array} items - [{label, path?, icon?}]
 * @param {boolean} showHome - إظهار رابط الرئيسية
 * @param {string} separator - الفاصل
 */
const Breadcrumb = ({
  items = [],
  showHome = true,
  separator = 'chevron', // chevron | slash | dot
  className = '',
}) => {
  // أنواع الفواصل
  const separators = {
    chevron: <ChevronLeft size={16} className="text-gray-400" />,
    slash: <span className="text-gray-400">/</span>,
    dot: <span className="text-gray-400">•</span>,
  }

  const SeparatorIcon = separators[separator] || separators.chevron

  // إضافة الرئيسية إذا كانت مطلوبة
  const allItems = showHome
    ? [{ label: 'الرئيسية', path: '/', icon: Home }, ...items]
    : items

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1
          const Icon = item.icon

          return (
            <li key={index} className="flex items-center gap-1">
              {/* العنصر */}
              {isLast ? (
                // العنصر الأخير (غير قابل للنقر)
                <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                  {Icon && <Icon size={16} />}
                  {item.label}
                </span>
              ) : (
                // العناصر القابلة للنقر
                <>
                  <Link
                    to={item.path || '#'}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-colors"
                  >
                    {Icon && <Icon size={16} />}
                    {item.label}
                  </Link>
                  {/* الفاصل */}
                  <span className="mx-1">{SeparatorIcon}</span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}


/**
 * PageHeader Component - عنوان الصفحة مع Breadcrumb
 */
export const PageHeader = ({
  title,
  description,
  breadcrumbItems = [],
  actions,
  className = '',
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      {/* Breadcrumb */}
      {breadcrumbItems.length > 0 && (
        <Breadcrumb items={breadcrumbItems} className="mb-4" />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-gray-600 mt-1">{description}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default Breadcrumb
