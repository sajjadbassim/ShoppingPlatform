import { api } from './api';
import type { HomeSection } from './home';

// قائمة المتاجر (StoresPage.jsx في الويب): كل المتاجر النشطة دفعة واحدة، والبحث والترتيب على الجهاز

export interface StoreListItem {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  address?: string | null;
  minOrderAmount?: number | null;
  deliveryFee?: number | null;
  estimatedPrepTime?: number | null;
  productsCount?: number | null;
  isOpenNow?: boolean | null;
  openStatus?: string | null;
  rating?: number | null;
  ratingsCount?: number | null;
  createdAt?: string | null;
}

export const fetchStores = async (): Promise<StoreListItem[]> =>
  (await api.get('/api/Vendors', { params: { onlyActive: true } })).data.data ?? [];

// قسم واحد من الرئيسية («متاجرنا المميزة» ← عرض المزيد)
export const fetchHomeSection = async (id: string): Promise<HomeSection> =>
  (await api.get(`/api/Home/sections/${id}`)).data.data;

export type StoreSortKey = 'products' | 'rating' | 'newest' | 'delivery' | 'fastest';

const INF = Number.POSITIVE_INFINITY;
export const STORE_SORTS: { key: StoreSortKey; label: string; icon: string; compare: (a: StoreListItem, b: StoreListItem) => number }[] = [
  { key: 'products', label: 'الأكثر منتجات', icon: '📦', compare: (a, b) => (b.productsCount ?? 0) - (a.productsCount ?? 0) },
  {
    key: 'rating',
    label: 'الأعلى تقييماً',
    icon: '⭐',
    compare: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0),
  },
  { key: 'newest', label: 'الأحدث', icon: '✨', compare: (a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') || 0 },
  { key: 'delivery', label: 'أقل توصيل', icon: '🚚', compare: (a, b) => (a.deliveryFee ?? INF) - (b.deliveryFee ?? INF) || 0 },
  { key: 'fastest', label: 'الأسرع تحضيراً', icon: '⚡', compare: (a, b) => (a.estimatedPrepTime ?? INF) - (b.estimatedPrepTime ?? INF) || 0 },
];

// متاجر قسم مميز: بنفس ترتيب القسم، ومن القائمة الكاملة (فيها العنوان وعدد المنتجات)
export const storesOfSection = (all: StoreListItem[], sectionData: { id: string }[] | null | undefined): StoreListItem[] =>
  (sectionData ?? []).map((v) => all.find((s) => s.id === v.id)).filter((s): s is StoreListItem => !!s);

// البحث بالاسم أو الوصف أو العنوان، ثم الترتيب. المميزة تبقى بترتيبها (sortKey = null)
export const filterStores = (stores: StoreListItem[], query: string, sortKey: StoreSortKey | null): StoreListItem[] => {
  const q = query.trim().toLowerCase();
  const list = stores.filter((s) => !q || [s.nameAr, s.name, s.description, s.address].some((t) => t?.toLowerCase().includes(q)));
  if (!sortKey) return list;
  const sort = STORE_SORTS.find((o) => o.key === sortKey) ?? STORE_SORTS[0];
  return [...list].sort(sort.compare);
};

// المتجر الأول يُعرض كبطاقة «متجر مميز» حين لا يوجد بحث ويوجد أكثر من متجر
export const splitFeaturedStore = (stores: StoreListItem[], searching: boolean) => {
  const showFeatured = !searching && stores.length > 1;
  return showFeatured ? { featured: stores[0], rest: stores.slice(1) } : { featured: null, rest: stores };
};

export const totalProductsOf = (stores: StoreListItem[]): number => stores.reduce((sum, s) => sum + (s.productsCount ?? 0), 0);
