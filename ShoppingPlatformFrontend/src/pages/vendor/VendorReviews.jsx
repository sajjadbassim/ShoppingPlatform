// src/pages/vendor/VendorReviews.jsx
import { useState, useEffect } from 'react'
import {
  Star, ThumbsUp, RefreshCw, BarChart2,
  Package, ChevronDown, ChevronUp, Reply, Pencil, Trash2,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import Pagination from '../../components/common/Pagination'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/axios'
import { useToast } from '../../components/common/Toast'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useAuthStore } from '../../stores/authStore'
import { getImageUrl } from '../../utils/imageHelper'
import { formatDate } from '../../utils/dates'

// ===========================
// Helpers
// ===========================

const StarDisplay = ({ value, size = 14 }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={size}
        className={s <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
    ))}
  </div>
)

// ===========================
// Hooks
// ===========================

const useVendorSummary = (vendorId) => useQuery({
  queryKey: ['vendor-review-summary', vendorId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.REVIEWS.VENDOR_SUMMARY(vendorId))
    return r.data.data || r.data
  },
  enabled: !!vendorId,
  staleTime: 5 * 60 * 1000,
})

const useVendorProducts = (vendorId) => useQuery({
  queryKey: ['vendor-products', vendorId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId))
    return r.data.data || r.data
  },
  enabled: !!vendorId,
  staleTime: 5 * 60 * 1000,
})

const useProductReviews = (productId, params = {}) => useQuery({
  queryKey: ['product-reviews', productId, params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.REVIEWS.BASE, { ProductId: productId, ...params })
    const raw = r.data
    if (raw?.data && raw?.pagination) {
      return {
        items:      Array.isArray(raw.data) ? raw.data : [],
        totalPages: raw.pagination.totalPages ?? 1,
        total:      raw.pagination.total ?? 0,
      }
    }
    return { items: Array.isArray(raw?.data) ? raw.data : [], totalPages: 1, total: 0 }
  },
  enabled: !!productId,
  staleTime: 2 * 60 * 1000,
})

const useProductSummary = (productId) => useQuery({
  queryKey: ['product-review-summary', productId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.REVIEWS.PRODUCT_SUMMARY(productId))
    return r.data.data || r.data
  },
  enabled: !!productId,
  staleTime: 5 * 60 * 1000,
})

// ===========================
// Summary Card
// ===========================

const SummaryCard = ({ summary, isLoading }) => {
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )

  const avg   = summary?.averageRating ?? 0
  const total = summary?.totalReviews  ?? 0
  const dist  = summary?.distribution  ?? {}

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart2 size={18} className="text-primary" />ملخص التقييمات
      </h2>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="text-center sm:w-36">
          <p className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</p>
          <StarDisplay value={Math.round(avg)} size={18} />
          <p className="text-sm text-gray-500 mt-1">{total} تقييم</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5,4,3,2,1].map(star => {
            const count = dist[star] ?? dist[String(star)] ?? 0
            const pct   = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-xs text-gray-500">{star}</span>
                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className="bg-yellow-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-5 text-xs text-gray-400 text-left">{count}</span>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 sm:w-36">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-600">{summary?.totalVerified ?? 0}</p>
            <p className="text-xs text-gray-500">مشتري موثق</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{summary?.totalWithImages ?? 0}</p>
            <p className="text-xs text-gray-500">مع صور</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================
// Product Reviews Row
// ===========================

// ===========================
// رد البائع على تقييم: كتابة، تعديل، حذف
// ===========================
const VendorReplyBox = ({ review, productId }) => {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.vendorReply || '')

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (reply) => reply
      ? apiPut(API_ENDPOINTS.REVIEWS.REPLY(review.id), { reply })
      : apiDelete(API_ENDPOINTS.REVIEWS.REPLY(review.id)),
    onSuccess: (_, reply) => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] })
      queryClient.invalidateQueries({ queryKey: ['vendor-reviews-feed'] })
      setEditing(false)
      success(reply ? 'تم نشر ردك — يظهر للزبائن تحت التقييم' : 'تم حذف الرد')
    },
    onError: (err) => showError(err.message || 'تعذّر حفظ الرد'),
  })

  if (editing) {
    return (
      <div className="mt-3" onClick={e => e.stopPropagation()}>
        <textarea value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} autoFocus
          placeholder="اكتب رداً لطيفاً — يراه كل الزبائن تحت التقييم"
          className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">{text.length}/1000</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setText(review.vendorReply || '') }}
              className="h-9 px-4 rounded-xl text-sm text-gray-600 hover:bg-gray-100">إلغاء</button>
            <button type="button" disabled={saving || !text.trim()} onClick={() => save(text.trim())}
              className="h-9 px-4 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'جارٍ الحفظ...' : 'نشر الرد'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (review.vendorReply) {
    return (
      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-blue-700">
            ردك{review.vendorReplyAt ? ` · ${formatDate(review.vendorReplyAt)}` : ''}
          </p>
          <div className="flex gap-1">
            <button type="button" aria-label="تعديل الرد" onClick={() => { setText(review.vendorReply); setEditing(true) }}
              className="w-7 h-7 rounded-lg text-blue-600 hover:bg-blue-100 flex items-center justify-center"><Pencil size={13} /></button>
            <button type="button" aria-label="حذف الرد" disabled={saving}
              onClick={() => { if (window.confirm('حذف ردك على هذا التقييم؟')) save(null) }}
              className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        </div>
        <p className="text-sm text-blue-800 whitespace-pre-line">{review.vendorReply}</p>
      </div>
    )
  }

  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5">
      <Reply size={14} /> ردّ على التقييم
    </button>
  )
}

const ProductReviewsRow = ({ product }) => {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage]         = useState(1)
  const queryClient = useQueryClient()

  const { mutate: markHelpful } = useMutation({
    mutationFn: async ({ id, isHelpful }) => {
      if (isHelpful) {
        await apiDelete(API_ENDPOINTS.REVIEWS.HELPFUL(id))
      } else {
        await apiPost(API_ENDPOINTS.REVIEWS.HELPFUL(id))
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-reviews', product.id] }),
  })

  const { data: summary } = useProductSummary(product.id)
  const { data, isLoading } = useProductReviews(product.id, {
    PageNumber: page, PageSize: 5,
  })

  const reviews    = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const avg        = summary?.averageRating ?? 0
  const total      = summary?.totalReviews  ?? 0

  const imgSrc = getImageUrl(product.primaryImageUrl) ||
    getImageUrl(product.images?.find(i => i.isPrimary)?.imageUrl)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Product Header */}
      <div
        className="flex items-center gap-3 p-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-12 h-12 rounded-lg product-media overflow-hidden flex-shrink-0">
          {imgSrc
            ? <img src={imgSrc} alt="" className="w-full h-full object-cover"
                onError={e => e.target.style.display='none'} />
            : <Package size={20} className="m-auto text-gray-300 mt-3" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{product.nameAr || product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StarDisplay value={Math.round(avg)} size={12} />
            <span className="text-xs text-gray-500">{avg.toFixed(1)} ({total} تقييم)</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {/* Reviews List */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
          {isLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد تقييمات لهذا المنتج</p>
          ) : (
            <>
              {reviews.map(review => (
                <div key={review.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
                        {review.userFullName?.charAt(0) || 'م'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{review.userFullName || 'مستخدم'}</p>
                        <p className="text-xs text-gray-400">{formatDate(review.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarDisplay value={review.rating} size={12} />
                      {review.isVerifiedPurchase && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓ مشتري</span>
                      )}
                    </div>
                  </div>

                  {review.title && <p className="font-semibold text-gray-800 text-sm mb-1">{review.title}</p>}
                  {review.body  && <p className="text-gray-600 text-sm leading-relaxed">{review.body}</p>}

                  {review.images?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {review.images.map((img, i) => (
                        <img key={i} src={getImageUrl(img.imageUrl) || img.url || img}
                          alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                          onError={e => e.target.style.display='none'} />
                      ))}
                    </div>
                  )}

                  {/* Helpful button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); markHelpful({ id: review.id, isHelpful: review.isCurrentUserVotedHelpful }) }}
                    className={`flex items-center gap-1 mt-2 text-xs transition-colors ${
                      review.isCurrentUserVotedHelpful
                        ? 'text-primary font-medium'
                        : 'text-gray-400 hover:text-primary'
                    }`}
                  >
                    <ThumbsUp size={11} fill={review.isCurrentUserVotedHelpful ? 'currentColor' : 'none'} />
                    <span>مفيد ({review.helpfulCount ?? 0})</span>
                  </button>

                  {/* رد البائع */}
                  <VendorReplyBox review={review} productId={product.id} />
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ===========================
// كل التقييمات في قائمة واحدة (الأحدث أولاً) — مع «بلا رد» حتى لا يفوت التاجر تقييماً
// ===========================
const useReviewsFeed = (vendorId, params) => useQuery({
  queryKey: ['vendor-reviews-feed', vendorId, params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.REVIEWS(vendorId), params)
    return { items: r.data?.data || [], totalPages: r.data?.pagination?.totalPages ?? 1, unanswered: r.data?.unansweredCount ?? 0 }
  },
  enabled: !!vendorId,
  staleTime: 60 * 1000,
  placeholderData: (prev) => prev,
})

const ReviewsFeed = ({ vendorId, unansweredOnly }) => {
  const [rating, setRating] = useState(null)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [unansweredOnly, rating])
  const { data, isLoading } = useReviewsFeed(vendorId, { unanswered: unansweredOnly, rating: rating ?? undefined, pageNumber: page, pageSize: 15 })
  const items = data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {[null, 5, 4, 3, 2, 1].map(r => (
          <button key={r ?? 'all'} onClick={() => setRating(r)}
            className={`h-8 px-3 rounded-full text-sm border whitespace-nowrap ${rating === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
            {r ? `${r} ⭐` : 'كل النجوم'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title={unansweredOnly ? 'لا توجد تقييمات تنتظر ردك 👌' : 'لا توجد تقييمات'} description="" />
      ) : (
        <>
          {items.map(review => (
            <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg product-media overflow-hidden flex-shrink-0">
                  {review.productImageUrl && <img src={getImageUrl(review.productImageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{review.productName}</p>
                  <p className="text-xs text-gray-400">{review.customerName || 'زبون'} · {formatDate(review.createdAt)}</p>
                </div>
                <StarDisplay value={review.rating} />
              </div>
              {review.title && <p className="font-medium text-gray-900 text-sm mt-3">{review.title}</p>}
              {review.body && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{review.body}</p>}
              {review.images?.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {review.images.map((img, i) => (
                    <img key={i} src={getImageUrl(img)} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" onError={e => { e.target.style.display = 'none' }} />
                  ))}
                </div>
              )}
              <VendorReplyBox review={review} productId={review.productId} />
            </div>
          ))}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex justify-center pt-2"><Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} /></div>
          )}
        </>
      )}
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const VendorReviews = () => {
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id

  const { data: summary, isLoading: summaryLoading, refetch } = useVendorSummary(vendorId)
  const { data: productsData, isLoading: productsLoading }    = useVendorProducts(vendorId)

  const products = Array.isArray(productsData) ? productsData : []
  // عدد التقييمات بلا رد — يحدد التبويب الافتراضي
  const { data: unansweredData } = useReviewsFeed(vendorId, { unanswered: true, pageNumber: 1, pageSize: 1 })
  const unanswered = unansweredData?.unanswered ?? 0
  const [tab, setTab] = useState(null)
  const activeTab = tab ?? (unanswered > 0 ? 'unanswered' : 'all')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقييمات</h1>
          <p className="text-gray-500 mt-1">ما يقوله العملاء عن منتجاتك</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Summary */}
      <SummaryCard summary={summary} isLoading={summaryLoading} />

      {/* التبويبات */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'unanswered', label: 'بانتظار ردك', count: unanswered },
          { key: 'all', label: 'كل التقييمات' },
          { key: 'products', label: 'حسب المنتج' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 ${activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
            {t.count > 0 && <span className="text-[11px] min-w-5 px-1.5 rounded-full bg-amber-400 text-white">{t.count}</span>}
          </button>
        ))}
      </div>

      {activeTab !== 'products' && <ReviewsFeed vendorId={vendorId} unansweredOnly={activeTab === 'unanswered'} />}

      {/* Products + Reviews */}
      {activeTab === 'products' && <div className="space-y-4">
        {productsLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : products.length === 0 ? (
          <EmptyState title="لا توجد منتجات" description="أضف منتجات لتبدأ باستقبال التقييمات" />
        ) : (
          products.map(product => (
            <ProductReviewsRow key={product.id} product={product} />
          ))
        )}
      </div>}
    </div>
  )
}

export default VendorReviews