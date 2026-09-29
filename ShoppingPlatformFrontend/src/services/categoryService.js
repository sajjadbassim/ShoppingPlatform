import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, apiPutForm } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Category Service - خدمة التصنيفات
 */
export const categoryService = {
  /**
   * الحصول على جميع التصنيفات
   * @param {boolean} [onlyActive=true] - النشطة فقط
   */
  getAll: async (onlyActive = true) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.BASE, { onlyActive });
    return response.data.data || response.data;
  },

  /**
   * الحصول على التصنيفات مع التصفح
   * @param {Object} params - معاملات البحث
   */
  getPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.PAGED, params);
    return response.data.data;
  },

  /**
   * الحصول على تصنيف بالمعرف
   * @param {string} id - معرف التصنيف
   */
  getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.BY_ID(id));
    return response.data.data;
  },

  /**
   * الحصول على التصنيفات الجذرية
   * @param {boolean} [onlyActive=true] - النشطة فقط
   */
  getRoot: async (onlyActive = true) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.ROOT, { onlyActive });
    return response.data.data;
  },

  /**
   * الحصول على التصنيفات الفرعية
   * @param {string} parentId - معرف التصنيف الأب
   * @param {boolean} [onlyActive=true] - النشطة فقط
   */
  getChildren: async (parentId, onlyActive = true) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.CHILDREN(parentId), { onlyActive });
    return response.data.data;
  },

  /**
   * البحث بالاسم الإنجليزي
   * @param {string} name - اسم التصنيف
   */
  getByName: async (name) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.BY_NAME(name));
    return response.data.data;
  },

  /**
   * البحث بالاسم العربي
   * @param {string} name - اسم التصنيف بالعربي
   */
  getByArabicName: async (name) => {
    const response = await apiGet(API_ENDPOINTS.CATEGORIES.BY_ARABIC_NAME(name));
    return response.data.data;
  },

  /**
   * إنشاء تصنيف جديد
   * @param {Object} categoryData - بيانات التصنيف
   * @param {File} [icon] - أيقونة التصنيف
   */
  create: async (categoryData, icon = null) => {
    const formData = new FormData();
    
    Object.keys(categoryData).forEach(key => {
      if (categoryData[key] !== undefined && categoryData[key] !== null) {
        formData.append(key, categoryData[key]);
      }
    });
    
    if (icon) {
      formData.append('Icon', icon);
    }
    
    const response = await apiPostForm(API_ENDPOINTS.CATEGORIES.BASE, formData);
    return response.data.data;
  },

  /**
   * تحديث تصنيف
   * @param {string} id - معرف التصنيف
   * @param {Object} categoryData - بيانات التصنيف المحدثة
   * @param {File} [newIcon] - أيقونة جديدة
   */
  update: async (id, categoryData, newIcon = null) => {
    const formData = new FormData();
    
    Object.keys(categoryData).forEach(key => {
      if (categoryData[key] !== undefined && categoryData[key] !== null) {
        formData.append(key, categoryData[key]);
      }
    });
    
    if (newIcon) {
      formData.append('NewIcon', newIcon);
    }
    
    const response = await apiPutForm(API_ENDPOINTS.CATEGORIES.BY_ID(id), formData);
    return response.data.data;
  },

  /**
   * حذف تصنيف
   * @param {string} id - معرف التصنيف
   */
  delete: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.CATEGORIES.BY_ID(id));
    return response.data.data;
  },

  /**
   * رفع أيقونة التصنيف
   * @param {string} categoryId - معرف التصنيف
   * @param {File} icon - الأيقونة
   */
  uploadIcon: async (categoryId, icon) => {
    const formData = new FormData();
    formData.append('icon', icon);
    
    const response = await apiPostForm(API_ENDPOINTS.CATEGORIES.ICON(categoryId), formData);
    return response.data.data;
  },

  /**
   * حذف أيقونة التصنيف
   * @param {string} categoryId - معرف التصنيف
   */
  deleteIcon: async (categoryId) => {
    const response = await apiDelete(API_ENDPOINTS.CATEGORIES.ICON(categoryId));
    return response.data.data;
  },
};

export default categoryService;