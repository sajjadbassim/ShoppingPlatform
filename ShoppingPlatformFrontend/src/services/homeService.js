import { apiGet, apiPost, apiPut, apiPostForm, apiPutForm, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Home Service - إدارة بانرات وأقسام الصفحة الرئيسية
 */
export const homeService = {
  // ============ Banners ============
  getBanners: async (onlyActive = false) => {
    const r = await apiGet(API_ENDPOINTS.HOME.BANNERS, { onlyActive });
    return r.data.data || r.data;
  },

  createBanner: async (formData) => {
    const r = await apiPostForm(API_ENDPOINTS.HOME.BANNERS, formData);
    return r.data.data || r.data;
  },

  updateBanner: async (id, formData) => {
    const r = await apiPutForm(API_ENDPOINTS.HOME.BANNER_BY_ID(id), formData);
    return r.data.data || r.data;
  },

  deleteBanner: async (id) => {
    const r = await apiDelete(API_ENDPOINTS.HOME.BANNER_BY_ID(id));
    return r.data;
  },

  // ============ Sections ============
  getSections: async (onlyActive = false) => {
    const r = await apiGet(API_ENDPOINTS.HOME.SECTIONS, { onlyActive });
    return r.data.data || r.data;
  },

  createSection: async (dto) => {
    const r = await apiPost(API_ENDPOINTS.HOME.SECTIONS, dto);
    return r.data.data || r.data;
  },

  updateSection: async (id, dto) => {
    const r = await apiPut(API_ENDPOINTS.HOME.SECTION_BY_ID(id), dto);
    return r.data.data || r.data;
  },

  deleteSection: async (id) => {
    const r = await apiDelete(API_ENDPOINTS.HOME.SECTION_BY_ID(id));
    return r.data;
  },

  addSectionItem: async (sectionId, productId, displayOrder = 0) => {
    const r = await apiPost(API_ENDPOINTS.HOME.SECTION_ITEMS(sectionId), { productId, displayOrder });
    return r.data.data || r.data;
  },

  removeSectionItem: async (sectionId, productId) => {
    const r = await apiDelete(API_ENDPOINTS.HOME.SECTION_ITEM_DELETE(sectionId, productId));
    return r.data;
  },
};

export default homeService;
