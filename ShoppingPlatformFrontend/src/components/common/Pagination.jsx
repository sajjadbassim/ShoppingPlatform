import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react'

/**
 * Pagination Component
 * 
 * @param {number} currentPage - الصفحة الحالية
 * @param {number} totalPages - إجمالي الصفحات
 * @param {function} onPageChange - دالة تغيير الصفحة
 * @param {number} siblingCount - عدد الصفحات المجاورة
 * @param {boolean} showFirstLast - إظهار أزرار البداية والنهاية
 * @param {string} variant - default | simple | compact
 */
const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  variant = 'default',
  className = '',
}) => {
  // إنشاء نطاق الصفحات
  const createRange = (start, end) => {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  // حساب الصفحات المعروضة
  const getPaginationRange = () => {
    const totalPageNumbers = siblingCount * 2 + 3 // siblings + current + 2 for first/last

    // إذا كان عدد الصفحات قليل، نعرضها كلها
    if (totalPages <= totalPageNumbers) {
      return createRange(1, totalPages)
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

    const shouldShowLeftDots = leftSiblingIndex > 2
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount
      const leftRange = createRange(1, leftItemCount)
      return [...leftRange, '...', totalPages]
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount
      const rightRange = createRange(totalPages - rightItemCount + 1, totalPages)
      return [1, '...', ...rightRange]
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = createRange(leftSiblingIndex, rightSiblingIndex)
      return [1, '...', ...middleRange, '...', totalPages]
    }

    return createRange(1, totalPages)
  }

  const paginationRange = getPaginationRange()

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page)
    }
  }

  const buttonBaseClass = `
    flex items-center justify-center transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `

  // الشكل البسيط
  if (variant === 'simple') {
    return (
      <div className={`flex items-center justify-center gap-4 ${className}`}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${buttonBaseClass} px-4 py-2 rounded-md text-gray-600 hover:bg-gray-100`}
        >
          <ChevronRight size={20} />
          <span>السابق</span>
        </button>

        <span className="text-gray-600">
          صفحة {currentPage} من {totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${buttonBaseClass} px-4 py-2 rounded-md text-gray-600 hover:bg-gray-100`}
        >
          <span>التالي</span>
          <ChevronLeft size={20} />
        </button>
      </div>
    )
  }

  // الشكل المدمج
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${buttonBaseClass} w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100`}
        >
          <ChevronRight size={18} />
        </button>

        <span className="px-3 py-2 text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${buttonBaseClass} w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100`}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
    )
  }

  // الشكل الافتراضي
  return (
    // على الهاتف: أزرار أصغر وبدون البداية/النهاية حتى لا تتجاوز عرض الشاشة
    <div className={`flex items-center justify-center gap-0.5 sm:gap-1 max-w-full ${className}`}>
      {/* زر البداية */}
      {showFirstLast && (
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className={`${buttonBaseClass} hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-md text-gray-600 hover:bg-gray-100`}
          title="الصفحة الأولى"
        >
          <ChevronsRight size={18} />
        </button>
      )}

      {/* زر السابق */}
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${buttonBaseClass} w-9 h-9 sm:w-10 sm:h-10 rounded-md text-gray-600 hover:bg-gray-100`}
        title="الصفحة السابقة"
      >
        <ChevronRight size={18} />
      </button>

      {/* أرقام الصفحات */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {paginationRange.map((page, index) => {
          if (page === '...') {
            return (
              <span 
                key={`dots-${index}`} 
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400"
              >
                ...
              </span>
            )
          }

          return (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`
                ${buttonBaseClass} w-9 h-9 sm:w-10 sm:h-10 rounded-md text-sm font-medium
                ${page === currentPage
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {page}
            </button>
          )
        })}
      </div>

      {/* زر التالي */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${buttonBaseClass} w-9 h-9 sm:w-10 sm:h-10 rounded-md text-gray-600 hover:bg-gray-100`}
        title="الصفحة التالية"
      >
        <ChevronLeft size={18} />
      </button>

      {/* زر النهاية */}
      {showFirstLast && (
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${buttonBaseClass} hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-md text-gray-600 hover:bg-gray-100`}
          title="الصفحة الأخيرة"
        >
          <ChevronsLeft size={18} />
        </button>
      )}
    </div>
  )
}

export default Pagination
