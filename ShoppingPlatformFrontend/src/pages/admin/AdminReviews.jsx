// src/pages/admin/AdminReviews.jsx
import { useState } from 'react'
import {
  Star, Flag, Check, Trash2, RefreshCw, Eye, Package,
  ThumbsUp, MessageSquare, AlertTriangle, BarChart2, Store, Truck,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getVendorLogo } from '../../utils/imageHelper'

// ===========================
// Helpers
// ===========================

const StarDisplay = ({ value, size = 14 }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={size} className={s <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
    ))}
  </div>
)

// ===========================
// Hooks
// ===========================

const useAdminRatingStats = () => useQuery({
  queryKey: ['admin-rating-stats'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.RATING_ADMIN.STATS)
    return r.data.data || r.data
  },
  staleTime: 5 * 60 * 1000,
})

const useAdminRatings = (params = {}) => useQuery({
  queryKey: ['admin-ratings', params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.RATING_ADMIN.ALL, params)
    return r.data.data || r.data
  },
  staleTime: 2 * 60 * 1000,
})

const useReportedReviews = (params = {}) => useQuery({
  queryKey: ['reported-reviews', params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.REVIEWS.REPORTED, params)
    return r.data.data || r.data
  },
  staleTime: 2 * 60 * 1000,
})

const useApproveReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiPut(API_ENDPOINTS.REVIEWS.APPROVE(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reported-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ratings'] })
    },
  })
}

const useRejectReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiDelete(API_ENDPOINTS.REVIEWS.REJECT(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reported-reviews'] })
    },
  })
}

const useProductReviews = (params = {}) => useQuery({
  queryKey: ['admin-product-reviews', params],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.REVIEWS.BASE, params)
    const raw = r.data
    if (raw?.data && raw?.pagination) {
      return { items: Array.isArray(raw.data) ? raw.data : [], totalPages: raw.pagination.totalPages ?? 1, total: raw.pagination.total ?? 0 }
    }
    return { items: Array.isArray(raw?.data) ? raw.data : [], totalPages: 1, total: 0 }
  },
  staleTime: 2 * 60 * 1000,
})

const useDriversList = () => useQuery({
  queryKey: ['admin-drivers-for-ratings'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.DRIVERS.PAGED, { pageNumber: 1, pageSize: 50 })
    const raw = r.data
    return raw?.data?.items ?? raw?.items ?? []
  },
  staleTime: 10 * 60 * 1000,
})

const useVendorsList = () => useQuery({
  queryKey: ['admin-vendors-for-ratings'],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.ADMIN.VENDORS)
    return r.data.data || r.data
  },
  staleTime: 10 * 60 * 1000,
})

const useVendorRating = (vendorId) => useQuery({
  queryKey: ['vendor-rating-admin', vendorId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.RATING_ADMIN.BY_VENDOR(vendorId))
    return r.data.data || r.data
  },
  enabled: !!vendorId,
  staleTime: 5 * 60 * 1000,
})

const useDeleteReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiDelete(API_ENDPOINTS.REVIEWS.BY_ID(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-product-reviews'] }),
  })
}

// ===========================
// Stats Cards
// ===========================

const StatsSection = ({ stats, isLoading }) => {
  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )

  // ✅ API يرجع: totalRatings, averageDeliveryRating, averageSpeedRating, recommendPercentage
  const avgOverall = stats
    ? ((
        (stats.averageDeliveryRating ?? 0) +
        (stats.averageSpeedRating    ?? 0) +
        (stats.averagePackagingRating ?? 0)
      ) / 3).toFixed(1)
    : '0.0'

  const cards = [
    { label: 'إجمالي التقييمات',   value: stats?.totalRatings          ?? 0,              icon: Star,         color: 'yellow' },
    { label: 'متوسط التقييم العام', value: `${avgOverall} ⭐`,                              icon: BarChart2,    color: 'blue'   },
    { label: 'نسبة التوصية',        value: `${stats?.recommendPercentage ?? 0}%`,           icon: ThumbsUp,     color: 'green'  },
    { label: 'متوسط التوصيل',       value: (stats?.averageDeliveryRating ?? 0).toFixed(1), icon: MessageSquare, color: 'red'   },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className={`w-11 h-11 bg-${c.color}-100 rounded-xl flex items-center justify-center`}>
            <c.icon size={20} className={`text-${c.color}-600`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ===========================
// Order Ratings Tab
// ===========================

const OrderRatingsTab = () => {
  const [page, setPage] = useState(1)
  const { data, isLoading, refetch } = useAdminRatings({ pageNumber: page, pageSize: 10 })

  const ratings = data?.items ?? (Array.isArray(data) ? data : [])
  const totalPages = data?.totalPages ?? 1

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
    </div>
  )

  if (ratings.length === 0) return (
    <EmptyState title="لا توجد تقييمات" description="لم يتم تقييم أي طلب بعد" />
  )

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['الطلب', 'العميل', 'التوصيل', 'السرعة', 'التغليف', 'المتوسط', 'يوصي؟', 'التاريخ'].map(h => (
                <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ratings.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-primary">#{r.orderNumber}</td>
                <td className="px-4 py-3 text-gray-700">{r.customerName}</td>
                <td className="px-4 py-3"><StarDisplay value={r.deliveryRating} /></td>
                <td className="px-4 py-3"><StarDisplay value={r.speedRating} /></td>
                <td className="px-4 py-3"><StarDisplay value={r.packagingRating} /></td>
                <td className="px-4 py-3">
                  <span className="font-bold text-gray-900">{(r.overallAverage ?? 0).toFixed(1)}</span>
                </td>
                <td className="px-4 py-3">
                  {r.wouldRecommend
                    ? <span className="text-green-600 flex items-center gap-1"><ThumbsUp size={13} />نعم</span>
                    : <span className="text-gray-400 text-xs">لا</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(r.createdAt).toLocaleDateString('ar-IQ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

// ===========================
// Reported Reviews Tab
// ===========================

const ReportedReviewsTab = () => {
  const { success, error: toastError } = useToast()
  const [page, setPage] = useState(1)
  const [selectedReview, setSelectedReview] = useState(null)

  const { data, isLoading, refetch } = useReportedReviews({ pageNumber: page, pageSize: 10 })
  const { mutateAsync: approveReview, isPending: approving } = useApproveReview()
  const { mutateAsync: rejectReview, isPending: rejecting } = useRejectReview()

  const reviews = data?.items ?? (Array.isArray(data) ? data : [])
  const totalPages = data?.totalPages ?? 1

  const handleApprove = async (id) => {
    try {
      await approveReview(id)
      success('تم قبول التقييم')
      setSelectedReview(null)
    } catch (err) {
      toastError(err.message || 'فشل قبول التقييم')
    }
  }

  const handleReject = async (id) => {
    try {
      await rejectReview(id)
      success('تم حذف التقييم')
      setSelectedReview(null)
    } catch (err) {
      toastError(err.message || 'فشل حذف التقييم')
    }
  }

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
    </div>
  )

  if (reviews.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <Flag size={40} className="mx-auto mb-3 opacity-30" />
      <p>لا توجد تقييمات مُبلَّغ عنها</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {reviews.map(review => (
        <div key={review.id} className="bg-white rounded-xl border border-orange-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {review.userName?.charAt(0) || 'م'}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{review.userName || 'مستخدم'}</p>
                  <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ar-IQ')}</p>
                </div>
                <StarDisplay value={review.rating} />
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flag size={10} />
                  {review.reportCount ?? 1} بلاغ
                </span>
              </div>
              {(review.productNameAr || review.productName) && (
                <p className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                  <Package size={11} />
                  {review.productNameAr || review.productName}
                </p>
              )}
              {review.title && <p className="font-semibold text-gray-800 text-sm mb-1">{review.title}</p>}
              {review.body && <p className="text-gray-600 text-sm line-clamp-2">{review.body}</p>}

              {review.reportReason && (
                <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded mt-2">
                  سبب البلاغ: {review.reportReason}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedReview(review)}
              >
                <Eye size={14} className="ml-1" />عرض
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={approving}
                onClick={() => handleApprove(review.id)}
              >
                <Check size={14} className="ml-1" />قبول
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={rejecting}
                onClick={() => handleReject(review.id)}
              >
                <Trash2 size={14} className="ml-1" />حذف
              </Button>
            </div>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Review Detail Modal */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title="تفاصيل التقييم"
        size="md"
      >
        {selectedReview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {selectedReview.userName?.charAt(0) || 'م'}
              </div>
              <div>
                <p className="font-medium">{selectedReview.userName}</p>
                <StarDisplay value={selectedReview.rating} size={16} />
              </div>
            </div>

            {selectedReview.title && (
              <p className="font-semibold text-gray-800">{selectedReview.title}</p>
            )}
            {selectedReview.body && (
              <p className="text-gray-600 text-sm leading-relaxed">{selectedReview.body}</p>
            )}

            {selectedReview.images?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {selectedReview.images.map((img, i) => (
                  <img key={i} src={img.url || img} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                ))}
              </div>
            )}

            {selectedReview.reportReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-700">سبب البلاغ:</p>
                <p className="text-sm text-red-600">{selectedReview.reportReason}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setSelectedReview(null)}>إغلاق</Button>
              <Button variant="primary" fullWidth loading={approving} onClick={() => handleApprove(selectedReview.id)}>
                <Check size={14} className="ml-1" />قبول التقييم
              </Button>
              <Button variant="danger" fullWidth loading={rejecting} onClick={() => handleReject(selectedReview.id)}>
                <Trash2 size={14} className="ml-1" />حذف التقييم
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


// ===========================
// Product Reviews Tab
// ===========================

const ProductReviewsTab = () => {
  const { success, error: toastError } = useToast()
  const [page, setPage] = useState(1)
  const [ratingFilter, setRatingFilter] = useState('')
  const [selectedReview, setSelectedReview] = useState(null)

  const { data, isLoading } = useProductReviews({
    PageNumber: page,
    PageSize: 10,
    Rating: ratingFilter || undefined,
  })
  const { mutateAsync: deleteReview, isPending: deleting } = useDeleteReview()

  const reviews = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا التقييم؟')) return
    try {
      await deleteReview(id)
      success('تم حذف التقييم')
      setSelectedReview(null)
    } catch (err) {
      toastError(err.message || 'فشل الحذف')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} تقييم</p>
        <div className="flex gap-1">
          {['', '5', '4', '3', '2', '1'].map(r => (
            <button key={r}
              onClick={() => { setRatingFilter(r); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                ratingFilter === r ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:border-primary'
              }`}>
              {r ? `${r} ⭐` : 'الكل'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : reviews.length === 0 ? (
        <EmptyState title="لا توجد تقييمات" description="لا توجد تقييمات للمنتجات" />
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                      {review.userFullName?.charAt(0) || 'م'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{review.userFullName || 'مستخدم'}</p>
                      <div className="flex items-center gap-2">
                        <StarDisplay value={review.rating} size={12} />
                        <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ar-IQ')}</span>
                        {review.isVerifiedPurchase && (
                          <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">شراء موثق</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {review.title && <p className="font-semibold text-gray-800 text-sm mb-1">{review.title}</p>}
                  {review.body && <p className="text-gray-600 text-sm line-clamp-2">{review.body}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                    <span>👍 {review.helpfulCount} مفيد</span>
                    {review.vendorReply && <span className="text-blue-500">رد المتجر ✓</span>}
                    {review.productId && (
                      <Link to={`/products/${review.productId}`} target="_blank"
                        className="flex items-center gap-1 text-primary hover:underline">
                        <Package size={11} />
                        عرض المنتج
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReview(review)}>
                    <Eye size={13} className="ml-1" />عرض
                  </Button>
                  <Button variant="danger" size="sm" loading={deleting} onClick={() => handleDelete(review.id)}>
                    <Trash2 size={13} className="ml-1" />حذف
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedReview} onClose={() => setSelectedReview(null)} title="تفاصيل التقييم" size="md">
        {selectedReview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {selectedReview.userFullName?.charAt(0) || 'م'}
              </div>
              <div>
                <p className="font-medium">{selectedReview.userFullName}</p>
                <StarDisplay value={selectedReview.rating} size={16} />
              </div>
              {selectedReview.isVerifiedPurchase && (
                <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">شراء موثق</span>
              )}
            </div>
            {(selectedReview.productNameAr || selectedReview.productId) && (
              <div className="flex items-center gap-2 text-sm bg-primary/5 px-3 py-2 rounded-lg">
                <Package size={14} className="text-primary" />
                <span className="text-primary font-medium">
                  {selectedReview.productNameAr || selectedReview.productName || selectedReview.productId.slice(0,8)+'...'}
                </span>
                <Link to={`/products/${selectedReview.productId}`} target="_blank"
                  className="text-xs text-gray-400 hover:underline mr-auto">
                  عرض ←
                </Link>
              </div>
            )}
            {selectedReview.title && <p className="font-semibold text-gray-800">{selectedReview.title}</p>}
            {selectedReview.body && <p className="text-gray-600 text-sm leading-relaxed">{selectedReview.body}</p>}
            {selectedReview.images?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {selectedReview.images.map((img, i) => (
                  <img key={i} src={img.url || img} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                ))}
              </div>
            )}
            {selectedReview.vendorReply && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">رد المتجر:</p>
                <p className="text-sm text-blue-800">{selectedReview.vendorReply}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setSelectedReview(null)}>إغلاق</Button>
              <Button variant="danger" fullWidth loading={deleting} onClick={() => handleDelete(selectedReview.id)}>
                <Trash2 size={14} className="ml-1" />حذف التقييم
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


// ===========================
// Vendor Ratings Tab
// ===========================

const VendorRatingCard = ({ vendor }) => {
  const { data: rating, isLoading } = useVendorRating(vendor.id)

  const dist = rating?.distribution ?? {}
  const max = Math.max(...Object.values(dist), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
          {getVendorLogo(vendor)
            ? <img src={getVendorLogo(vendor)} alt="" className="w-full h-full object-cover" />
            : <Store size={18} className="text-gray-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{vendor.nameAr || vendor.name}</p>
          <p className="text-xs text-gray-400">{vendor.name}</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-left flex-shrink-0">
            <p className="text-xl font-bold text-gray-900">
              {rating?.averageRating ? rating.averageRating.toFixed(1) : '—'}
              <span className="text-sm text-yellow-400 mr-1">⭐</span>
            </p>
            <p className="text-xs text-gray-400">{rating?.totalRatings ?? 0} تقييم</p>
          </div>
        )}
      </div>

      {/* Distribution bars */}
      {!isLoading && rating?.totalRatings > 0 && (
        <div className="space-y-1">
          {[5,4,3,2,1].map(star => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-3">{star}</span>
              <Star size={10} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="bg-yellow-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.round(((dist[star] ?? 0) / max) * 100)}%` }} />
              </div>
              <span className="text-xs text-gray-400 w-3 text-left">{dist[star] ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !rating?.totalRatings && (
        <p className="text-xs text-gray-400 text-center py-2">لا توجد تقييمات بعد</p>
      )}
    </div>
  )
}

const VendorRatingsTab = () => {
  const { data: vendorsData, isLoading } = useVendorsList()
  const vendors = Array.isArray(vendorsData) ? vendorsData : (vendorsData?.items ?? [])
  const activeVendors = vendors.filter(v => v.isActive)

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  )

  if (activeVendors.length === 0) return (
    <EmptyState title="لا توجد متاجر" description="لا توجد متاجر نشطة" />
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {activeVendors.map(vendor => (
        <VendorRatingCard key={vendor.id} vendor={vendor} />
      ))}
    </div>
  )
}


// ===========================
// Driver Ratings Tab
// ===========================

const DriverRatingsTab = () => {
  const { data: drivers, isLoading } = useDriversList()

  const workStatusLabel = { available: 'متاح', busy: 'مشغول', break: 'استراحة', offline: 'غير متصل' }
  const workStatusColor = { available: 'bg-green-100 text-green-700', busy: 'bg-red-100 text-red-600', break: 'bg-yellow-100 text-yellow-700', offline: 'bg-gray-100 text-gray-500' }

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
    </div>
  )

  if (!drivers?.length) return (
    <EmptyState title="لا يوجد سائقون" description="لا يوجد سائقون مسجلون" />
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {drivers.map(driver => (
        <div key={driver.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-sm">{driver.fullName?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{driver.fullName}</p>
              <p className="text-xs text-gray-400 truncate" dir="ltr">{driver.phone}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${workStatusColor[driver.workStatus] || 'bg-gray-100 text-gray-500'}`}>
              {workStatusLabel[driver.workStatus] || driver.workStatus}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-yellow-50 rounded-lg p-2">
              <p className="font-bold text-gray-900 text-lg">
                {driver.rating ? driver.rating.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-gray-400">التقييم</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="font-bold text-gray-900 text-lg">{driver.totalDeliveries ?? 0}</p>
              <p className="text-xs text-gray-400">توصيل</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="font-bold text-gray-900 text-sm truncate">{driver.vehicleType || '—'}</p>
              <p className="text-xs text-gray-400">المركبة</p>
            </div>
          </div>

          {driver.rating > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-yellow-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${(driver.rating / 5) * 100}%` }} />
                </div>
                <StarDisplay value={Math.round(driver.rating)} size={11} />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2 truncate">
            📍 {driver.workArea || '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const AdminReviews = () => {
  const [activeTab, setActiveTab] = useState('ratings')
  const { data: stats, isLoading: statsLoading, refetch } = useAdminRatingStats()

  const tabs = [
    { key: 'ratings',  label: 'تقييمات الطلبات',     icon: Star },
    { key: 'products', label: 'تقييمات المنتجات',    icon: MessageSquare },
    { key: 'vendors',  label: 'تقييمات المتاجر',     icon: Store },
    { key: 'drivers',  label: 'تقييمات السائقين',   icon: Truck },
    { key: 'reported', label: 'تقييمات مُبلَّغ عنها', icon: Flag },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة التقييمات</h1>
          <p className="text-gray-500 mt-1">مراقبة تقييمات العملاء والإشراف عليها</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw size={16} />
        </Button>
      </div>

      {/* Stats */}
      <StatsSection stats={stats} isLoading={statsLoading} />

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'ratings'  && <OrderRatingsTab />}
          {activeTab === 'products' && <ProductReviewsTab />}
          {activeTab === 'vendors'  && <VendorRatingsTab />}
          {activeTab === 'drivers'  && <DriverRatingsTab />}
          {activeTab === 'reported' && <ReportedReviewsTab />}
        </div>
      </div>
    </div>
  )
}

export default AdminReviews