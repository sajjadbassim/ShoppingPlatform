import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { Search, AlertCircle, X, Store } from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import Pagination from '../../components/common/Pagination'
import EmptyState from '../../components/common/EmptyState'
import { useVendorsPaged } from '../../hooks/useVendors'
import { FeaturedStore, StoreCard } from '../../components/common/StoreCards'

// خيارات الترتيب — تُطبَّق على المتاجر المعروضة
const SORT_OPTIONS = [
  { value: 'products', label: '📦 الأكثر منتجات', sort: (a, b) => (b.productsCount || 0) - (a.productsCount || 0) },
  { value: 'rating',   label: '⭐ الأعلى تقييماً',  sort: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.ratingsCount || 0) - (a.ratingsCount || 0) },
  { value: 'newest',   label: '✨ الأحدث',        sort: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { value: 'delivery', label: '🚚 أقل توصيل',     sort: (a, b) => (a.deliveryFee ?? Infinity) - (b.deliveryFee ?? Infinity) },
  { value: 'fastest',  label: '⚡ الأسرع تحضيراً', sort: (a, b) => (a.estimatedPrepTime ?? Infinity) - (b.estimatedPrepTime ?? Infinity) },
]

// ===========================
// صفحة المتاجر
// ===========================
const StoresPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')

  const currentPage = parseInt(searchParams.get('page')) || 1
  const sortBy = SORT_OPTIONS.some(o => o.value === searchParams.get('sort')) ? searchParams.get('sort') : 'products'
  const sectionId = searchParams.get('section') || ''   // "متاجرنا المميزة" من الصفحة الرئيسية

  // قسم المتاجر المميزة: نفس المتاجر وبنفس ترتيبها في الصفحة الرئيسية
  const { data: section, isLoading: sectionLoading } = useQuery({
    queryKey: ['home-section', sectionId],
    queryFn: () => apiGet(API_ENDPOINTS.HOME.SECTION_BY_ID(sectionId)).then(r => r.data.data),
    enabled: !!sectionId,
    staleTime: 60 * 1000,
  })
  const featuredIds = useMemo(() => (section?.data || []).map(v => v.id), [section])

  const { data: vendorsData, isLoading: vendorsLoading, isError, error } = useVendorsPaged({
    pageNumber: sectionId ? 1 : currentPage,
    pageSize: sectionId ? 100 : 12,
    isActive: true,
  })
  const isLoading = vendorsLoading || (!!sectionId && sectionLoading)

  const allVendors = vendorsData?.items || vendorsData || []
  const vendors = sectionId
    ? featuredIds.map(id => allVendors.find(v => v.id === id)).filter(Boolean)
    : allVendors
  const totalPages = sectionId ? 1 : vendorsData?.totalPages || 1
  const totalCount = sectionId ? vendors.length : vendorsData?.totalCount || vendors.length
  const totalProducts = vendors.reduce((sum, v) => sum + (v.productsCount || 0), 0)

  // البحث بالاسم أو الوصف أو العنوان، ثم الترتيب (المميزة تبقى بترتيبها: الأكثر طلبات)
  const shownVendors = useMemo(() => {
    const q = searchQuery.trim()
    const list = vendors.filter(v => !q || [v.nameAr, v.name, v.description, v.address].some(t => t?.includes(q)))
    if (sectionId) return list
    const option = SORT_OPTIONS.find(o => o.value === sortBy)
    return [...list].sort(option.sort)
  }, [vendors, searchQuery, sortBy, sectionId])

  // المتجر المميز يظهر في الصفحة الأولى فقط ودون بحث
  const showFeatured = !searchQuery.trim() && currentPage === 1 && shownVendors.length > 1
  const [featured, ...rest] = showFeatured ? shownVendors : [null, ...shownVendors]

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams)
    params.set(key, value)
    if (key !== 'page') params.set('page', '1')
    setSearchParams(params, { replace: key !== 'page' })
  }

  const handlePageChange = (page) => {
    setParam('page', page.toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-4 lg:py-6">

        {/* الواجهة */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-primary via-indigo-600 to-indigo-900 text-white p-5 sm:p-8 mb-4">
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-1/3 w-56 h-56 rounded-full bg-amber-400/15 blur-2xl" />
          <Store size={120} className="absolute -left-4 top-4 text-white/10 hidden sm:block" strokeWidth={1.2} />

          <div className="relative max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {sectionId ? (section?.titleAr || section?.title || 'المتاجر المميزة') : 'اكتشف متاجر واسط'}
            </h1>
            <p className="text-sm sm:text-base text-white/85 mt-1.5">
              {isLoading
                ? 'جاري التحميل...'
                : sectionId
                  ? <>أكثر {totalCount} متاجر طلباً عند زبائننا • {totalProducts.toLocaleString()} منتج</>
                  : <>{totalCount} متجر محلي • أكثر من {totalProducts.toLocaleString()} منتج بانتظارك</>}
            </p>
            {sectionId && (
              <button onClick={() => setSearchParams({})}
                className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white/15 hover:bg-white/25 text-sm font-medium">
                <Store size={15} /> عرض كل المتاجر
              </button>
            )}

            <div className="relative mt-4">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                enterKeyHint="search"
                placeholder="ابحث عن متجر بالاسم أو المنطقة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pr-11 pl-10 bg-white rounded-full text-gray-900 shadow-lg focus:ring-4 focus:ring-white/40 border-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="مسح البحث"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* الترتيب — لا ينطبق على المميزة (مرتبة بالأكثر طلبات) */}
        <div className={`${sectionId ? 'hidden' : 'flex'} gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 mb-4`}>
          {SORT_OPTIONS.map(option => (
            <button key={option.value} onClick={() => setParam('sort', option.value)}
              className={`h-9 px-4 rounded-full whitespace-nowrap text-sm font-medium transition-colors flex-shrink-0 ${
                sortBy === option.value
                  ? 'bg-gray-900 text-white shadow'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
              }`}>
              {option.label}
            </button>
          ))}
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">حدث خطأ في تحميل المتاجر: {error?.message}</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}
            </div>
          </div>
        ) : shownVendors.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200">
            <EmptyState
              title="لا توجد متاجر"
              description={searchQuery ? `لم نجد متاجر تطابق "${searchQuery}"` : 'لا توجد متاجر متاحة حالياً'}
            />
          </div>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {featured && <FeaturedStore store={featured} />}

            {rest.length > 0 && (
              <>
                {featured && <h2 className="text-lg font-bold text-gray-900">{sectionId ? 'متاجر مميزة أخرى' : 'كل المتاجر'}</h2>}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                  {rest.map((store, index) => (
                    <StoreCard key={store.id} store={store} index={index + 1} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!isLoading && shownVendors.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StoresPage
