import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, apiPutForm, apiPatch } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const vendorService = {

  getAll: async (onlyActive = true) => {
    const response = await apiGet(API_ENDPOINTS.VENDORS.BASE, { onlyActive });
    return response.data.data;
  },

  // ✅ إصلاح — يرجع { items, totalPages, totalCount }
  getPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.VENDORS.PAGED, params);
    const raw = response.data
    if (raw?.data && raw?.pagination) {
      return {
        items:      Array.isArray(raw.data) ? raw.data : [],
        totalPages: raw.pagination.totalPages  ?? 1,
        totalCount: raw.pagination.totalCount  ?? 0,
        currentPage: raw.pagination.currentPage ?? 1,
      }
    }
    // fallback
    const list = raw?.data || raw || []
    return { items: Array.isArray(list) ? list : [], totalPages: 1, totalCount: Array.isArray(list) ? list.length : 0 }
  },

  getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.VENDORS.BY_ID(id));
    return response.data.data;
  },

  getByPhone: async (phone) => {
    const response = await apiGet(API_ENDPOINTS.VENDORS.BY_PHONE(phone));
    return response.data.data;
  },

  getDashboard: async (vendorId) => {
    const response = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.BASE(vendorId));
    return response.data.data || response.data;
  },

  getSalesStats: async (vendorId, params = {}) => {
    const response = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.SALES(vendorId), params);
    return response.data.data || response.data;
  },

  getDashboardOrders: async (vendorId, params = {}) => {
    const response = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDERS(vendorId), params);
    return response.data.data || response.data;
  },

  getDashboardOrderById: async (vendorId, subOrderId) => {
    const response = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.ORDER_BY_ID(vendorId, subOrderId));
    return response.data.data || response.data;
  },

  confirmOrder: async (vendorId, subOrderId) => {
    const response = await apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.CONFIRM_ORDER(vendorId, subOrderId));
    return response.data.data || response.data;
  },

  rejectOrder: async (vendorId, subOrderId, reason = '') => {
    const response = await apiPost(API_ENDPOINTS.VENDOR_DASHBOARD.REJECT_ORDER(vendorId, subOrderId), { reason });
    return response.data.data || response.data;
  },

  getDashboardProducts: async (vendorId, params = {}) => {
    const response = await apiGet(API_ENDPOINTS.VENDOR_DASHBOARD.PRODUCTS(vendorId), params);
    return response.data.data || response.data;
  },

  create: async (vendorData, logo = null) => {
    const formData = new FormData();
    Object.keys(vendorData).forEach(key => {
      if (vendorData[key] !== undefined && vendorData[key] !== null)
        formData.append(key, vendorData[key]);
    });
    if (logo) formData.append('Logo', logo);
    const response = await apiPostForm(API_ENDPOINTS.VENDORS.BASE, formData);
    return response.data.data;
  },

  update: async (id, vendorData, newLogo = null) => {
    const formData = new FormData();
    Object.keys(vendorData).forEach(key => {
      if (vendorData[key] !== undefined && vendorData[key] !== null)
        formData.append(key, vendorData[key]);
    });
    if (newLogo) formData.append('NewLogo', newLogo);
    const response = await apiPutForm(API_ENDPOINTS.VENDORS.BY_ID(id), formData);
    return response.data.data;
  },

  delete: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.VENDORS.BY_ID(id));
    return response.data.data;
  },

  uploadLogo: async (vendorId, logo) => {
    const formData = new FormData();
    formData.append('logo', logo);
    const response = await apiPostForm(API_ENDPOINTS.VENDORS.LOGO(vendorId), formData);
    return response.data.data;
  },

  deleteLogo: async (vendorId) => {
    const response = await apiDelete(API_ENDPOINTS.VENDORS.LOGO(vendorId));
    return response.data.data;
  },
};

export default vendorService;