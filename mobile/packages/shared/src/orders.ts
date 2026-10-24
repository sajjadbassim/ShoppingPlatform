import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// ===== مواعيد توصيل السوبرماركت =====

export interface DeliverySlot {
  start: string; // UTC
  end: string;
  dayLabel: string;
  timeLabel: string;
}

export interface DeliverySlots {
  enabled: boolean;
  slots: DeliverySlot[];
}

export const fetchDeliverySlots = async (): Promise<DeliverySlots> =>
  (await api.get(API_ENDPOINTS.ORDERS.DELIVERY_SLOTS)).data.data;

// تجميع المواعيد حسب اليوم للعرض
export const groupSlotsByDay = (slots: DeliverySlot[]): { label: string; slots: DeliverySlot[] }[] =>
  slots.reduce<{ label: string; slots: DeliverySlot[] }[]>((days, slot) => {
    const day = days.find((d) => d.label === slot.dayLabel);
    if (day) day.slots.push(slot);
    else days.push({ label: slot.dayLabel, slots: [slot] });
    return days;
  }, []);

export const SUBSTITUTION_OPTIONS = [
  { value: 'SIMILAR', title: 'استبدله بمنتج مشابه', desc: 'يختار المتجر بديلاً قريباً بنفس السعر أو أقل، فلا تدفع أكثر' },
  { value: 'REMOVE', title: 'احذفه وأعد المبلغ', desc: 'يُزال المنتج من الطلب وينقص المبلغ تلقائياً' },
] as const;

export type SubstitutionPreference = (typeof SUBSTITUTION_OPTIONS)[number]['value'];

// ===== الكوبون =====

export interface CouponResult {
  isValid: boolean;
  errorMessage?: string | null;
  code: string;
  discountAmount: number;
  finalAmount: number;
}

// الخادم يرفض الكوبون غير الصالح برسالة، وإلا يعيد المبلغ المخصوم
export const validateCoupon = async (code: string, orderAmount: number): Promise<CouponResult> => {
  const res = await api.post(API_ENDPOINTS.COUPONS.VALIDATE, { code: code.trim(), orderAmount });
  const result = res.data.data as CouponResult;
  if (result.isValid === false) throw { message: result.errorMessage || 'الكوبون غير صالح' };
  return { ...result, code: code.trim() };
};

// ===== النقاط =====

export interface LoyaltyEstimate {
  pointsToEarn: number;
  maxRedeemablePoints: number;
  maxDiscountAmount: number;
  currentBalance: number;
  pointValue: number;
  earnRate: number;
}

export const fetchLoyaltyEstimate = async (orderAmount: number): Promise<LoyaltyEstimate> =>
  (await api.get(API_ENDPOINTS.LOYALTY.ESTIMATE, { params: { orderAmount } })).data.data;

export const redeemPoints = async (orderId: string, points: number): Promise<void> => {
  await api.post(API_ENDPOINTS.LOYALTY.REDEEM, { orderId, points });
};

// ===== الإجماليات (نفس حساب صفحة الدفع في الويب؛ الخادم يعيد الحساب عند إنشاء الطلب) =====

export interface CheckoutTotalsInput {
  subtotal: number;
  deliveryFees: number;
  couponDiscount: number;
  pointsToRedeem: number;
  pointValue: number;
  earnRate?: number | null;
}

export interface CheckoutTotals {
  pointsDiscount: number;
  total: number;
  pointsToEarn: number;
}

export const computeCheckoutTotals = (i: CheckoutTotalsInput): CheckoutTotals => {
  const pointsDiscount = Math.round(i.pointsToRedeem * i.pointValue);
  const total = Math.max(0, i.subtotal + i.deliveryFees - i.couponDiscount - pointsDiscount);
  // النقاط المكتسبة على ما يُدفع فعلاً بعد الخصومات وبلا التوصيل
  const pointsToEarn =
    i.earnRate != null ? Math.floor(Math.max(0, i.subtotal - i.couponDiscount - pointsDiscount) * i.earnRate) : 0;
  return { pointsDiscount, total, pointsToEarn };
};

// أساس صرف النقاط: ما يُدفع بعد الكوبون
export const redeemBase = (subtotal: number, deliveryFees: number, couponDiscount: number): number =>
  Math.max(0, subtotal + deliveryFees - couponDiscount);

// ===== إنشاء الطلب =====

export interface CreateOrderInput {
  addressId: string;
  customerNotes?: string;
  couponCode?: string;
  deliverySlotStart?: string;
  substitutionPreference?: SubstitutionPreference;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  deliveryFees: number;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: string;
  createdAt: string;
}

export const createOrder = async (input: CreateOrderInput): Promise<Order> =>
  (await api.post(API_ENDPOINTS.ORDERS.BASE, input)).data.data;

// ===== مناطق التوصيل =====
// عند تفعيلها تُحسب رسوم التوصيل من منطقة العنوان لا من رسوم المتجر. دعمها في التطبيق لاحقاً

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

export interface ZonesConfig {
  enabled: boolean;
  mode: 'OFF' | 'ALL' | 'SELECTED' | string;
  vendorIds: string[];
  zones?: DeliveryZone[];
}

// رسوم توصيل السلة لعنوان محفوظ أو لمنطقة (عنوان جديد)
export interface DeliveryQuote {
  zoneName?: string | null;
  total: number;
}

export const fetchDeliveryQuote = async (params: { addressId?: string; zoneId?: string }): Promise<DeliveryQuote> =>
  (await api.get(API_ENDPOINTS.DELIVERY_ZONES.QUOTE, { params })).data.data;

export const fetchZonesConfig = async (): Promise<ZonesConfig> =>
  (await api.get(API_ENDPOINTS.DELIVERY_ZONES.BASE)).data.data ?? { enabled: false, mode: 'OFF', vendorIds: [], zones: [] };

export const vendorUsesZones = (config: ZonesConfig | undefined | null, vendorId: string): boolean =>
  !!config?.enabled && (config.mode === 'ALL' || (config.mode === 'SELECTED' && config.vendorIds?.includes(vendorId)));
