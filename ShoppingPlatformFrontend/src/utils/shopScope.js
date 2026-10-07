import { useLocation } from 'react-router-dom'

// قسما المتجر (مطابقان لـ ShopScope في الخادم): السوبرماركت منفصل عن بقية المنتجات، والسلة مشتركة
export const SCOPE = { GENERAL: 'general', GROCERY: 'grocery' }

export const SUPERMARKET_PATH = '/supermarket'

// القسم الفعلي للفئة يأتي من الخادم (يُورث من الفئة الرئيسية)
export const isGroceryCategory = (category) => category?.section === SCOPE.GROCERY

// القسم الذي يتصفحه المستخدم الآن: صفحة السوبرماركت أو نتائج مقيّدة به، وإلا العام
export const useShopScope = () => {
  const { pathname, search } = useLocation()
  return pathname.startsWith(SUPERMARKET_PATH) || new URLSearchParams(search).get('scope') === SCOPE.GROCERY
    ? SCOPE.GROCERY
    : SCOPE.GENERAL
}

// رابط بحث ضمن قسم معين
export const searchLink = (term, scope) =>
  `/products?search=${encodeURIComponent(term)}${scope === SCOPE.GROCERY ? '&scope=grocery' : ''}`
