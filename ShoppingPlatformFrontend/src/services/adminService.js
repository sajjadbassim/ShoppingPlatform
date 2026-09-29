import { apiGet, apiPost, apiPut, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const adminService = {

  // ============ Dashboard ============
  getDashboardStats: async () => {
    const response = await apiGet(API_ENDPOINTS.ADMIN.DASHBOARD_STATS)
    return response.data.data || response.data
  },

  // ============ Users ============
  // ✅ API يقبل role بحروف كبيرة: CUSTOMER, VENDOR, ADMIN, OPS
  getUsers: async (role = null) => {
    const params = role ? { role } : {}
    const response = await apiGet(API_ENDPOINTS.ADMIN.USERS, params)
    return response.data.data || response.data
  },

  // بحث على الخادم بالاسم/الهاتف/البريد — يُرجع PagedResponse { data, totalCount, totalPages, ... }
  searchUsers: async ({ term, role, pageNumber = 1, pageSize = 10 } = {}) => {
    const params = { pageNumber, pageSize }
    if (term) params.term = term
    if (role) params.role = role
    const response = await apiGet(API_ENDPOINTS.ADMIN.SEARCH_USERS, params)
    return response.data.data || response.data
  },

  createOpsUser: async (userData) => {
    const response = await apiPost(API_ENDPOINTS.ADMIN.CREATE_OPS_USER, userData)
    return response.data.data || response.data
  },

  toggleUserStatus: async (userId) => {
    const response = await apiPut(API_ENDPOINTS.ADMIN.TOGGLE_USER_STATUS(userId))
    return response.data.data || response.data
  },

  deleteUser: async (userId) => {
    const response = await apiDelete(API_ENDPOINTS.ADMIN.DELETE_USER(userId))
    return response.data.data || response.data
  },

  // ============ Vendors ============
  // ✅ API يقبل isActive كـ boolean أو بدونه لجلب الكل
  getVendors: async (isActive = null) => {
    const params = isActive !== null ? { isActive } : {}
    const response = await apiGet(API_ENDPOINTS.ADMIN.VENDORS, params)
    return response.data.data || response.data
  },

  toggleVendorStatus: async (vendorId) => {
    const response = await apiPut(API_ENDPOINTS.ADMIN.TOGGLE_VENDOR_STATUS(vendorId))
    return response.data.data || response.data
  },

  // ============ Products ============
  getProducts: async (isActive = null) => {
    const params = isActive !== null ? { isActive } : {}
    const response = await apiGet(API_ENDPOINTS.ADMIN.PRODUCTS, params)
    return response.data.data || response.data
  },

  toggleProductStatus: async (productId) => {
    const response = await apiPut(API_ENDPOINTS.ADMIN.TOGGLE_PRODUCT_STATUS(productId))
    return response.data.data || response.data
  },

  bulkUpdateProductStatus: async (data) => {
    const response = await apiPut(API_ENDPOINTS.ADMIN.BULK_UPDATE_STATUS, data)
    return response.data.data || response.data
  },

  // ============ Reports ============
  getSalesReport: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.SALES, params)
    return response.data.data || response.data
  },

  getTopVendors: async (count = 10) => {
    const response = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_VENDORS, { count })
    return response.data.data || response.data
  },

  getTopProducts: async (count = 10) => {
    const response = await apiGet(API_ENDPOINTS.ADMIN.REPORTS.TOP_PRODUCTS, { count })
    return response.data.data || response.data
  },
}

export default adminService