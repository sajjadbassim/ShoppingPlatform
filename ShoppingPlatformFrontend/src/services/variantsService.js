// src/services/variantsService.js
import { apiGet, apiPost, apiPut, apiDelete } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export const variantsService = {

  // ===========================
  // Variants
  // ===========================

  /**
   * جلب كل المتغيرات لمنتج
   * @param {string} productId
   * Response: [{ id, sku, priceAdjustment, stockQuantity, isAvailable, imageUrl, displayOrder, attributeValues: [{id, value, valueAr, attribute: {id, name, nameAr}}] }]
   */
  getVariants: async (productId) => {
    const response = await apiGet(API_ENDPOINTS.VARIANTS.BASE(productId));
    return response.data.data || response.data;
  },

  /**
   * جلب متغير بالمعرف
   * @param {string} productId
   * @param {string} variantId
   */
  getVariantById: async (productId, variantId) => {
    const response = await apiGet(API_ENDPOINTS.VARIANTS.BY_ID(productId, variantId));
    return response.data.data || response.data;
  },

  /**
   * إنشاء متغير جديد (Vendor فقط)
   * @param {string} productId
   * @param {Object} data - { sku, priceAdjustment, stockQuantity, isAvailable, imageUrl?, displayOrder?, attributeValueIds: [] }
   */
  createVariant: async (productId, data) => {
    const response = await apiPost(API_ENDPOINTS.VARIANTS.BASE(productId), data);
    return response.data.data || response.data;
  },

  /**
   * تعديل متغير (Vendor فقط)
   * @param {string} productId
   * @param {string} variantId
   * @param {Object} data - { sku?, priceAdjustment?, stockQuantity?, isAvailable?, imageUrl?, displayOrder? }
   */
  updateVariant: async (productId, variantId, data) => {
    const response = await apiPut(API_ENDPOINTS.VARIANTS.BY_ID(productId, variantId), data);
    return response.data.data || response.data;
  },

  /**
   * حذف متغير (Vendor فقط)
   * @param {string} productId
   * @param {string} variantId
   */
  deleteVariant: async (productId, variantId) => {
    const response = await apiDelete(API_ENDPOINTS.VARIANTS.BY_ID(productId, variantId));
    return response.data.data || response.data;
  },

  // ===========================
  // Attributes
  // ===========================

  /**
   * جلب صفات المنتج (اللون، الحجم، إلخ)
   * @param {string} productId
   * Response: [{ id, name, nameAr, displayOrder, values: [{id, value, valueAr}] }]
   */
  getAttributes: async (productId) => {
    const response = await apiGet(API_ENDPOINTS.VARIANTS.ATTRIBUTES(productId));
    return response.data.data || response.data;
  },

  /**
   * إنشاء صفة جديدة مع قيمها (Vendor فقط)
   * @param {string} productId
   * @param {Object} data - { name, nameAr, displayOrder?, values: [{value, valueAr}] }
   */
  createAttribute: async (productId, data) => {
    const response = await apiPost(API_ENDPOINTS.VARIANTS.ATTRIBUTES(productId), data);
    return response.data.data || response.data;
  },

  /**
   * تعديل صفة (Vendor فقط)
   * @param {string} productId
   * @param {string} attributeId
   * @param {Object} data - { name?, nameAr?, displayOrder? }
   */
  updateAttribute: async (productId, attributeId, data) => {
    const response = await apiPut(API_ENDPOINTS.VARIANTS.ATTRIBUTE_BY_ID(productId, attributeId), data);
    return response.data.data || response.data;
  },

  /**
   * حذف صفة (Vendor فقط)
   */
  deleteAttribute: async (productId, attributeId) => {
    const response = await apiDelete(API_ENDPOINTS.VARIANTS.ATTRIBUTE_BY_ID(productId, attributeId));
    return response.data.data || response.data;
  },

  /**
   * إضافة قيمة لصفة
   * @param {string} productId
   * @param {string} attributeId
   * @param {Object} data - { value, valueAr, displayOrder? }
   */
  addAttributeValue: async (productId, attributeId, data) => {
    const response = await apiPost(API_ENDPOINTS.VARIANTS.ATTRIBUTE_VALUES(productId, attributeId), data);
    return response.data.data || response.data;
  },

  /**
   * حذف قيمة صفة
   */
  deleteAttributeValue: async (productId, attributeId, valueId) => {
    const response = await apiDelete(API_ENDPOINTS.VARIANTS.ATTRIBUTE_VALUE_BY_ID(productId, attributeId, valueId));
    return response.data.data || response.data;
  },

  // ===========================
  // Helpers (UI Logic)
  // ===========================

  /**
   * بناء خريطة الاختيارات → الـ variant المناسب
   * الاستخدام: findVariant(variants, { 'اللون': 'أحمر', 'الحجم': 'L' })
   * @param {Array} variants - قائمة المتغيرات من getVariants()
   * @param {Object} selectedValues - { attributeNameAr: valueAr }
   * @returns {Object|null} الـ variant أو null
   */
  findMatchingVariant: (variants, selectedValues) => {
    if (!variants?.length || !selectedValues) return null;
    const selectedEntries = Object.entries(selectedValues);
    if (!selectedEntries.length) return null;

    return variants.find(variant => {
      // يدعم flat: attributes[] و nested: attributeValues[]
      const attrs = variant.attributes || variant.attributeValues || [];
      return selectedEntries.every(([attrNameAr, valAr]) => {
        return attrs.some(av => {
          const nameAr = av.attributeNameAr ?? av.attribute?.nameAr;
          const vAr    = av.valueAr;
          return nameAr === attrNameAr && vAr === valAr;
        });
      });
    }) || null;
  },

  /**
   * بناء قائمة الصفات مع الخيارات المتاحة من الـ variants
   * يدعم flat shape: { attributeId, attributeNameAr, valueId, valueAr }
   * ويدعم nested shape: { attribute: { id, nameAr }, id, valueAr }
   */
  buildAttributeOptions: (variants) => {
    if (!variants?.length) return [];

    const attrMap = new Map();

    variants.forEach(variant => {
      const isAvailableVariant = variant.isAvailable && variant.stockQuantity > 0;
      // flat: attributes[] — nested: attributeValues[]
      const attrs = variant.attributes || variant.attributeValues || [];

      attrs.forEach(av => {
        // استخرج المعلومات من كلا الشكلين
        const attrId   = av.attributeId   ?? av.attribute?.id;
        const attrName = av.attributeName ?? av.attribute?.name;
        const attrNameAr = av.attributeNameAr ?? av.attribute?.nameAr;
        const valId    = av.valueId ?? av.id;
        const valValue = av.value;
        const valAr    = av.valueAr;

        if (!attrId || !valId) return;

        if (!attrMap.has(attrId)) {
          attrMap.set(attrId, {
            attributeId: attrId,
            name: attrName,
            nameAr: attrNameAr,
            displayOrder: av.displayOrder || 0,
            values: new Map(),
          });
        }

        const attrEntry = attrMap.get(attrId);
        if (!attrEntry.values.has(valId)) {
          attrEntry.values.set(valId, {
            id: valId,
            value: valValue,
            valueAr: valAr,
            available: isAvailableVariant,
          });
        } else if (isAvailableVariant) {
          attrEntry.values.get(valId).available = true;
        }
      });
    });

    return Array.from(attrMap.values())
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(attr => ({
        ...attr,
        values: Array.from(attr.values.values()),
      }));
  },

  /**
   * حساب السعر النهائي مع priceAdjustment
   * @param {number} basePrice
   * @param {Object|null} variant
   */
  getFinalPrice: (basePrice, variant) => {
    if (!variant) return basePrice;
    // الـ API يرجع finalPrice جاهز — استخدمه إن وُجد
    if (variant.finalPrice != null) return variant.finalPrice;
    return basePrice + (variant.priceAdjustment || 0);
  },

  /**
   * هل المنتج عنده variants؟
   * @param {Array} variants
   */
  hasVariants: (variants) => Array.isArray(variants) && variants.length > 0,
};

export default variantsService;