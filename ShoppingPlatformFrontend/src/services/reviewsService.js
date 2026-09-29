// src/services/reviewsService.js
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

export const reviewsService = {

  // ===========================
  // Reviews CRUD
  // ===========================

  /**
   * جلب تقييمات منتج
   * @param {Object} params - { ProductId, Rating?, VerifiedOnly?, SortBy?, PageNumber?, PageSize? }
   */
  getReviews: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.REVIEWS.BASE, params)
    return response.data.data || response.data
  },

  /**
   * جلب ملخص تقييمات منتج (متوسط + توزيع النجوم)
   * @param {string} productId
   */
  getProductSummary: async (productId) => {
    const response = await apiGet(API_ENDPOINTS.REVIEWS.PRODUCT_SUMMARY(productId))
    return response.data.data || response.data
  },

  /**
   * إنشاء تقييم جديد
   * @param {FormData} formData - { ProductId, OrderId, Rating, Title?, Body?, Images[]? }
   */
  createReview: async (formData) => {
    const response = await apiPostForm(API_ENDPOINTS.REVIEWS.BASE, formData)
    return response.data.data || response.data
  },

  /**
   * تعديل تقييم
   * @param {string} id
   * @param {FormData} formData
   */
  updateReview: async (id, formData) => {
    const response = await apiPostForm(API_ENDPOINTS.REVIEWS.BY_ID(id), formData)
    return response.data.data || response.data
  },

  /**
   * حذف تقييم
   * @param {string} id
   */
  deleteReview: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.REVIEWS.BY_ID(id))
    return response.data.data || response.data
  },

  /**
   * تحديد تقييم كمفيد
   * @param {string} id
   */
  markHelpful: async (id) => {
    const response = await apiPost(API_ENDPOINTS.REVIEWS.HELPFUL(id))
    return response.data.data || response.data
  },

  /**
   * إلغاء تحديد تقييم كمفيد
   * @param {string} id
   */
  unmarkHelpful: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.REVIEWS.HELPFUL(id))
    return response.data.data || response.data
  },

  /**
   * الإبلاغ عن تقييم
   * @param {string} id
   * @param {Object} data - { reason, details? }
   */
  reportReview: async (id, data) => {
    const response = await apiPost(API_ENDPOINTS.REVIEWS.REPORT(id), data)
    return response.data.data || response.data
  },

  // ===========================
  // Helpers
  // ===========================

  /**
   * بناء FormData لإنشاء تقييم
   */
  buildFormData: ({ productId, orderId, rating, title, body, images = [] }) => {
    const fd = new FormData()
    fd.append('ProductId', productId)
    fd.append('OrderId', orderId)
    fd.append('Rating', rating)
    if (title)  fd.append('Title', title)
    if (body)   fd.append('Body', body)
    images.forEach(img => fd.append('Images', img))
    return fd
  },
}

export default reviewsService