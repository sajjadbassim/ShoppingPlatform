import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// اقتراح نصي أثناء الكتابة (GET /api/Products/suggestions): منتج أو متجر أو فئة
export interface SearchSuggestion {
  type: 'product' | 'store' | 'category';
  id: string;
  text: string;
  // للمنتج: اسم المتجر
  subtitle?: string | null;
}

// أقل طول للكلمة قبل طلب الاقتراحات (الخادم يعيد فارغاً لما دونه)
export const MIN_SUGGEST_LENGTH = 2;

export const fetchSearchSuggestions = async (term: string, scope?: 'grocery' | 'general', limit = 8): Promise<SearchSuggestion[]> => {
  const res = await api.get(API_ENDPOINTS.PRODUCTS.SUGGESTIONS, { params: { term, limit, scope } });
  return res.data?.data ?? [];
};

export const MAX_RECENT_SEARCHES = 5;

// آخر عمليات البحث (الأحدث أولاً، بلا تكرار، بحدّ أقصى): تُحفظ محلياً على الجهاز كما في الويب
export const addRecentSearch = (recent: readonly string[], term: string, max = MAX_RECENT_SEARCHES): string[] => {
  const t = term.trim();
  if (!t) return [...recent];
  return [t, ...recent.filter((s) => s !== t)].slice(0, max);
};
