import { apiGet, apiPost, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Wishlist Service - خدمة المفضلات
 * ✅ إصلاح: توحيد جميع الـ return values — كلها ترجع response.data.data
 *    مثل باقي الـ services في المشروع (productService, vendorService, etc.)
 */
export const wishlistService = {

  /**
   * جلب جميع المفضلات
   */
  getAll: async () => {
    const response = await apiGet(API_ENDPOINTS.WISHLIST.BASE);
    return response.data.data ?? response.data;
  },

  /**
   * عدد المنتجات المفضلة
   */
  getCount: async () => {
    const response = await apiGet(API_ENDPOINTS.WISHLIST.COUNT);
    return response.data.data ?? response.data;
  },

  /**
   * التحقق من وجود منتج في المفضلة
   * @param {string} productId
   */
  checkProduct: async (productId) => {
    const response = await apiGet(API_ENDPOINTS.WISHLIST.CHECK(productId));
    return response.data.data ?? response.data;
  },

  /**
   * إضافة منتج للمفضلة
   * @param {string} productId
   */
  addItem: async (productId) => {
    const response = await apiPost(API_ENDPOINTS.WISHLIST.ADD, { productId });
    return response.data.data ?? response.data;
  },

  /**
   * حذف منتج من المفضلة
   * @param {string} productId
   */
  removeItem: async (productId) => {
    const response = await apiDelete(API_ENDPOINTS.WISHLIST.REMOVE(productId));
    return response.data.data ?? response.data;
  },

  /**
   * إضافة / حذف منتج (Toggle)
   * @param {string} productId
   */
  toggleItem: async (productId) => {
    const response = await apiPost(API_ENDPOINTS.WISHLIST.TOGGLE, {
      productId: String(productId),
    });
    return response.data.data ?? response.data;
  },

  /**
   * حذف جميع المنتجات من المفضلة
   */
  clear: async () => {
    const response = await apiDelete(API_ENDPOINTS.WISHLIST.CLEAR);
    return response.data.data ?? response.data;
  },
};

export default wishlistService;