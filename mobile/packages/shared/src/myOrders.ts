import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import type { CartVariantAttribute } from './cart';
import type { Pagination } from './catalog';

// ===== الحالات (مطابقة لـ OrderStatus / OrderStatusText في الخادم) =====

export const OrderStatus = {
  PendingConfirmation: 'PENDING_CONFIRMATION',
  Confirmed: 'CONFIRMED',
  PartiallyConfirmed: 'PARTIALLY_CONFIRMED',
  Preparing: 'PREPARING',
  Ready: 'READY',
  OutForDelivery: 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  Cancelled: 'CANCELLED',
  DeliveryFailed: 'DELIVERY_FAILED',
} as const;

const STATUS_AR: Record<string, string> = {
  PENDING_CONFIRMATION: 'بانتظار التأكيد',
  CONFIRMED: 'مؤكد',
  PARTIALLY_CONFIRMED: 'مؤكد جزئياً',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز للاستلام',
  OUT_FOR_DELIVERY: 'في الطريق',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغي',
  DELIVERY_FAILED: 'تعذّر التسليم',
};

export const orderStatusAr = (status?: string | null): string => (status && STATUS_AR[status]) || status || '—';

const ACTIVE = [
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.PartiallyConfirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.OutForDelivery,
] as string[];

export const isActiveOrder = (status: string): boolean => ACTIVE.includes(status);

export type StatusTone = 'info' | 'warning' | 'success' | 'error';

export const orderStatusTone = (status: string): StatusTone => {
  if (status === OrderStatus.Delivered) return 'success';
  if (status === OrderStatus.Cancelled || status === OrderStatus.DeliveryFailed) return 'error';
  if (status === OrderStatus.PendingConfirmation) return 'warning';
  return 'info';
};

// ===== الأنواع =====

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productNameAr?: string | null;
  productImageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  weightStepKg?: number | null;
  unavailableQuantity: number;
  refusedQuantity: number;
  variantId?: string | null;
  variantAttributes: CartVariantAttribute[];
}

export interface SubOrder {
  id: string;
  subOrderNumber: string;
  status: string;
  vendorId: string;
  vendorName: string;
  vendorNameAr?: string | null;
  vendorPhone?: string | null;
  subtotal: number;
  deliveryFee: number;
  discountShare: number;
  total: number;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  items: OrderItem[];
}

export interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  customerName?: string | null;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  subtotal: number;
  deliveryFees: number;
  totalAmount: number;
  refusedAmount: number;
  discountAmount: number;
  couponDiscountAmount: number;
  pointsDiscountAmount: number;
  couponCode?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  customerNotes?: string | null;
  cancellationReason?: string | null;
  deliverySlotStart?: string | null;
  deliverySlotEnd?: string | null;
  subOrders: SubOrder[];
  createdAt: string;
}

export interface TrackingStep {
  status: string;
  statusAr: string;
  description?: string | null;
  occurredAt?: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface OrderTracking {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
  estimatedDelivery?: string | null;
  timeline: TrackingStep[];
  subOrders: {
    subOrderId: string;
    subOrderNumber: string;
    vendorName: string;
    status: string;
    driver?: { driverName: string; driverPhone: string; vehicleType?: string | null } | null;
  }[];
}

// ===== الإلغاء (نفس شرط الخادم): قبل بدء التحضير فقط =====

const CANCELLABLE = [OrderStatus.PendingConfirmation, OrderStatus.PartiallyConfirmed, OrderStatus.Confirmed] as string[];
const NOT_STARTED = [OrderStatus.Cancelled, OrderStatus.PendingConfirmation, OrderStatus.Confirmed] as string[];

export const canCancelOrder = (order: Pick<OrderDetails, 'status' | 'subOrders'>): boolean =>
  CANCELLABLE.includes(order.status) && order.subOrders.every((s) => NOT_STARTED.includes(s.status));

// ===== الجلب =====

export interface OrdersPage {
  items: OrderDetails[];
  pagination: Pagination;
}

export const fetchOrders = async (pageNumber: number, pageSize = 20): Promise<OrdersPage> => {
  const res = await api.get(API_ENDPOINTS.ORDERS.PAGED, { params: { pageNumber, pageSize } });
  return { items: res.data.data, pagination: res.data.pagination };
};

export const fetchOrder = async (id: string): Promise<OrderDetails> =>
  (await api.get(API_ENDPOINTS.ORDERS.BY_ID(id))).data.data;

export const fetchOrderTracking = async (id: string): Promise<OrderTracking> =>
  (await api.get(API_ENDPOINTS.ORDERS.TRACKING(id))).data.data;

export const cancelOrder = async (id: string, reason: string): Promise<OrderDetails> =>
  (await api.post(API_ENDPOINTS.ORDERS.CANCEL(id), { reason: reason.trim() })).data.data;

// كل طلبات الزبون مرتبة من الأحدث (كما في صفحة الطلبات في الويب): القائمة صغيرة، والفلترة في الواجهة
export const fetchCustomerOrders = async (customerId: string): Promise<OrderDetails[]> => {
  const res = await api.get(API_ENDPOINTS.ORDERS.BY_CUSTOMER(customerId));
  const list: OrderDetails[] = res.data.data ?? [];
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// مدة وصول الطلب (للمسلَّم): «وصل طلبك خلال 17 د»
export interface OrderTiming {
  totalMinutes?: number | null;
}

export const fetchOrderTiming = async (orderId: string): Promise<OrderTiming | null> =>
  (await api.get(API_ENDPOINTS.ORDER_TIMING.BY_ID(orderId))).data.data ?? null;

export const fmtMinutes = (m?: number | null): string => {
  if (m == null) return '—';
  if (m < 1) return 'أقل من دقيقة';
  const total = Math.round(m);
  if (total < 60) return `${total} د`;
  const h = Math.floor(total / 60);
  const r = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)} يوم ${h % 24 ? `${h % 24} س` : ''}`.trim();
  return r ? `${h} س ${r} د` : `${h} س`;
};
