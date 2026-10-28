import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Package, Store, Tag, Clock, ArrowLeft } from 'lucide-react'
import { useSearchSuggestions } from '../../hooks/useProducts'
import { SCOPE, searchLink, useShopScope } from '../../utils/shopScope'
import { useBackToClose } from '../../hooks/useBackToClose'

const GlobalSearch = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  // من صفحة السوبرماركت يبحث في السوبرماركت فقط، ومن غيرها في بقية المنتجات فقط
  const scope = useShopScope()
  const grocery = scope === SCOPE.GROCERY

  // زر الرجوع في الهاتف يغلق البحث بدل مغادرة الصفحة
  useBackToClose(isOpen, onClose)
  // الانتقال من داخل البحث يحلّ محل خطوة البحث في السجل: الرجوع من النتيجة يعود للصفحة الأصلية
  const go = (to) => { navigate(to, { replace: true }); onClose() }

  // البحث بعد توقف الكتابة 300ms — لا طلبين للخادم مع كل حرف
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // اقتراحات نصية من نقطة واحدة (منتجات + متاجر + فئات)
  const { data: suggestions = [], isLoading } = useSearchSuggestions(term, scope)
  const hasResults = suggestions.length > 0

  // تحميل البحث الأخير عند كل فتح (يُمسح عند تسجيل الخروج، والهيدر لا يُعاد تركيبه)
  useEffect(() => {
    if (!isOpen) return
    try {
      const saved = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      setRecentSearches(Array.isArray(saved) ? saved : [])
    } catch {
      setRecentSearches([])
    }
  }, [isOpen])

  // Focus عند الفتح
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // إغلاق بـ Escape + منع تمرير الصفحة — فقط والنافذة مفتوحة
  // (كان التنظيف يفك قفل التمرير مع كل إعادة رسم للهيدر حتى والنافذة مغلقة،
  //  فتتحرك الصفحة خلف أي نافذة أخرى مفتوحة)
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleSearch = (searchQuery) => {
    if (!searchQuery.trim()) return

    // حفظ البحث
    const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5)
    setRecentSearches(newRecent)
    localStorage.setItem('recentSearches', JSON.stringify(newRecent))

    // الانتقال للنتائج
    go(searchLink(searchQuery, scope))
  }

  const SUGGESTION_META = {
    product:  { label: 'منتج',  Icon: Package, color: 'text-primary',    badge: 'bg-primary/10 text-primary' },
    store:    { label: 'متجر',  Icon: Store,   color: 'text-blue-500',   badge: 'bg-blue-50 text-blue-600' },
    category: { label: 'فئة',   Icon: Tag,     color: 'text-green-500',  badge: 'bg-green-50 text-green-700' },
  }

  const handleSuggestionClick = (s) => {
    if (s.type === 'product') go(`/products/${s.id}`)
    else if (s.type === 'store') go(`/stores/${s.id}`)
    else go(`/products?category=${s.id}${grocery ? '&scope=grocery' : ''}`)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  if (!isOpen) return null

  return (
    // على الهاتف: شاشة كاملة، وعلى الشاشات الأكبر: نافذة في المنتصف
    <div className="fixed inset-0 z-[60] bg-white sm:bg-black/50 sm:backdrop-blur-sm" onClick={onClose}>
      <div className="h-full sm:h-auto sm:container-main sm:pt-20">
        <div className="bg-white h-full sm:h-auto flex flex-col sm:rounded-2xl sm:shadow-2xl max-w-2xl mx-auto overflow-hidden"
          onClick={e => e.stopPropagation()}>
          {/* Search Input */}
          <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder={grocery ? 'ابحث في السوبرماركت...' : 'ابحث عن منتجات، متاجر، فئات...'}
                className="w-full h-12 pr-12 pl-12 bg-gray-100 rounded-xl text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <button onClick={onClose} className="sm:hidden px-2 py-2 text-sm text-gray-600 font-medium">
              إلغاء
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 sm:flex-none sm:max-h-[60vh] overflow-y-auto">
            {/* Loading */}
            {isLoading && query.trim().length >= 2 && term.length >= 2 && (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p>جاري البحث...</p>
              </div>
            )}

            {/* بلا نص: البحث الأخير فقط (أُزيلت قائمة "الأكثر بحثاً" الثابتة — كانت تقترح آيفون حتى في السوبرماركت) */}
            {!query && (
              <div className="p-4">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Clock size={18} className="text-gray-400" />
                        البحث الأخير
                      </h3>
                      <button onClick={clearRecentSearches} className="text-sm text-gray-500 hover:text-primary">
                        مسح
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search, i) => (
                        <button
                          key={i}
                          onClick={() => handleSearch(search)}
                          className="px-3 py-1.5 bg-gray-100 rounded-full text-sm hover:bg-gray-200 transition-colors"
                        >
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {query.trim().length >= 2 && term.length >= 2 && !isLoading && (
              <>
                {/* صف «بحث عن …» */}
                <button
                  onClick={() => handleSearch(term)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-right"
                >
                  <Search size={18} className="text-gray-400" />
                  <span className="flex-1 min-w-0 truncate text-gray-700">بحث عن «{term}»</span>
                  <ArrowLeft size={16} className="text-gray-400" />
                </button>

                {suggestions.map(s => {
                  const meta = SUGGESTION_META[s.type] || SUGGESTION_META.product
                  return (
                    <button
                      key={`${s.type}-${s.id}`}
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
                    >
                      <meta.Icon size={18} className={meta.color} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.text}</p>
                        {s.subtitle && <p className="text-xs text-gray-500 truncate">{s.subtitle}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                    </button>
                  )
                })}

                {/* No Results */}
                {!hasResults && (
                  <div className="p-8 text-center text-gray-500">
                    <Search size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">لا توجد نتائج لـ "{term}"</p>
                    <p className="text-sm mt-1">جرب كلمات مختلفة أو تصفح الفئات</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="hidden sm:flex p-4 border-t border-gray-200 bg-gray-50 items-center justify-between">
            <span className="text-sm text-gray-500">اضغط Enter للبحث</span>
            <button onClick={onClose} className="text-sm text-gray-600 hover:text-primary">
              إغلاق (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalSearch
