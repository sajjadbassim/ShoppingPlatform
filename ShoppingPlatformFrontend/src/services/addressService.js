import { apiGet, apiPost, apiPut, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Address Service - خدمة العناوين
 */
export const addressService = {
  /**
   * الحصول على جميع العناوين
   */
  getAll: async () => {
    const response = await apiGet(API_ENDPOINTS.ADDRESSES.BASE);
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * الحصول على عنوان بالمعرف
   * @param {string} id - معرف العنوان
   */
  getById: async (id) => {
    const response = await apiGet(API_ENDPOINTS.ADDRESSES.BY_ID(id));
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * الحصول على عناوين مستخدم معين
   * @param {string} userId - معرف المستخدم
   */
  getByUser: async (userId) => {
    const response = await apiGet(API_ENDPOINTS.ADDRESSES.BY_USER(userId));
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * إنشاء عنوان جديد
   * @param {Object} addressData - بيانات العنوان
   * @param {string} addressData.userId - معرف المستخدم
   * @param {string} addressData.streetAddress - عنوان الشارع
   * @param {string} addressData.city - المدينة
   * @param {string} [addressData.label] - التسمية (مثل: المنزل، العمل)
   * @param {string} [addressData.area] - المنطقة
   * @param {string} [addressData.buildingNumber] - رقم المبنى
   * @param {string} [addressData.floorNumber] - رقم الطابق
   * @param {string} [addressData.apartmentNumber] - رقم الشقة
   * @param {string} [addressData.phone] - رقم الهاتف
   * @param {string} [addressData.notes] - ملاحظات
   * @param {boolean} [addressData.isDefault] - العنوان الافتراضي
   * @param {number} [addressData.latitude] - خط العرض
   * @param {number} [addressData.longitude] - خط الطول
   */
  create: async (addressData) => {
    const response = await apiPost(API_ENDPOINTS.ADDRESSES.BASE, addressData);
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * تحديث عنوان
   * @param {string} id - معرف العنوان
   * @param {Object} addressData - بيانات العنوان المحدثة
   */
  update: async (id, addressData) => {
    const response = await apiPut(API_ENDPOINTS.ADDRESSES.BY_ID(id), addressData);
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * حذف عنوان
   * @param {string} id - معرف العنوان
   */
  delete: async (id) => {
    const response = await apiDelete(API_ENDPOINTS.ADDRESSES.BY_ID(id));
    return response.data.data; // ✅ تم التعديل
  },

  /**
   * الحصول على قائمة المدن المتاحة
   */
  getCities: () => {
    return [
      'بغداد',
      'البصرة',
      'نينوى',
      'أربيل',
      'النجف',
      'كربلاء',
      'ذي قار',
      'بابل',
      'ديالى',
      'الأنبار',
      'كركوك',
      'صلاح الدين',
      'واسط',
      'ميسان',
      'المثنى',
      'القادسية',
      'دهوك',
      'السليمانية',
    ];
  },
};

export default addressService;