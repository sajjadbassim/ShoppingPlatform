import { api } from './api';

// أنواع ردّ GET /api/Home (HomePageDto) كما يعيدها الخادم فعلياً

export interface Banner {
  id: string;
  title: string;
  titleAr?: string | null;
  subtitle?: string | null;
  subtitleAr?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  linkType?: string | null;
  linkEntityId?: string | null;
  displayOrder: number;
  sectionId?: string | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  nameAr?: string | null;
  price: number;
  originalPrice?: number | null;
  hasDiscount: boolean;
  discountPercentage?: number | null;
  primaryImageUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  isAvailable: boolean;
  stockQuantity: number;
  vendorId: string;
  vendorName?: string | null;
  // false = المتجر مغلق الآن
  vendorIsOpen?: boolean | null;
  weightStepKg?: number | null;
}

export interface VendorSummary {
  id: string;
  name: string;
  nameAr?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  rating?: number | null;
  ratingsCount?: number | null;
  deliveryFee?: number | null;
  estimatedPrepTime?: number | null;
}

export type HomeSectionType =
  | 'featured_products'
  | 'custom_products'
  | 'flash_deals'
  | 'top_vendors'
  | 'top_categories'
  | 'banners';

export interface HomeSection {
  id: string;
  type: HomeSectionType | string;
  title: string;
  titleAr?: string | null;
  subtitle?: string | null;
  subtitleAr?: string | null;
  displayOrder: number;
  bannerImageUrl?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  page?: string | null;
  filterCategoryId?: string | null;
  filterVendorId?: string | null;
  data?: unknown[] | null;
}

export interface HomePage {
  banners: Banner[];
  sections: HomeSection[];
}

export type HomePageKind = 'general' | 'grocery';

export const fetchHome = async (page: HomePageKind = 'general'): Promise<HomePage> => {
  const res = await api.get('/api/Home', { params: { page } });
  return res.data?.data ?? res.data;
};

// الأقسام المنتجاتية تتشارك شكل بطاقة المنتج
export const PRODUCT_SECTION_TYPES: readonly string[] = ['featured_products', 'custom_products', 'flash_deals'];

// المتجر مغلق أو المنتج غير متاح للشراء الآن
export const isProductBuyable = (p: ProductSummary): boolean => p.isAvailable && p.stockQuantity > 0;

// ===== منطق عرض الرئيسية (منقول من HomePage.jsx في الويب) =====

// نسبة الخصم كما في بطاقة الويب: من السعرين إن وُجدا، وإلا النسبة المحفوظة
export const discountPercentOf = (p: Pick<ProductSummary, 'price' | 'originalPrice' | 'discountPercentage'>): number => {
  if (p.originalPrice && p.originalPrice > p.price) return Math.round((1 - p.price / p.originalPrice) * 100);
  return Math.round(p.discountPercentage ?? 0);
};

// الأقسام الظاهرة مرتبة، والأنواع التي لا تعرضها الصفحة (أفضل الفئات) تُستبعد
const RENDERED_TYPES = ['featured_products', 'custom_products', 'flash_deals', 'top_vendors', 'banners'];
export const visibleSections = (sections: HomeSection[]): HomeSection[] =>
  sections
    .filter((s) => s.isActive !== false && RENDERED_TYPES.includes(s.type))
    .sort((a, b) => a.displayOrder - b.displayOrder);

// وجهة «عرض المزيد» (getSectionLink في الويب): منتجات القسم، أو نفس فلتره (القسم/المتجر)، وأقسام السوبرماركت تبقى فيه
export type SectionTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'store'; vendorId: string }
  | { kind: 'products'; params: { categoryId?: string; scope?: string } };

export const sectionTarget = (section: HomeSection): SectionTarget => {
  // المختار يدوياً والعروض المحدودة: منتجات القسم نفسها
  if (section.type === 'custom_products' || section.type === 'flash_deals') return { kind: 'section', sectionId: section.id };
  if (section.filterVendorId && !section.filterCategoryId) return { kind: 'store', vendorId: section.filterVendorId };
  const params: { categoryId?: string; scope?: string } = {};
  if (section.filterCategoryId) params.categoryId = section.filterCategoryId;
  if (section.page === 'grocery') params.scope = 'grocery';
  return { kind: 'products', params };
};

// بلوك البانرات: 1 → عريض، 2 → متجاوران، 3+ → الأول عريض والبقية شبكة عمودين
export const splitBannerBlock = <T>(banners: T[]): { wide: T | null; grid: T[] } => {
  if (banners.length === 2) return { wide: null, grid: banners };
  const [wide = null, ...grid] = banners;
  return { wide, grid };
};

// الوقت المتبقي لعرض محدود. التاريخ بلا منطقة زمنية يُعامل كـUTC (كما في الويب)
export const msUntil = (endsAt: string | null | undefined, now = Date.now()): number => {
  if (!endsAt) return 0;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(endsAt) ? endsAt : `${endsAt}Z`;
  return Math.max(0, new Date(iso).getTime() - now);
};

const pad2 = (n: number) => String(n).padStart(2, '0');
export const formatCountdown = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const clock = `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  return days > 0 ? `${clock} + ${days}d` : clock;
};

// شريط الفئات: الرئيسية فقط (بلا السوبرماركت) والتي فيها منتجات
export const homeBarCategories = <C extends { parentId?: string | null; isGrocery?: boolean; productsCount?: number }>(
  categories: C[],
): C[] => categories.filter((c) => !c.parentId && !c.isGrocery && (c.productsCount ?? 0) > 0);

// اشترِ مجدداً: ما طلبه الزبون سابقاً ومتوفر الآن
export const fetchBuyAgain = async (scope: HomePageKind = 'general', max = 20): Promise<ProductSummary[]> => {
  const res = await api.get('/api/Products/buy-again', { params: { scope, max } });
  return res.data?.data ?? [];
};
