import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, MapPin, Star, Package, Grid, List, AlertCircle } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import Pagination from '../../components/common/Pagination'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { useVendorsPaged } from '../../hooks/useVendors'
import { useCategories } from '../../hooks/useCategories'
import { getVendorLogo, getVendorCover } from '../../utils/imageHelper'

const StoresPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  
  // قراءة المعاملات من URL
  const currentPage = parseInt(searchParams.get('page')) || 1
  const selectedCategory = searchParams.get('category') || 'all'
  const sortBy = searchParams.get('sort') || 'popular'

  // جلب المتاجر
  const { 
    data: vendorsData, 
    isLoading, 
    isError, 
    error 
  } = useVendorsPaged({
    pageNumber: currentPage,
    pageSize: 12,
    isActive: true,
  })

  // جلب التصنيفات
  const { data: categoriesData } = useCategories(true)

  const vendors = vendorsData?.items || vendorsData || []
  const totalPages = vendorsData?.totalPages || 1
  const totalCount = vendorsData?.totalCount || vendors.length

  // التصنيفات
  const categories = [
    { id: 'all', name: 'الكل' },
    ...(categoriesData?.slice(0, 6).map(cat => ({
      id: cat.id,
      name: cat.nameAr || cat.name
    })) || [])
  ]

  // أيقونات افتراضية للمتاجر
  const storeIcons = ['🏪', '🛍️', '📦', '🎁', '🛒', '💼']

  // تصفية المتاجر حسب البحث
  const filteredVendors = vendors.filter(vendor => {
    const name = vendor.nameAr || vendor.name || ''
    const description = vendor.description || ''
    return name.includes(searchQuery) || description.includes(searchQuery)
  })

  // تحديث الصفحة
  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // تحديث التصنيف
  const handleCategoryChange = (catId) => {
    const params = new URLSearchParams(searchParams)
    if (catId === 'all') {
      params.delete('category')
    } else {
      params.set('category', catId)
    }
    params.set('page', '1')
    setSearchParams(params)
  }

  // تحديث الترتيب
  const handleSortChange = (value) => {
    const params = new URLSearchParams(searchParams)
    params.set('sort', value)
    params.set('page', '1')
    setSearchParams(params)
  }

  const breadcrumbItems = [{ label: 'المتاجر' }]

  // كارت المتجر (Grid)
  const StoreCard = ({ store, index }) => {
    const logoUrl = getVendorLogo(store)
    const coverUrl = getVendorCover(store)
    
    return (
      <Link 
        to={`/stores/${store.id}`} 
        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all group"
      >
        {/* Cover */}
        <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/40 relative overflow-hidden">
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {/* Logo */}
          <div className="absolute -bottom-6 right-4 w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center text-3xl overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{storeIcons[index % storeIcons.length]}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-8">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {store.nameAr || store.name}
                {store.isVerified && (
                  <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500">{store.category?.nameAr || store.categoryName || 'متجر'}</p>
            </div>
            {store.rating > 0 && (
              <div className="flex items-center gap-1 text-yellow-500">
                <Star size={16} fill="currentColor" />
                <span className="font-medium text-gray-900">{store.rating?.toFixed(1) || '0.0'}</span>
              </div>
            )}
          </div>

          {store.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{store.description}</p>
          )}

        </div>
      </Link>
    )
  }

  // كارت المتجر (List)
  const StoreListItem = ({ store, index }) => {
    const logoUrl = getVendorLogo(store)
    
    return (
      <Link 
        to={`/stores/${store.id}`} 
        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all flex gap-4"
      >
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{storeIcons[index % storeIcons.length]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {store.nameAr || store.name}
                {store.isVerified && (
                  <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500">{store.category?.nameAr || 'متجر'}</p>
            </div>
            {store.rating > 0 && (
              <div className="flex items-center gap-1 text-yellow-500">
                <Star size={16} fill="currentColor" />
                <span className="font-medium text-gray-900">{store.rating?.toFixed(1)}</span>
                <span className="text-gray-400">({store.reviewsCount || 0})</span>
              </div>
            )}
          </div>
          {store.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-1">{store.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Package size={14} />
              {store.productsCount || 0} منتج
            </span>
            {store.city && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {store.city}
              </span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">المتاجر</h1>
          <p className="text-gray-600 mb-6">
            {isLoading ? 'جاري التحميل...' : `${totalCount} متجر على منصة واسط`}
          </p>

          {/* Search & Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="ابحث عن متجر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pr-12 pl-4 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="h-12 px-4 border border-gray-300 rounded-xl bg-white"
              >
                <option value="popular">الأكثر شهرة</option>
                <option value="rating">الأعلى تقييماً</option>
                <option value="products">الأكثر منتجات</option>
                <option value="newest">الأحدث</option>
              </select>

              <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === category.id || (selectedCategory === 'all' && category.id === 'all')
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-primary'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">حدث خطأ في تحميل المتاجر: {error?.message}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="h-32" />
                <div className="p-4 pt-8 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <EmptyState
            title="لا توجد متاجر"
            description={searchQuery ? `لم نجد متاجر تطابق "${searchQuery}"` : "لا توجد متاجر متاحة حالياً"}
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVendors.map((store, index) => (
              <StoreCard key={store.id} store={store} index={index} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVendors.map((store, index) => (
              <StoreListItem key={store.id} store={store} index={index} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filteredVendors.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default StoresPage