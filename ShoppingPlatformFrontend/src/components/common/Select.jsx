import { forwardRef, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Select Component
 * 
 * @param {Array} options - [{value, label, icon?}]
 * @param {string} value - القيمة المحددة
 * @param {function} onChange - دالة التغيير
 * @param {string} label - عنوان الحقل
 * @param {string} placeholder - النص الافتراضي
 * @param {string} error - رسالة الخطأ
 * @param {boolean} disabled - تعطيل الحقل
 * @param {boolean} searchable - قابل للبحث
 */
const Select = forwardRef(({
  options = [],
  value,
  onChange,
  label,
  placeholder = 'اختر...',
  error,
  disabled = false,
  searchable = false,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // العثور على الخيار المحدد
  const selectedOption = options.find(opt => opt.value === value)

  // تصفية الخيارات حسب البحث
  const filteredOptions = searchable && searchQuery
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // التركيز على حقل البحث عند الفتح
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  const handleSelect = (option) => {
    onChange?.(option.value)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div ref={containerRef} className={`w-full relative ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={ref}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full h-11 px-4 bg-white border rounded-md text-right
          flex items-center justify-between gap-2
          transition-all duration-200 outline-none
          focus:ring-2 focus:ring-primary/20
          disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
          ${error ? 'border-error' : isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300'}
          ${className}
        `}
        {...props}
      >
        <span className={`flex-1 truncate ${selectedOption ? 'text-gray-800' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={20} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-dropdown overflow-hidden animate-fade-in">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث..."
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`
                    w-full px-4 py-2.5 text-right flex items-center gap-2
                    transition-colors duration-150
                    ${option.value === value 
                      ? 'bg-primary-light text-primary' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {option.icon && <span className="text-lg">{option.icon}</span>}
                  <span className="flex-1">{option.label}</span>
                  {option.value === value && <Check size={18} />}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-gray-500">
                لا توجد نتائج
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1.5 text-sm text-error">{error}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
