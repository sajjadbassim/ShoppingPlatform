// src/hooks/useReviews.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewsService } from '../services/reviewsService'

// ===========================
// Query Keys
// ===========================
export const reviewKeys = {
  all: ['reviews'],
  list: (params) => [...reviewKeys.all, 'list', params],
  summary: (productId) => [...reviewKeys.all, 'summary', productId],
  detail: (id) => [...reviewKeys.all, id],
}

// ===========================
// Queries
// ===========================

/**
 * جلب تقييمات منتج
 * الاستخدام: const { data } = useProductReviews({ ProductId: id, PageSize: 5 })
 */
export const useProductReviews = (params = {}) => {
  return useQuery({
    queryKey: reviewKeys.list(params),
    queryFn: () => reviewsService.getReviews(params),
    enabled: !!params.ProductId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * جلب ملخص تقييمات منتج (متوسط + توزيع النجوم)
 * الاستخدام: const { data: summary } = useProductReviewSummary(productId)
 */
export const useProductReviewSummary = (productId) => {
  return useQuery({
    queryKey: reviewKeys.summary(productId),
    queryFn: () => reviewsService.getProductSummary(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ===========================
// Mutations
// ===========================

export const useCreateReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData) => reviewsService.createReview(formData),
    onSuccess: (review, formData) => {
      const productId = formData.get?.('ProductId')
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
      // التقييم يمنح نقاط ولاء — تحديث الرصيد والسجل
      if (review?.pointsEarned > 0) {
        queryClient.invalidateQueries({ queryKey: ['loyalty-account'] })
        queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] })
      }
      if (productId) {
        queryClient.invalidateQueries({ queryKey: reviewKeys.summary(productId) })
      }
    },
  })
}

export const useDeleteReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => reviewsService.deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}

export const useMarkHelpful = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isHelpful }) =>
      isHelpful ? reviewsService.unmarkHelpful(id) : reviewsService.markHelpful(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}

export const useReportReview = () => {
  return useMutation({
    mutationFn: ({ id, data }) => reviewsService.reportReview(id, data),
  })
}