import { apiGet, apiPost, apiPut, apiDelete, apiPatch, apiPostForm, apiPutForm } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Product Service - خدمة المنتجات
 */
export const productService = {

  // ===========================
  // القراءة
  // ===========================

  /**
   * الحصول على جميع المنتجات
   */
  getAll: async () => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.BASE);
    return response.data.data;
  },

  /**
   * الحصول على المنتجات مع التصفية والصفحات
   * @param {Object} params
   * @param {string}  [params.vendorId]
   * @param {string}  [params.categoryId]
   * @param {string}  [params.searchTerm]
   * @param {number}  [params.minPrice]
   * @param {number}  [params.maxPrice]
   * @param {boolean} [params.isAvailable]
   * @param {boolean} [params.isActive]
   * @param {number}  [params.pageNumber=1]
   * @param {number}  [params.pageSize=20]
   */
  getPaged: async (params = {}) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.PAGED, params);
    return { items: response.data.data, ...response.data.pagination };
  },

  /**
   * الحصول على منتج بالمعرف
   * @param {string} id
   */
  getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.BY_ID(id));
    return response.data.data;
  },

  /**
   * الحصول على منتجات بائع معين
   * @param {string} vendorId
   */
  getByVendor: async (vendorId) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId));
    return response.data.data;
  },

  /**
   * الحصول على منتجات تصنيف معين
   * @param {string} categoryId
   */
  getByCategory: async (categoryId) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.BY_CATEGORY(categoryId));
    return response.data.data;
  },

  /**
   * البحث البسيط في المنتجات (القديم — لا يزال يعمل)
   * @param {string} term
   */
  search: async (term) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.SEARCH, { term });
    return response.data.data;
  },

  // ===========================
  // ✅ جديد — البحث الموحد
  // ===========================

  /**
   * البحث الموحد — يبحث في الاسم + الوصف + البائع + التصنيف دفعة واحدة
   * استخدمه بدل search() في شريط البحث الرئيسي
   * @param {string} term   - نص البحث
   * @param {Object} params - { pageNumber?, pageSize? }
   */
  unifiedSearch: async (term, params = {}) => {
    const response = await apiGet(API_ENDPOINTS.PRODUCTS.UNIFIED_SEARCH, {
      term,
      ...params,
    });
    return response.data.data || response.data;
  },

  // ===========================
  // الفلترة
  // ===========================

  /**
   * تصفية المنتجات (POST — الفلتر الأساسي الموجود)
   * @param {Object} filters
   */
  filter: async (filters) => {
    const response = await apiPost(API_ENDPOINTS.PRODUCTS.FILTER, filters);
    return response.data.data;
  },

  // ===========================
  // ✅ جديد — الفلتر المتقدم
  // ===========================

  /**
   * الفلتر المتقدم — يدعم حقول أكثر من filter() العادي
   * @param {Object} filters - ProductFilterDto
   * @param {string}  [filters.vendorId]
   * @param {string}  [filters.categoryId]
   * @param {string}  [filters.searchTerm]
   * @param {number}  [filters.minPrice]
   * @param {number}  [filters.maxPrice]
   * @param {boolean} [filters.isAvailable]
   * @param {boolean} [filters.isActive]
   * @param {number}  [filters.minRating]
   * @param {boolean} [filters.hasDiscount]
   * @param {number}  [filters.pageNumber=1]
   * @param {number}  [filters.pageSize=20]
   * @param {string}  [filters.sortBy]
   * @param {string}  [filters.sortOrder]  - 'asc' | 'desc'
   */
  advancedFilter: async (filters) => {
    const response = await apiPost(API_ENDPOINTS.PRODUCTS.ADVANCED_FILTER, filters);
    return { items: response.data.data, ...response.data.pagination };
  },

  // ===========================
  // الكتابة
  // ===========================

  /**
   * إنشاء منتج جديد
   * @param {Object} productData
   * @param {File[]} [images]
   */
  create: async (productData, images = []) => {
    const formData = new FormData();

    Object.keys(productData).forEach(key => {
      if (productData[key] !== undefined && productData[key] !== null) {
        formData.append(key, productData[key]);
      }
    });

    images.forEach(image => formData.append('Images', image));

    const response = await apiPostForm(API_ENDPOINTS.PRODUCTS.BASE, formData);
    return response.data.data;
  },

  /**
   * تحديث منتج
   * @param {string} id
   * @param {Object} productData
   * @param {File[]} [newImages]
   */
  update: async (id, productData, newImages = []) => {
    const formData = new FormData();

    Object.keys(productData).forEach(key => {
      if (productData[key] !== undefined && productData[key] !== null) {
        formData.append(key, productData[key]);
      }
    });

    newImages.forEach(image => formData.append('NewImages', image));

    const response = await apiPutForm(API_ENDPOINTS.PRODUCTS.BY_ID(id), formData);
    return response.data.data;
  },

  /**
   * حذف منتج
   * @param {string} id
   */
  delete: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.PRODUCTS.BY_ID(id));
    return response.data.data;
  },

  // ===========================
  // الصور
  // ===========================

  /**
   * إضافة صورة للمنتج
   * @param {string} productId
   * @param {File}   image
   */
  addImage: async (productId, image) => {
    const formData = new FormData();
    formData.append('image', image);
    const response = await apiPostForm(API_ENDPOINTS.PRODUCTS.IMAGES(productId), formData);
    return response.data.data;
  },

  /**
   * حذف صورة
   * @param {string} imageId
   */
  deleteImage: async (imageId) => {
    const response = await apiDelete(API_ENDPOINTS.PRODUCTS.DELETE_IMAGE(imageId));
    return response.data.data;
  },

  /**
   * تعيين صورة كصورة رئيسية
   * @param {string} productId
   * @param {string} imageId
   */
  setPrimaryImage: async (productId, imageId) => {
    const response = await apiPatch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId));
    return response.data.data;
  },

  // ===========================
  // المخزون
  // ===========================

  /**
   * تحديث المخزون
   * @param {string} productId
   * @param {number} quantity
   */
  updateStock: async (productId, quantity) => {
    const response = await apiPatch(API_ENDPOINTS.PRODUCTS.UPDATE_STOCK(productId), quantity);
    return response.data.data;
  },
};

export default productService;