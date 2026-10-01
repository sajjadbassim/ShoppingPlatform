import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Package, Store, Tag, Clock, TrendingUp, ArrowLeft } from 'lucide-react'
import { useProductsPaged } from '../../hooks/useProducts'
import { useVendorsPaged } from '../../hooks/useVendors'
import { useCategories } from '../../hooks/useCategories'
import { getPrimaryImage, getVendorLogo } from '../../utils/imageHelper'

const GlobalSearch = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])

  // جلب النتائج
  const { data: productsData, isLoading: productsLoading } = useProductsPaged({
    searchTerm: query,
    pageSize: 5,
  }, { enabled: query.length >= 2 })

  const { data: vendorsData, isLoading: vendorsLoading } = useVendorsPaged({
    searchTerm: query,
    pageSize: 3,
  }, { enabled: query.length >= 2 })

  const { data: categoriesData } = useCategories()

  const products = productsData?.items || productsData || []
  const vendors = vendorsData?.items || vendorsData || []
  const categories = (categoriesData || []).filter(c => 
    c.nameAr?.includes(query) || c.name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3)

  const isLoading = productsLoading || vendorsLoading
  const hasResults = products.length > 0 || vendors.length > 0 || categories.length > 0

  // تحميل البحث الأخير
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Focus عند الفتح
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // إغلاق بـ Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
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
    navigate(`/products?search=${encodeURIComponent(searchQuery)}`)
    onClose()
  }

  const handleProductClick = (product) => {
    navigate(`/products/${product.id}`)
    onClose()
  }

  const handleVendorClick = (vendor) => {
    navigate(`/stores/${vendor.id}`)
    onClose()
  }

  const handleCategoryClick = (category) => {
    navigate(`/products?category=${category.id}`)
    onClose()
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
                placeholder="ابحث عن منتجات، متاجر، فئات..."
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
            {isLoading && query.length >= 2 && (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p>جاري البحث...</p>
              </div>
            )}

            {/* No Query - Show Recent & Trending */}
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

                {/* Trending */}
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <TrendingUp size={18} className="text-primary" />
                    الأكثر بحثاً
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {['آيفون', 'سامسونج', 'لابتوب', 'سماعات', 'ساعة ذكية'].map((term, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(term)}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {query.length >= 2 && !isLoading && (
              <>
                {/* Products */}
                {products.length > 0 && (
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                      <Package size={18} className="text-primary" />
                      المنتجات
                    </h3>
                    <div className="space-y-2">
                      {products.map(product => (
                        <button
                          key={product.id}
                          onClick={() => handleProductClick(product)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-right"
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {getPrimaryImage(product) ? (
                              <img src={getPrimaryImage(product)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={20} className="text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product.nameAr || product.name}</p>
                            <p className="text-sm text-primary font-bold">{(product.price || 0).toLocaleString()} د.ع</p>
                          </div>
                          <ArrowLeft size={16} className="text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vendors */}
                {vendors.length > 0 && (
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                      <Store size={18} className="text-blue-500" />
                      المتاجر
                    </h3>
                    <div className="space-y-2">
                      {vendors.map(vendor => (
                        <button
                          key={vendor.id}
                          onClick={() => handleVendorClick(vendor)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-right"
                        >
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            {getVendorLogo(vendor) ? (
                              <img src={getVendorLogo(vendor)} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Store size={20} className="text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{vendor.nameAr || vendor.name}</p>
                            <p className="text-sm text-gray-500">{vendor.productsCount || 0} منتج</p>
                          </div>
                          <ArrowLeft size={16} className="text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                      <Tag size={18} className="text-green-500" />
                      الفئات
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(category => (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryClick(category)}
                          className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          {category.nameAr || category.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {!hasResults && (
                  <div className="p-8 text-center text-gray-500">
                    <Search size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">لا توجد نتائج لـ "{query}"</p>
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
