/**
 * Image Helper - مساعد الصور
 * يحول المسارات النسبية إلى URLs كاملة
 */

/**
 * تحويل مسار الصورة النسبي إلى URL كامل
 * @param {string} imagePath - مسار الصورة من الـ API
 * @returns {string|null} - URL كامل أو null
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // إذا كان المسار يبدأ بـ http، أرجعه كما هو
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // استخدم VITE_API_URL من .env
  const baseUrl = import.meta.env.VITE_API_URL;
  
  // تأكد من عدم وجود slash مضاعف
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${path}`;
};

/**
 * الحصول على الصورة الرئيسية من منتج
 * @param {object} product - بيانات المنتج
 * @returns {string|null} - URL الصورة الرئيسية
 */
export const getPrimaryImage = (product) => {
  // جرّب primaryImageUrl أولاً
  if (product?.primaryImageUrl) {
    return getImageUrl(product.primaryImageUrl);
  }
  
  // ثم جرّب أول صورة من images
  if (product?.images && product.images.length > 0) {
    const primaryImage = product.images.find(img => img.isPrimary);
    return getImageUrl(primaryImage?.imageUrl || product.images[0].imageUrl);
  }
  
  // ثم جرّب image
  if (product?.image) {
    // إذا كان image هو array
    if (Array.isArray(product.image) && product.image.length > 0) {
      return getImageUrl(product.image[0].url || product.image[0].imageUrl);
    }
    // إذا كان image هو string
    return getImageUrl(product.image);
  }
  
  return null;
};

/**
 * الحصول على جميع صور المنتج
 * @param {object} product - بيانات المنتج
 * @returns {Array<string>} - مصفوفة URLs الصور
 */
export const getAllProductImages = (product) => {
  const images = [];
  
  // من images array
  if (product?.images && product.images.length > 0) {
    product.images.forEach(img => {
      const url = getImageUrl(img.imageUrl || img.url);
      if (url) images.push(url);
    });
  }
  
  // من primaryImageUrl كـ fallback
  if (images.length === 0 && product?.primaryImageUrl) {
    images.push(getImageUrl(product.primaryImageUrl));
  }
  
  // من image كـ fallback
  if (images.length === 0 && product?.image) {
    if (Array.isArray(product.image)) {
      product.image.forEach(img => {
        const url = getImageUrl(img.url || img.imageUrl || img);
        if (url) images.push(url);
      });
    } else {
      images.push(getImageUrl(product.image));
    }
  }
  
  return images;
};

/**
 * الحصول على صورة المتجر (Logo)
 * @param {object} vendor - بيانات المتجر
 * @returns {string|null} - URL اللوغو
 */
export const getVendorLogo = (vendor) => {
  return getImageUrl(vendor?.logoUrl);
};

/**
 * الحصول على صورة الغلاف للمتجر
 * @param {object} vendor - بيانات المتجر
 * @returns {string|null} - URL صورة الغلاف
 */
export const getVendorCover = (vendor) => {
  return getImageUrl(vendor?.coverImageUrl);
};