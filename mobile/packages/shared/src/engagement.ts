import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import type { ProductSummary } from './home';
import type { Pagination } from './catalog';

// ===== المفضلة =====

export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    nameAr?: string | null;
    price: number;
    originalPrice?: number | null;
    isAvailable: boolean;
    stockQuantity: number;
    primaryImageUrl?: string | null;
    vendorId: string;
    vendorName?: string | null;
    hasDiscount: boolean;
    discountPercentage?: number | null;
  };
}

export const fetchWishlist = async (): Promise<WishlistItem[]> =>
  (await api.get(API_ENDPOINTS.WISHLIST.BASE)).data.data ?? [];

// يعيد حالة المنتج بعد التبديل: true = أُضيف
export const toggleWishlist = async (productId: string): Promise<boolean> =>
  (await api.post(API_ENDPOINTS.WISHLIST.TOGGLE, { productId })).data.isInWishlist;

// مسح المفضلة كلها
export const clearWishlist = async (): Promise<void> => {
  await api.delete(API_ENDPOINTS.WISHLIST.CLEAR);
};

// بطاقة المنتج من عنصر المفضلة
export const wishlistToSummary = (item: WishlistItem): ProductSummary => ({
  id: item.product.id,
  name: item.product.name,
  nameAr: item.product.nameAr,
  price: item.product.price,
  originalPrice: item.product.originalPrice,
  hasDiscount: item.product.hasDiscount,
  discountPercentage: item.product.discountPercentage,
  primaryImageUrl: item.product.primaryImageUrl,
  isAvailable: item.product.isAvailable,
  stockQuantity: item.product.stockQuantity,
  vendorId: item.product.vendorId,
  vendorName: item.product.vendorName,
});

// تبديل متفائل لقائمة المفضلة في الذاكرة؛ العنصر المضاف يظهر بعد جلب القائمة من الخادم
export const withoutWishlistProduct = (items: WishlistItem[], productId: string): WishlistItem[] =>
  items.filter((i) => i.productId !== productId);

// ===== الولاء =====

export interface LoyaltyAccount {
  id: string;
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  tier: string;
  tierAr: string;
  balanceValue: number;
  nextTierPoints: number;
  nextTier?: string | null;
  tierMultiplier: number;
  expiringPoints?: number | null;
  expiringDate?: string | null;
}

export interface LoyaltyTransaction {
  id: string;
  type: string;
  typeAr: string;
  points: number;
  balanceAfter: number;
  description: string;
  descriptionAr?: string | null;
  orderNumber?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface ReferralInfo {
  code: string;
  rewardPoints: number;
  invitedCount: number;
  rewardedCount: number;
  enabled: boolean;
}

export const fetchLoyaltyAccount = async (): Promise<LoyaltyAccount> =>
  (await api.get(API_ENDPOINTS.LOYALTY.ACCOUNT)).data.data;

export const fetchReferral = async (): Promise<ReferralInfo> =>
  (await api.get(API_ENDPOINTS.LOYALTY.REFERRAL)).data.data;

export interface TransactionsPage {
  items: LoyaltyTransaction[];
  pagination: Pagination;
}

export const fetchLoyaltyTransactions = async (pageNumber: number, pageSize = 20): Promise<TransactionsPage> => {
  const res = await api.get(API_ENDPOINTS.LOYALTY.TRANSACTIONS, { params: { pageNumber, pageSize } });
  return { items: res.data.data, pagination: res.data.pagination };
};

// تقدّم الزبون نحو المستوى التالي (0..1) من إجمالي ما كسبه، أو null إن كان في أعلى مستوى
export const tierProgress = (account: Pick<LoyaltyAccount, 'totalEarned' | 'nextTierPoints' | 'nextTier'>): number | null => {
  if (!account.nextTier || account.nextTierPoints <= 0) return null;
  const target = account.totalEarned + account.nextTierPoints;
  return Math.min(1, Math.max(0, account.totalEarned / target));
};

// نص الدعوة للمشاركة
export const referralShareText = (r: Pick<ReferralInfo, 'code' | 'rewardPoints'>): string =>
  `انضم إلى تطبيق وسيط واستخدم رمز دعوتي ${r.code} لنكسب معاً ${r.rewardPoints} نقطة عند توصيل أول طلب لك.`;

// ===== «أعلمني عند التوفر» لمنتج نافد (أو خيار محدد منه): يصل إشعار مرة واحدة حين يعود للمخزون =====

const stockAlertUrl = (productId: string) => `/api/Products/${productId}/stock-alert`;
const variantParams = (variantId?: string | null) => (variantId ? { variantId } : undefined);

export const fetchStockAlert = async (productId: string, variantId?: string | null): Promise<boolean> =>
  !!(await api.get(stockAlertUrl(productId), { params: variantParams(variantId) })).data.data?.subscribed;

// يبدّل الاشتراك ويعيد الحالة الجديدة من الخادم
export const toggleStockAlert = async (productId: string, variantId: string | null | undefined, subscribed: boolean): Promise<boolean> => {
  const config = { params: variantParams(variantId) };
  const res = subscribed ? await api.delete(stockAlertUrl(productId), config) : await api.post(stockAlertUrl(productId), null, config);
  return !!res.data.data?.subscribed;
};

// إعدادات الولاء (حدود المستويات ونقاط التقييم والدعوة) لشريط التقدم وقسم «كيف تكسب نقاط»
export interface LoyaltySettings {
  silverThreshold?: number;
  goldThreshold?: number;
  reviewPoints?: number;
  referralPoints?: number;
}

export const fetchLoyaltySettings = async (): Promise<LoyaltySettings> =>
  (await api.get(API_ENDPOINTS.LOYALTY.SETTINGS)).data.data ?? {};

// نسبة التقدم من بداية المستوى الحالي إلى بداية التالي (nextTierPoints = المتبقي، فحدّه = المكتسب + المتبقي)
export const tierProgressPct = (
  account: Pick<LoyaltyAccount, 'tier' | 'totalEarned' | 'nextTierPoints' | 'nextTier'>,
  settings?: LoyaltySettings,
): number => {
  if (!account.nextTier) return 100;
  const tierStart = ({ silver: settings?.silverThreshold, gold: settings?.goldThreshold } as Record<string, number | undefined>)[account.tier?.toLowerCase()] ?? 0;
  const nextThreshold = account.totalEarned + account.nextTierPoints;
  return nextThreshold > tierStart ? Math.min(100, Math.max(0, ((account.totalEarned - tierStart) / (nextThreshold - tierStart)) * 100)) : 0;
};

// أسماء مستويات الولاء في التطبيق: رحلة نموّ لطيفة (بذرة ← برعم ← زهرة ← ثمرة) بدل المعادن المطروقة
export const LOYALTY_TIER_NAMES: Record<string, { name: string; icon: string }> = {
  bronze: { name: 'بذرة', icon: '🌱' },
  silver: { name: 'برعم', icon: '🌿' },
  gold: { name: 'زهرة', icon: '🌸' },
  platinum: { name: 'ثمرة', icon: '🍊' },
};

export const loyaltyTierName = (tier?: string | null): string => LOYALTY_TIER_NAMES[tier?.toLowerCase() ?? '']?.name ?? LOYALTY_TIER_NAMES.bronze.name;
