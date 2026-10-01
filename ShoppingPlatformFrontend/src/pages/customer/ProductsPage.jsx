import { useState, useEffect } from 'react'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { productService } from '../../services'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Grid, List, ChevronDown, ChevronUp, X, SlidersHorizontal,
  AlertCircle, Star, Tag, Package, Search,
} from 'lucide-react'
import ProductCard from '../../components/common/ProductCard'
import { ProductCardSkeleton } from '../../components/common/Loading'
import Pagination from '../../components/common/Pagination'
import Breadcrumb from '../../components/common/Breadcrumb'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/Toast'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { useCategories } from '../../hooks/useCategories'
import { useProductsPaged, useAdvancedFilter, useUnifiedSearch, useProductsByCategory } from '../../hooks/useProducts'

// ===========================
// Filter Section Component
// ===========================
const FilterSection = ({ title, icon: Icon, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0 py-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-800 hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-primary" />}
          {title}
        </span>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// ===========================
// Main Page
// ===========================
const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { isAuthenticated } = useAuthStore()
  const { addItem: addToCart } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const currentPage = parseInt(searchParams.get('page')) || 1
  const searchTerm  = searchParams.get('search')   || ''
  const categoryId  = searchParams.get('category') || ''
  const vendorId    = searchParams.get('vendor')   || ''
  const sortBy      = searchParams.get('sort')     || 'newest'
  const minPrice    = searchParams.get('minPrice') || ''
  const maxPrice    = searchParams.get('maxPrice') || ''
  const minRating   = searchParams.get('minRating') || ''
  const hasDiscount = searchParams.get('hasDiscount') === 'true'

  const [filters, setFilters] = useState({
    categories:  categoryId ? [categoryId] : [],
    priceRange:  { min: minPrice, max: maxPrice },
    inStock:     false,
    minRating:   minRating || '',
    hasDiscount: hasDiscount || false,
  })

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()
  const allCategories = categoriesData || []
  const rootCategories = allCategories.filter(c => !c.parentId)
  const childCategories = allCategories.filter(c => c.parentId)
  const getChildren = (parentId) => childCategories.filter(c => c.parentId === parentId)

  // ✅ تحويل خيار الفرز في الواجهة إلى (sortBy, sortOrder) بالشكل الذي يتوقعه الباك اند فعلياً
  const SORT_MAP = {
    'newest':     { sortBy: undefined, sortOrder: undefined },
    'price-low':  { sortBy: 'price',   sortOrder: 'asc'  },
    'price-high': { sortBy: 'price',   sortOrder: 'desc' },
    'rating':     { sortBy: 'rating',  sortOrder: undefined },
    'name':       { sortBy: 'name',    sortOrder: 'asc'  },
  }
  const { sortBy: apiSortBy, sortOrder: apiSortOrder } = SORT_MAP[sortBy] || SORT_MAP.newest

  const advancedFilterParams = {
    pageNumber: currentPage, pageSize: 12,
    categoryId: filters.categories[0] || undefined,
    vendorId:   vendorId || undefined,
    minPrice:   minPrice || undefined,
    maxPrice:   maxPrice || undefined,
    isAvailable: filters.inStock || undefined,
    isActive:    true,
    minRating:   filters.minRating || undefined,
    hasDiscount: filters.hasDiscount || undefined,
    sortBy:      apiSortBy,
    sortOrder:   apiSortOrder,
  }

  const { data: searchData, isLoading: searchLoading, isError: searchError } =
    useUnifiedSearch(searchTerm, { pageNumber: currentPage, pageSize: 12 })

  const { data: filterData, isLoading: filterLoading, isError: filterError, error: filterErrorMsg } =
    useAdvancedFilter(advancedFilterParams, !searchTerm && !categoryId)

  // ✅ تحقق إذا التصنيف رئيسي أم فرعي
  const selectedCatObj = categoryId ? allCategories.find(c => c.id === categoryId) : null
  const isRootCat = selectedCatObj && !selectedCatObj.parentId
  // منتجات التصنيف الرئيسي نفسه + كل تصنيفاته الفرعية (قد يملك تصنيف رئيسي منتجات مباشرة بلا أي تصنيف فرعي)
  const subCatIds = isRootCat ? [categoryId, ...getChildren(categoryId).map(c => c.id)] : []

  const { data: categoryData, isLoading: categoryLoading, isError: categoryError } =
    useProductsByCategory(categoryId && !searchTerm && !isRootCat ? categoryId : null)

  const data      = searchTerm ? searchData : categoryId && !isRootCat ? categoryData : filterData
  const isLoading = searchTerm ? searchLoading : categoryId && !isRootCat ? categoryLoading : filterLoading
  const isError   = searchTerm ? searchError : categoryId && !isRootCat ? categoryError : filterError
  const error     = searchTerm ? null : filterErrorMsg

  const rawData   = data?.data || data
  let baseProducts = Array.isArray(rawData) ? rawData : (rawData?.items ?? rawData?.products ?? [])

  // ✅ تصنيف رئيسي — جلب منتجات كل الأبناء
  const [rootCatProducts, setRootCatProducts] = useState([])
  const [rootCatLoading, setRootCatLoading]   = useState(false)

  useEffect(() => {
    if (!isRootCat || subCatIds.length === 0) { setRootCatProducts([]); return }
    setRootCatLoading(true)
    Promise.all(
      subCatIds.map(cid =>
        apiGet(API_ENDPOINTS.PRODUCTS.BY_CATEGORY(cid)).then(r => r.data.data || r.data || [])
      )
    ).then(results => {
      const merged = results.flat().filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
      setRootCatProducts(merged)
      setRootCatLoading(false)
    }).catch(() => setRootCatLoading(false))
  }, [categoryId])

  const products   = isRootCat && subCatIds.length > 0 ? rootCatProducts : baseProducts
  const finalLoad  = isLoading || (isRootCat && rootCatLoading)
  const totalPages = rawData?.totalPages || 1
  const totalCount = isRootCat ? products.length : (rawData?.totalCount ?? rawData?.totalResults ?? products.length)

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      priceRange: { min: searchParams.get('minPrice') || '', max: searchParams.get('maxPrice') || '' },
      minRating:   searchParams.get('minRating') || '',
      hasDiscount: searchParams.get('hasDiscount') === 'true',
    }))
  }, [searchParams])

  const setParam = (key, value) => {
    const p = new URLSearchParams(searchParams)
    if (value) p.set(key, value); else p.delete(key)
    p.set('page', '1')
    setSearchParams(p)
  }

  const handleCategoryChange = (catId) => {
    const isSelected = filters.categories.includes(catId)
    setFilters(prev => ({ ...prev, categories: isSelected ? [] : [catId] }))
    setParam('category', isSelected ? '' : catId)
  }

  const applyPriceFilter = () => {
    const p = new URLSearchParams(searchParams)
    if (filters.priceRange.min) p.set('minPrice', filters.priceRange.min); else p.delete('minPrice')
    if (filters.priceRange.max) p.set('maxPrice', filters.priceRange.max); else p.delete('maxPrice')
    p.set('page', '1')
    setSearchParams(p)
  }

  const clearFilters = () => {
    setFilters({ categories: [], priceRange: { min: '', max: '' }, inStock: false, minRating: '', hasDiscount: false })
    setSearchParams({})
  }

  const handleAddToCart = async ({ id, quantity = 1 }) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await addToCart(id, quantity); success('تمت الإضافة للسلة') }
    catch (err) { showError(err.message || 'فشل إضافة المنتج') }
  }

  const handleToggleWishlist = async (p) => {
    if (!isAuthenticated) { showError('يجب تسجيل الدخول أولاً'); navigate('/login'); return }
    try { await toggleWishlist(typeof p === 'string' ? p : p.id); success('تم') }
    catch { showError('فشلت العملية') }
  }

  const activeCount =
    filters.categories.length +
    (filters.priceRange.min || filters.priceRange.max ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.hasDiscount ? 1 : 0) +
    (searchTerm ? 1 : 0)

  // ===========================
  // Sidebar Content
  // ✅ عنصر JSX عادي وليس مكوّناً متداخلاً — تعريفه كمكوّن كان يعيد
  // إنشاءه (وبالتالي إعادة تركيبه بالكامل) في كل إعادة رسم، ما كان
  // يفقد تركيز حقول نطاق السعر بعد كل ضغطة مفتاح
  // ===========================
  const sidebarContent = (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-900 text-base">الفلاتر</h3>
        {activeCount > 0 && (
          <button onClick={clearFilters}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
            <X size={12} />مسح الكل
          </button>
        )}
      </div>

      {/* Categories */}
      <FilterSection title="التصنيفات" icon={Package}>
        {categoriesLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse"/>)}</div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto pl-1">
            {rootCategories.map(root => {
              const children = getChildren(root.id)
              const rootSelected = filters.categories.includes(root.id)
              return (
                <div key={root.id}>
                  <div onClick={() => handleCategoryChange(root.id)}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm font-medium ${
                      rootSelected ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      rootSelected ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}>
                      {rootSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="truncate">{root.nameAr || root.name}</span>
                  </div>
                  {children.length > 0 && (
                    <div className="mr-5 mt-0.5 space-y-0.5 border-r-2 border-gray-100 pr-2">
                      {children.map(child => {
                        const childSelected = filters.categories.includes(child.id)
                        return (
                          <div key={child.id} onClick={() => handleCategoryChange(child.id)}
                            className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors text-xs ${
                              childSelected ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-500'
                            }`}>
                            <div className={`w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              childSelected ? 'bg-primary border-primary' : 'border-gray-300'
                            }`}>
                              {childSelected && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span className="truncate">{child.nameAr || child.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="نطاق السعر" icon={Tag}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">من (د.ع)</label>
              <input type="number" placeholder="0" value={filters.priceRange.min}
                onChange={e => setFilters(p => ({...p, priceRange: {...p.priceRange, min: e.target.value}}))}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">إلى (د.ع)</label>
              <input type="number" placeholder="∞" value={filters.priceRange.max}
                onChange={e => setFilters(p => ({...p, priceRange: {...p.priceRange, max: e.target.value}}))}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
          </div>
          {/* Quick price ranges */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'أقل من 50K',   min: '',       max: '50000'  },
              { label: '50K - 200K',   min: '50000',  max: '200000' },
              { label: '200K - 500K',  min: '200000', max: '500000' },
              { label: 'أكثر من 500K', min: '500000', max: ''       },
            ].map(r => {
              const isActive = filters.priceRange.min === r.min && filters.priceRange.max === r.max
              return (
                <button key={r.label}
                  onClick={() => {
                    setFilters(p => ({...p, priceRange: {min: r.min, max: r.max}}))
                    const ps = new URLSearchParams(searchParams)
                    if (r.min) ps.set('minPrice', r.min); else ps.delete('minPrice')
                    if (r.max) ps.set('maxPrice', r.max); else ps.delete('maxPrice')
                    ps.set('page', '1')
                    setSearchParams(ps)
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isActive ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                  }`}>
                  {r.label}
                </button>
              )
            })}
          </div>
          <button onClick={applyPriceFilter}
            className="w-full h-8 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors">
            تطبيق النطاق
          </button>
        </div>
      </FilterSection>

      {/* Rating */}
      <FilterSection title="التقييم">
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map(star => {
            const selected = filters.minRating == star
            return (
              <label key={star}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  selected ? 'bg-yellow-50 text-yellow-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
                onClick={() => {
                  const v = selected ? '' : String(star)
                  setFilters(p => ({...p, minRating: v}))
                  setParam('minRating', v)
                }}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300'
                }`}>
                  {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(star)].map((_, i) => <Star key={i} size={12} className="text-yellow-400 fill-yellow-400"/>)}
                  {[...Array(5-star)].map((_, i) => <Star key={i} size={12} className="text-gray-200"/>)}
                  <span className="text-xs mr-1">{star === 5 ? '' : 'فأكثر'}</span>
                </div>
              </label>
            )
          })}
        </div>
      </FilterSection>

      {/* Other filters */}
      <FilterSection title="خيارات أخرى">
        <div className="space-y-2">
          {[
            { key: 'hasDiscount', label: '🏷️ عروض وخصومات فقط', state: filters.hasDiscount },
            { key: 'inStock',     label: '✅ المتوفر في المخزون',  state: filters.inStock     },
          ].map(f => (
            <label key={f.key}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                f.state ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => {
                const v = !f.state
                setFilters(p => ({...p, [f.key]: v}))
                if (f.key === 'hasDiscount') setParam('hasDiscount', v ? 'true' : '')
              }}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                f.state ? 'bg-primary border-primary' : 'border-gray-300'
              }`}>
                {f.state && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span className="text-sm">{f.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-4 lg:py-6">
        <Breadcrumb items={[{ label: 'المنتجات' }]} className="mb-6 hidden lg:block" />

        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-24">
              {sidebarContent}
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Header bar */}
            <div className="bg-white rounded-2xl sm:rounded-xl border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-gray-900">
                    {searchTerm ? `نتائج: "${searchTerm}"` : 'جميع المنتجات'}
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {finalLoad ? 'جاري التحميل...' : `${totalCount} منتج`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mobile filter btn */}
                  <button onClick={() => setShowMobileFilters(true)}
                    className="lg:hidden flex-1 sm:flex-none justify-center flex items-center gap-1.5 h-10 sm:h-9 px-3 border border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary hover:text-primary transition-colors">
                    <SlidersHorizontal size={15} />
                    الفلاتر
                    {activeCount > 0 && (
                      <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">{activeCount}</span>
                    )}
                  </button>

                  {/* Sort */}
                  <select value={sortBy} onChange={e => { const p = new URLSearchParams(searchParams); p.set('sort', e.target.value); p.set('page','1'); setSearchParams(p) }}
                    className="flex-1 sm:flex-none h-10 sm:h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary">
                    <option value="newest">الأحدث</option>
                    <option value="price-low">السعر: الأقل</option>
                    <option value="price-high">السعر: الأعلى</option>
                    <option value="rating">الأعلى تقييماً</option>
                    <option value="name">الاسم</option>
                  </select>

                  {/* View mode */}
                  <div className="hidden sm:flex border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode('grid')}
                      className={`p-2 transition-colors ${viewMode==='grid' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <Grid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                      className={`p-2 transition-colors ${viewMode==='list' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <List size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active filter tags */}
              {activeCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {searchTerm && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      🔍 {searchTerm}
                      <button onClick={() => setParam('search', '')}><X size={12}/></button>
                    </span>
                  )}
                  {filters.categories.map(catId => {
                    const cat = allCategories.find(c => c.id === catId)
                    return cat ? (
                      <span key={catId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        {cat.nameAr || cat.name}
                        <button onClick={() => handleCategoryChange(catId)}><X size={12}/></button>
                      </span>
                    ) : null
                  })}
                  {(filters.priceRange.min || filters.priceRange.max) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full">
                      💰 {filters.priceRange.min||'0'} - {filters.priceRange.max||'∞'}
                      <button onClick={() => { setFilters(p=>({...p,priceRange:{min:'',max:''}})); const ps=new URLSearchParams(searchParams); ps.delete('minPrice'); ps.delete('maxPrice'); setSearchParams(ps) }}><X size={12}/></button>
                    </span>
                  )}
                  {filters.minRating && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      ⭐ {filters.minRating}+
                      <button onClick={() => { setFilters(p=>({...p,minRating:''})); setParam('minRating','') }}><X size={12}/></button>
                    </span>
                  )}
                  {filters.hasDiscount && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      🏷️ خصومات
                      <button onClick={() => { setFilters(p=>({...p,hasDiscount:false})); setParam('hasDiscount','') }}><X size={12}/></button>
                    </span>
                  )}
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-full transition-colors">
                    مسح الكل
                  </button>
                </div>
              )}
            </div>

            {/* Error */}
            {isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">حدث خطأ في تحميل المنتجات</p>
              </div>
            )}

            {/* Products */}
            {finalLoad ? (
              <div className={viewMode === 'grid' ? 'product-grid' : 'space-y-4'}>
                {[...Array(12)].map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200">
                <EmptyState
                  title="لا توجد منتجات"
                  description={searchTerm ? `لم نجد منتجات تطابق "${searchTerm}"` : 'لا توجد منتجات بهذه المعايير'}
                  action={activeCount > 0 && <Button variant="primary" onClick={clearFilters}>مسح الفلاتر</Button>}
                />
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'product-grid' : 'space-y-4'}>
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={{
                      id:            product.id,
                      name:          product.nameAr || product.name,
                      image:         product.primaryImageUrl,
                      price:         product.price,
                      originalPrice: product.originalPrice,
                      rating:        product.rating       || 0,
                      reviewsCount:  product.reviewsCount || 0,
                      storeName:     product.vendor?.name || product.vendorName,
                      vendorId:      product.vendorId,
                      inStock:       product.isAvailable  && product.stockQuantity > 0,
                      isWishlisted:  isInWishlist(product.id),
                    }}
                    variant={viewMode === 'list' ? 'horizontal' : 'default'}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </div>
            )}

            {!isLoading && products.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination currentPage={currentPage} totalPages={totalPages}
                  onPageChange={p => { const ps=new URLSearchParams(searchParams); ps.set('page',p.toString()); setSearchParams(ps); window.scrollTo({top:0,behavior:'smooth'}) }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">الفلاتر</h2>
              <button onClick={() => setShowMobileFilters(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {sidebarContent}
            </div>
            <div className="p-4 border-t border-gray-200">
              <Button variant="primary" fullWidth onClick={() => setShowMobileFilters(false)}>
                عرض {totalCount} نتيجة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductsPage