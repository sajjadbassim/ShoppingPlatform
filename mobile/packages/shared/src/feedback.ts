import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import { appendImages, type PickedImage } from './upload';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// ===== التقييمات =====

export interface Review {
  id: string;
  productId: string;
  userId?: string;
  userFullName: string;
  userAvatarUrl?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  helpfulCount: number;
  isHelpful?: boolean;
  isCurrentUserVotedHelpful?: boolean;
  isVerifiedPurchase: boolean;
  vendorReply?: string | null;
  createdAt: string;
  pointsEarned?: number;
}

// تصويت «مراجعة مفيدة»: POST للتصويت وDELETE لإلغائه (كالويب)
export const setReviewHelpful = async (id: string, helpful: boolean): Promise<void> => {
  if (helpful) await api.post(API_ENDPOINTS.REVIEWS.HELPFUL(id));
  else await api.delete(API_ENDPOINTS.REVIEWS.HELPFUL(id));
};

// «اليوم» / «منذ 3 يوم» / «منذ شهر» / «منذ سنة» (كالويب)
export const timeAgoAr = (iso: string, now: number = Date.now()): string => {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'اليوم';
  if (days < 30) return `منذ ${days} يوم`;
  if (days < 365) return `منذ ${Math.floor(days / 30)} شهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
};

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
}

export interface ReviewsPage {
  items: Review[];
  totalCount: number;
}

export const fetchReviewSummary = async (productId: string): Promise<ReviewSummary> =>
  (await api.get(API_ENDPOINTS.REVIEWS.PRODUCT_SUMMARY(productId))).data.data;

export const fetchReviews = async (productId: string, pageNumber = 1, pageSize = 10): Promise<ReviewsPage> => {
  const res = await api.get(API_ENDPOINTS.REVIEWS.BASE, { params: { productId, pageNumber, pageSize, sortBy: 'newest' } });
  return { items: res.data.data, totalCount: res.data.pagination?.total ?? res.data.data.length };
};

export interface ReviewInput {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  body?: string;
  images?: PickedImage[];
}

export const createReview = async (input: ReviewInput): Promise<Review> => {
  const fd = new FormData();
  fd.append('ProductId', input.productId);
  fd.append('OrderId', input.orderId);
  fd.append('Rating', String(input.rating));
  if (input.title?.trim()) fd.append('Title', input.title.trim());
  if (input.body?.trim()) fd.append('Body', input.body.trim());
  appendImages(fd, 'Images', input.images);
  return (await api.post(API_ENDPOINTS.REVIEWS.BASE, fd, MULTIPART)).data.data;
};

export type ReviewErrors = Partial<Record<'rating' | 'title' | 'body', string>>;

export const validateReview = (input: { rating: number; title?: string; body?: string }): ReviewErrors => {
  const errors: ReviewErrors = {};
  if (!(input.rating >= 1 && input.rating <= 5)) errors.rating = 'اختر عدد النجوم';
  if ((input.title ?? '').length > 200) errors.title = 'العنوان لا يتجاوز 200 حرف';
  if ((input.body ?? '').length > 2000) errors.body = 'نص المراجعة لا يتجاوز 2000 حرف';
  return errors;
};

// نسبة كل فئة نجوم من المجموع (0..1) لعرض أشرطة التوزيع
export const distributionShare = (summary: ReviewSummary, stars: 1 | 2 | 3 | 4 | 5): number =>
  summary.totalReviews > 0 ? (summary.distribution[String(stars)] ?? 0) / summary.totalReviews : 0;

// ===== المرتجعات =====

export const RETURN_REASONS = [
  { value: 'defective', label: 'منتج معيب أو تالف' },
  { value: 'wrong_item', label: 'منتج خاطئ' },
  { value: 'not_as_described', label: 'لا يطابق الوصف' },
  { value: 'changed_mind', label: 'غيّرت رأيي' },
  { value: 'other', label: 'سبب آخر' },
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number]['value'];

export interface ReturnItem {
  productId: string;
  variantId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  status: string;
  statusAr: string;
  reasonAr: string;
  details?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  refundAmount?: number | null;
  pickupStatusAr?: string | null;
  isDoorRefusal?: boolean;
  refundedAt?: string | null;
  items: ReturnItem[];
}

export const fetchMyReturns = async (): Promise<ReturnRecord[]> =>
  (await api.get(API_ENDPOINTS.RETURNS.MY)).data.data ?? [];

export interface ReturnLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ReturnInput {
  orderId: string;
  reason: ReturnReason;
  details?: string;
  items: ReturnLine[];
  images?: PickedImage[];
}

// نفس ترميز الويب للقوائم داخل FormData: Items[0].ProductId ...
export const buildReturnFormData = (input: ReturnInput): FormData => {
  const fd = new FormData();
  fd.append('OrderId', input.orderId);
  fd.append('Reason', input.reason);
  if (input.details?.trim()) fd.append('Details', input.details.trim());
  input.items.forEach((item, i) => {
    fd.append(`Items[${i}].ProductId`, item.productId);
    if (item.variantId) fd.append(`Items[${i}].VariantId`, item.variantId);
    fd.append(`Items[${i}].Quantity`, String(item.quantity));
  });
  appendImages(fd, 'Images', input.images);
  return fd;
};

export const createReturn = async (input: ReturnInput): Promise<ReturnRecord> =>
  (await api.post(API_ENDPOINTS.RETURNS.BASE, buildReturnFormData(input), MULTIPART)).data.data;

export type ReturnErrors = Partial<Record<'reason' | 'items' | 'details', string>>;

export const validateReturn = (input: { reason: string; items: ReturnLine[]; details?: string }): ReturnErrors => {
  const errors: ReturnErrors = {};
  if (!input.reason) errors.reason = 'اختر سبب الإرجاع';
  if (input.items.length === 0) errors.items = 'اختر منتجاً واحداً على الأقل';
  if ((input.details ?? '').length > 1000) errors.details = 'التفاصيل لا تتجاوز 1000 حرف';
  return errors;
};

// لون حالة الإرجاع (مطابقة لـ ReturnStatus في الخادم): PENDING / APPROVED / REJECTED / COMPLETED
export const returnTone = (status: string): 'success' | 'error' | 'warning' | 'info' => {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'info';
  }
};

// مفتاح البند: المنتج + المتغير (كما يطابقه الخادم)
export const returnLineKey = (productId: string, variantId?: string | null) => `${productId}|${variantId ?? ''}`;

// ما أُرجع سابقاً من هذا الطلب (غير المرفوض وغير رفض الباب) — يُخصم مما يمكن إرجاعه، كالخادم
export const returnedQuantities = (orderId: string, returns: ReturnRecord[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of returns) {
    if (r.orderId !== orderId || r.status === 'REJECTED' || r.isDoorRefusal) continue;
    for (const i of r.items) {
      const k = returnLineKey(i.productId, i.variantId);
      out[k] = (out[k] ?? 0) + i.quantity;
    }
  }
  return out;
};

// الخادم يمنع طلباً جديداً ما دام للطلب إرجاع قيد المراجعة أو موافَق عليه ولم يُردّ مبلغه
export const hasActiveReturn = (orderId: string, returns: ReturnRecord[]): boolean =>
  returns.some((r) => r.orderId === orderId && !r.isDoorRefusal && (r.status === 'PENDING' || (r.status === 'APPROVED' && !r.refundedAt)));
