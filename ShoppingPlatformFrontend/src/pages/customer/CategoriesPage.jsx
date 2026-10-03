import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, AlertCircle, Grid, Star, ArrowLeft } from 'lucide-react'
import CategoryIcon from '../../components/common/CategoryIcon'
import { useProductsByCategory } from '../../hooks/useProducts'
import { getPrimaryImage } from '../../utils/imageHelper'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Skeleton } from '../../components/common/Loading'
import { useCategories } from '../../hooks/useCategories'

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


// ===========================
// الهاتف: عمود الفئات + محتوى الفئة المختارة
// ===========================
const CategoryProductCard = ({ p }) => {
  const img = getPrimaryImage(p)
  const hasDiscount = p.originalPrice && p.originalPrice > p.price
  const rating = p.averageRating || p.rating || 0
  return (
    <Link to={`/products/${p.id}`} className="block text-gray-900">
      <div className="relative aspect-square product-media rounded-xl overflow-hidden border border-gray-100">
        {img && <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />}
        {hasDiscount && (
          <span className="absolute top-1.5 right-1.5 bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            {Math.round((1 - p.price / p.originalPrice) * 100)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-snug line-clamp-2 min-h-[2lh]">{p.nameAr || p.name}</p>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[13px] font-bold">{p.price?.toLocaleString()} د.ع</span>
        {rating > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
            <Star size={11} className="text-warning fill-warning" />{Number(rating).toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  )
}

const MobileCategoryPanel = ({ category, index, subs }) => {
  const { data: products, isLoading } = useProductsByCategory(category.id)
  const list = (Array.isArray(products) ? products : products?.items || []).slice(0, 10)
  const gradient = GRADIENTS[index % GRADIENTS.length]

  return (
    <div className="p-3 lg:p-6 space-y-5 lg:space-y-6">
      {/* رأس الفئة */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white`}>
        <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white/15 flex items-center justify-center">
          <CategoryIcon category={category} index={index} className="w-12 h-12" emojiClassName="text-4xl" />
        </div>
        <h1 className="relative text-lg font-bold text-white">{category.nameAr || category.name}</h1>
        {category.description && <p className="relative text-xs text-white/85 mt-1 line-clamp-2 max-w-[70%]">{category.description}</p>}
        <Link to={`/products?category=${category.id}`}
          className="relative mt-3 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-white text-gray-900 text-xs font-bold">
          تسوق الكل <ArrowLeft size={14} />
        </Link>
      </div>

      {/* الأقسام الفرعية */}
      {subs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2">الأقسام</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-2 gap-y-3">
            {subs.map((sub, i) => (
              <Link key={sub.id} to={`/products?category=${sub.id}`} className="flex flex-col items-center gap-1.5 text-center">
                <span className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <CategoryIcon category={sub} index={i + 1} className="w-8 h-8" emojiClassName="text-2xl" />
                </span>
                <span className="text-[11px] text-gray-800 leading-tight line-clamp-2">{sub.nameAr || sub.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* منتجات الفئة */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-900">منتجات {category.nameAr || category.name}</h2>
          {list.length > 0 && (
            <Link to={`/products?category=${category.id}`} className="text-xs text-primary font-medium">عرض الكل</Link>
          )}
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8 bg-gray-50 rounded-xl">لا توجد منتجات في هذه الفئة بعد</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {list.map(p => <CategoryProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

const CategoriesPage = () => {
  const navigate = useNavigate()
  const { data: categoriesData, isLoading, isError, error } = useCategories(true)

  // ✅ فصل الرئيسية عن الفرعية
  const all        = categoriesData || []
  const roots      = all.filter(c => !c.parentId)
  const children   = all.filter(c => c.parentId)
  const getChildren = (parentId) => children.filter(c => c.parentId === parentId)

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('c') || roots[0]?.id
  const selectedIndex = Math.max(0, roots.findIndex(c => c.id === selectedId))
  const selected = roots[selectedIndex]
  const selectCategory = (id) => setSearchParams({ c: id }, { replace: true })

  const breadcrumbItems = [{ label: 'الفئات' }]

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
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
      {/* ===== عمود الفئات + محتوى الفئة (كل الشاشات؛ على الحاسوب داخل بطاقة) ===== */}
      {roots.length > 0 && selected && (
        <div className="lg:container-main lg:py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-4 hidden lg:block" />
        <div className="flex bg-white h-[calc(100dvh-70px-var(--bottom-nav-h))] lg:h-[calc(100dvh-70px-7rem)] lg:min-h-[520px] lg:rounded-2xl lg:border lg:border-gray-200 lg:overflow-hidden">
          {/* عمود الفئات */}
          <nav className="w-[92px] lg:w-60 flex-shrink-0 bg-gray-50 overflow-y-auto hide-scrollbar border-l border-gray-100 lg:py-2">
            {roots.map((cat, i) => {
              const active = cat.id === selected.id
              return (
                <button key={cat.id} onClick={() => selectCategory(cat.id)}
                  className={`relative w-full flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 px-1.5 lg:px-4 py-3 lg:py-2.5 text-center lg:text-right transition-colors ${active ? 'bg-white' : 'lg:hover:bg-white/60'}`}>
                  {active && <span className="absolute right-0 top-3 bottom-3 w-1 rounded-l-full bg-primary" />}
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${active ? 'bg-primary/10' : 'bg-white'}`}>
                    <CategoryIcon category={cat} index={i} className="w-7 h-7" emojiClassName="text-2xl" />
                  </span>
                  <span className={`text-[11px] lg:text-sm leading-tight line-clamp-2 ${active ? 'font-bold text-primary' : 'text-gray-600'}`}>
                    {cat.nameAr || cat.name}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* محتوى الفئة المختارة */}
          <div key={selected.id} className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
            <MobileCategoryPanel category={selected} index={selectedIndex} subs={getChildren(selected.id)} />
          </div>
        </div>
        </div>
      )}

      {/* ===== بدون فئات: الحالة الفارغة ===== */}
      <div className={`container-main py-6 ${roots.length > 0 ? 'hidden' : ''}`}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {roots.map((cat, i) => {
              const gradient = GRADIENTS[i % GRADIENTS.length]
              const subs = getChildren(cat.id)

              return (
                <div key={cat.id}
                  onClick={() => navigate(`/products?category=${cat.id}`)}
                  className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer">
                  {/* Image area */}
                  <div className={`h-28 sm:h-36 relative overflow-hidden bg-gradient-to-br ${gradient}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <CategoryIcon category={cat} index={i} className="w-16 h-16" emojiClassName="text-5xl" />
                      </span>
                    </div>
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-4">
                    {/* حجم الخط صريح لأن h3 يرث text-2xl من الأنماط العامة */}
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-start justify-between gap-1 mb-1 sm:mb-2 leading-snug">
                      <span className="line-clamp-2">{cat.nameAr || cat.name}</span>
                      <ChevronLeft size={16} className="text-gray-400 group-hover:text-primary group-hover:-translate-x-1 transition-all flex-shrink-0 mt-0.5" />
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