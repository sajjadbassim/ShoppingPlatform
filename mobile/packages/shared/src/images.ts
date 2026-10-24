import { API_URL } from './config';

// عروض النسخ المصغّرة التي يولّدها الخادم (ImageVariants): صورة مصغّرة، بطاقة، عرض كامل
// منقولة من ShoppingPlatformFrontend/src/utils/imageHelper.js
export const IMG_SIZE = { THUMB: 200, CARD: 600, FULL: 1200 } as const;

// مسار الصورة النسبي من الـAPI إلى رابط كامل. width: عرض النسخة المصغّرة (IMG_SIZE)،
// ودونه تُطلب الصورة الأصلية. الخادم يصغّر صور /uploads فقط
export const getImageUrl = (imagePath?: string | null, width?: number): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;

  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  const sized = width && path.startsWith('/uploads/') && !path.includes('?') ? `${path}?w=${width}` : path;
  return `${API_URL}${sized}`;
};
