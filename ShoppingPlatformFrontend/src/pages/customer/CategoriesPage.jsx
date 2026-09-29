import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, AlertCircle, Grid } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Skeleton } from '../../components/common/Loading'
import { useCategories } from '../../hooks/useCategories'
import { getImageUrl } from '../../utils/imageHelper'

const GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-pink-500 to-pink-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-purple-500 to-purple-600',
  'from-red-500 to-red-600',
  'from-indigo-500 to-indigo-600',
  'from-yellow-500 to-yellow-600',
  'from-teal-500 to-teal-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
]

const FALLBACK_ICONS = ['📱','👕','🛒','🏠','💄','⚽','🎮','📚','🚗','💊','🐕','🎁']

const CategoriesPage = () => {
  const navigate = useNavigate()
  const { data: categoriesData, isLoading, isError, error } = useCategories(true)

  // ✅ فصل الرئيسية عن الفرعية
  const all        = categoriesData || []
  const roots      = all.filter(c => !c.parentId)
  const children   = all.filter(c => c.parentId)
  const getChildren = (parentId) => children.filter(c => c.parentId === parentId)

  const breadcrumbItems = [{ label: 'الفئات' }]

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <Skeleton className="h-36" />
              <div className="p-4"><Skeleton className="h-5 w-24" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (isError) return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700">{error?.message || 'فشل تحميل التصنيفات'}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">تصفح الفئات</h1>
          <p className="text-gray-500">اكتشف آلاف المنتجات في مختلف الفئات</p>
        </div>

        {roots.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Grid size={48} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد فئات حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {roots.map((cat, i) => {
              const gradient = GRADIENTS[i % GRADIENTS.length]
              const fallback = FALLBACK_ICONS[i % FALLBACK_ICONS.length]
              const subs = getChildren(cat.id)
              const iconSrc = getImageUrl(cat.iconUrl)

              return (
                <div key={cat.id}
                  onClick={() => navigate(`/products?category=${cat.id}`)}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer">
                  {/* Image area */}
                  <div className={`h-36 relative overflow-hidden bg-gradient-to-br ${gradient}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {iconSrc ? (
                        <img src={iconSrc} alt=""
                          className="w-16 h-16 object-contain filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
                      ) : null}
                      <span className={`text-5xl filter drop-shadow-lg ${iconSrc ? 'hidden' : ''}`}>{fallback}</span>
                    </div>
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 flex items-center justify-between mb-2">
                      <span className="truncate">{cat.nameAr || cat.name}</span>
                      <ChevronLeft size={16} className="text-gray-400 group-hover:text-primary group-hover:-translate-x-1 transition-all flex-shrink-0" />
                    </h3>

                    {cat.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{cat.description}</p>
                    )}

                    {/* Sub-categories — قابلة للنقر */}
                    {subs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {subs.slice(0, 4).map(sub => (
                          <Link
                            key={sub.id}
                            to={`/products?category=${sub.id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            {sub.nameAr || sub.name}
                          </Link>
                        ))}
                        {subs.length > 4 && (
                          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                            +{subs.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Popular Searches */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-5 text-center">عمليات البحث الشائعة</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['هواتف ذكية','لابتوبات','ملابس نسائية','عطور','ساعات','أحذية رياضية','مكياج','سماعات'].map((item, i) => (
              <Link key={i} to={`/products?search=${encodeURIComponent(item)}`}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-gray-700 hover:border-primary hover:text-primary hover:shadow-md transition-all text-sm">
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CategoriesPage