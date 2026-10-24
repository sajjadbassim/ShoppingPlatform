import { api } from './api';
import type { ProductSummary } from './home';

// ===== الأنواع (كما يعيدها الخادم فعلياً) =====

export interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  displayOrder: number;
}

// تفاصيل المنتج: بطاقة المنتج وزيادة
export interface ProductDetails extends ProductSummary {
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  sku?: string | null;
  hasVariants: boolean;
  hasPromotion?: boolean;
  promotionNameAr?: string | null;
  promotionExpiresAt?: string | null;
  vendorOpenStatus?: string | null;
  images: ProductImage[];
}

export interface VariantAttributeValue {
  attributeId: string;
  attributeName: string;
  attributeNameAr?: string | null;
  valueId: string;
  value: string;
  valueAr?: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku?: string | null;
  finalPrice: number;
  stockQuantity: number;
  isAvailable: boolean;
  inStock: boolean;
  imageUrl?: string | null;
  displayOrder: number;
  attributes: VariantAttributeValue[];
}

export interface Category {
  id: string;
  name: string;
  nameAr?: string | null;
  iconUrl?: string | null;
  parentId?: string | null;
  isGrocery?: boolean;
  section?: string;
  productsCount?: number;
}

export interface Pagination {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ProductsPage {
  items: ProductSummary[];
  pagination: Pagination;
}

export type ProductSort = 'created_at' | 'price' | 'rating' | 'sales' | 'name';

export interface ProductQuery {
  searchTerm?: string;
  categoryId?: string;
  vendorId?: string;
  scope?: 'general' | 'grocery';
  sortBy?: ProductSort;
  sortOrder?: 'asc' | 'desc';
  hasDiscount?: boolean;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  // true = المتوفر في المخزون فقط
  isAvailable?: boolean;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

// ===== الجلب =====

export const fetchProducts = async (query: ProductQuery): Promise<ProductsPage> => {
  const res = await api.post('/api/Products/advanced-filter', {
    scope: 'general',
    sortBy: 'created_at',
    sortOrder: 'desc',
    pageNumber: 1,
    pageSize: 20,
    ...query,
    searchTerm: query.searchTerm?.trim() || undefined,
  });
  return { items: res.data.data, pagination: res.data.pagination };
};

export const fetchProduct = async (id: string): Promise<ProductDetails> => {
  const res = await api.get(`/api/Products/${id}`);
  return res.data.data;
};

export const fetchVariants = async (productId: string): Promise<ProductVariant[]> => {
  const res = await api.get(`/api/products/${productId}/variants`);
  return res.data.data ?? [];
};

// الأقسام الرئيسية (بلا الفرعية)
export const fetchRootCategories = async (): Promise<Category[]> => {
  const res = await api.get('/api/Categories/root');
  return res.data.data ?? [];
};

// كل الأقسام المفعّلة مع عدد منتجاتها (شريط الفئات في الرئيسية يعتمد عليه؛ /root يعيد العدد صفراً)
export const fetchAllCategories = async (): Promise<Category[]> => {
  const res = await api.get('/api/Categories', { params: { onlyActive: true } });
  return res.data.data ?? res.data ?? [];
};

// الأقسام الفرعية لقسم رئيسي
export const fetchChildCategories = async (parentId: string): Promise<Category[]> => {
  const res = await api.get(`/api/Categories/children/${parentId}`);
  return res.data.data ?? [];
};

// ===== اختيار المتغيّر (مقاس، لون...) =====

export interface VariantOptionGroup {
  attributeId: string;
  name: string;
  values: { valueId: string; label: string }[];
}

// خيارات العرض: مجموعة لكل خاصية بقيمها الفريدة بترتيب ظهورها
export const buildOptionGroups = (variants: ProductVariant[]): VariantOptionGroup[] => {
  const groups = new Map<string, VariantOptionGroup>();
  for (const variant of variants) {
    for (const a of variant.attributes) {
      let group = groups.get(a.attributeId);
      if (!group) {
        group = { attributeId: a.attributeId, name: a.attributeNameAr || a.attributeName, values: [] };
        groups.set(a.attributeId, group);
      }
      if (!group.values.some((v) => v.valueId === a.valueId)) {
        group.values.push({ valueId: a.valueId, label: a.valueAr || a.value });
      }
    }
  }
  return [...groups.values()];
};

// الاختيار الحالي: attributeId ← valueId
export type VariantSelection = Record<string, string>;

const matches = (variant: ProductVariant, selection: VariantSelection): boolean =>
  Object.entries(selection).every(([attributeId, valueId]) =>
    variant.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId),
  );

// المتغيّر المطابق تماماً إن اكتمل الاختيار (قيمة لكل خاصية)
export const findVariant = (
  variants: ProductVariant[],
  groups: VariantOptionGroup[],
  selection: VariantSelection,
): ProductVariant | null => {
  if (groups.some((g) => !selection[g.attributeId])) return null;
  return variants.find((v) => matches(v, selection)) ?? null;
};

const isBuyableVariant = (v: ProductVariant) => v.isAvailable && v.inStock;

// هل توجد توليفة متاحة للشراء إن اخترنا هذه القيمة مع بقية الاختيارات الحالية؟
export const isOptionAvailable = (
  variants: ProductVariant[],
  selection: VariantSelection,
  attributeId: string,
  valueId: string,
): boolean => {
  const trial = { ...selection, [attributeId]: valueId };
  return variants.some((v) => isBuyableVariant(v) && matches(v, trial));
};

// نطاق السعر عند عدم اكتمال الاختيار: «من - إلى»، أو سعر واحد
export const priceRange = (variants: ProductVariant[]): { min: number; max: number } | null => {
  if (variants.length === 0) return null;
  const prices = variants.map((v) => v.finalPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

// ===== المتجر =====

export interface VendorDetails {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  ratingsCount?: number | null;
  deliveryFee?: number | null;
  minOrderAmount?: number | null;
  estimatedPrepTime?: number | null;
  productsCount?: number | null;
  // false = المتجر مغلق الآن
  isOpenNow?: boolean | null;
  isAcceptingOrders?: boolean | null;
  openStatus?: string | null;
  createdAt?: string | null;
  workingHours?: { day: number; closed?: boolean; open?: string; close?: string }[] | null;
}

export const fetchVendor = async (id: string): Promise<VendorDetails> => {
  const res = await api.get(`/api/Vendors/${id}`);
  return res.data.data;
};
