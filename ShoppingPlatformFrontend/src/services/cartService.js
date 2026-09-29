import { apiGet, apiPost, apiPut, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const cartService = {
  get: async () => {
    const response = await apiGet(API_ENDPOINTS.CART.BASE);
    return response.data.data;
  },

  addItem: async (item) => {
    // item: { productId, quantity, variantId? }
    const response = await apiPost(API_ENDPOINTS.CART.ADD, item);
    return response.data.data;
  },

  updateItem: async (item, userId = null) => {
    // item: { productId, quantity, variantId? }
    const url = userId
      ? `${API_ENDPOINTS.CART.UPDATE}?userId=${userId}`
      : API_ENDPOINTS.CART.UPDATE;
    const response = await apiPut(url, item);
    return response.data.data;
  },

  // ✅ أضف variantId كـ query parameter
  removeItem: async (productId, userId = null, variantId = null) => {
    let url = API_ENDPOINTS.CART.REMOVE(productId)
    const params = new URLSearchParams()
    if (userId)    params.append('userId', userId)
    if (variantId) params.append('variantId', variantId)
    const queryString = params.toString()
    if (queryString) url += `?${queryString}`
    const response = await apiDelete(url);
    return response.data.data;
  },

  clear: async (userId = null) => {
    const url = userId
      ? `${API_ENDPOINTS.CART.CLEAR}?userId=${userId}`
      : API_ENDPOINTS.CART.CLEAR;
    const response = await apiDelete(url);
    return response.data.data;
  },

  calculateTotal: (items) =>
    items.reduce((total, item) => total + (item.price * item.quantity), 0),

  getItemsCount: (items) =>
    items.reduce((count, item) => count + item.quantity, 0),
};

export default cartService;