import { useState, useRef, useEffect } from 'react'
import { Search, X, Clock, TrendingUp } from 'lucide-react'

/**
 * SearchBar Component
 * 
 * @param {string} value - قيمة البحث
 * @param {function} onChange - دالة التغيير
 * @param {function} onSearch - دالة البحث
 * @param {string} placeholder - النص الافتراضي
 * @param {Array} suggestions - الاقتراحات
 * @param {Array} recentSearches - عمليات البحث الأخيرة
 * @param {boolean} loading - حالة التحميل
 * @param {string} size - sm | md | lg
 * @param {string} variant - default | rounded | bordered
 */
const SearchBar = ({
  value = '',
  onChange,
  onSearch,
  onClear,
  placeholder = 'ابحث...',
  suggestions = [],
  recentSearches = [],
  trendingSearches = [],
  loading = false,
  size = 'md',
  variant = 'default',
  showSuggestions = true,
  autoFocus = false,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  const sizes = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-base',
    lg: 'h-12 text-lg',
  }

  const variants = {
    default: 'bg-gray-50 border border-gray-200 focus-within:bg-white focus-within:border-primary',
    rounded: 'bg-gray-50 border border-gray-200 rounded-full focus-within:bg-white focus-within:border-primary',
    bordered: 'bg-white border-2 border-gray-300 focus-within:border-primary',
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 22,
  }

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFocus = () => {
    setIsFocused(true)
    if (showSuggestions) setShowDropdown(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  const handleChange = (e) => {
    onChange?.(e.target.value)
    if (showSuggestions && e.target.value) setShowDropdown(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch?.(value)
    setShowDropdown(false)
  }

  const handleClear = () => {
    onChange?.('')
    onClear?.()
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (suggestion) => {
    onChange?.(suggestion)
    onSearch?.(suggestion)
    setShowDropdown(false)
  }

  const hasContent = value.length > 0
  const showSuggestionsDropdown = showDropdown && showSuggestions && (
    (hasContent && suggestions.length > 0) ||
    (!hasContent && (recentSearches.length > 0 || trendingSearches.length > 0))
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div 
          className={`
            flex items-center gap-2 px-4 transition-all duration-200
            ${variants[variant]}
            ${sizes[size]}
            ${variant === 'rounded' ? 'rounded-full' : 'rounded-md'}
          `}
        >
          {/* Search Icon */}
          <Search 
            size={iconSizes[size]} 
            className={`flex-shrink-0 transition-colors ${isFocused ? 'text-primary' : 'text-gray-400'}`} 
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
          />

          {/* Loading Spinner */}
          {loading && (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
          )}

          {/* Clear Button */}
          {hasContent && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestionsDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-dropdown overflow-hidden animate-fade-in">
          {/* Suggestions (when typing) */}
          {hasContent && suggestions.length > 0 && (
            <div className="py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.text || suggestion)}
                  className="w-full px-4 py-2.5 text-right flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  {suggestion.icon ? (
                    <span className="text-xl">{suggestion.icon}</span>
                  ) : (
                    <Search size={16} className="text-gray-400" />
                  )}
                  <div className="flex-1 text-right">
                    <p className="text-sm text-gray-800">{suggestion.text || suggestion}</p>
                    {suggestion.category && (
                      <p className="text-xs text-gray-500">{suggestion.category}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches (when empty) */}
          {!hasContent && recentSearches.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                عمليات البحث الأخيرة
              </p>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full px-4 py-2.5 text-right flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Trending Searches */}
          {!hasContent && trendingSearches.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                الأكثر بحثاً
              </p>
              {trendingSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full px-4 py-2.5 text-right flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <TrendingUp size={16} className="text-warning" />
                  <span className="text-sm text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* View All Results */}
          {hasContent && suggestions.length > 0 && (
            <button
              onClick={() => onSearch?.(value)}
              className="w-full px-4 py-3 text-center text-sm text-primary font-medium border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              عرض جميع النتائج
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
