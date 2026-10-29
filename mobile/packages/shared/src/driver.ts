import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// لوحة السائق (DriverAppController). الأشكال مطابقة لـ DriverAppDtos.cs وReturnTripDtos.cs

export type WorkStatus = 'available' | 'break' | 'offline' | 'delivering';

export interface DriverProfile {
  driverId: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  workStatus: WorkStatus;
  rating: number;
  totalDeliveries: number;
  deliveredToday: number;
  activeOrders: number;
  cashInHand: number;
  openReturnTrips: number;
  lastLocationAt?: string | null;
}

export interface DriverItem {
  subOrderItemId: string;
  name: string;
  variant?: string | null;
  imageUrl?: string | null;
  quantity: number;
  refusedQuantity: number;
  unitPrice: number;
}

export interface DriverStop {
  subOrderId: string;
  subOrderNumber: string;
  vendorName: string;
  vendorPhone?: string | null;
  vendorAddress?: string | null;
  itemsCount: number;
  status: string;
  pickedUpAt?: string | null;
  keptAmount: number;
  couponShare: number;
  pointsShare: number;
  items: DriverItem[];
}

export interface DriverOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  allPickedUp: boolean;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  addressDetails?: string | null;
  addressNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zoneName?: string | null;
  customerNotes?: string | null;
  deliverySlotStart?: string | null;
  deliverySlotEnd?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  amountToCollect: number;
  deliveryFee: number;
  refusalFeePayer: string;
  partialRefusalFeePayer: string;
  cashCollectedAmount?: number | null;
  assignedAt: string;
  deliveredAt?: string | null;
  stores: DriverStop[];
}

export interface ReturnTripItem {
  productName: string;
  quantity: number;
}

export interface ReturnTrip {
  id: string;
  orderId: string;
  orderNumber: string;
  subOrderNumber: string;
  vendorName: string;
  vendorPhone?: string | null;
  vendorAddress?: string | null;
  reason: string;
  reasonAr: string;
  status: string; // AT_CUSTOMER = لم يأخذ القطع من الزبون بعد
  createdAt: string;
  receivedAt?: string | null; // وقت تأكيد المتجر (في السجل فقط)
  pickedUpAt?: string | null; // وقت أخذ القطع من الزبون أو من السائق
  returnId?: string | null;
  returnNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  items: ReturnTripItem[];
}

export interface DriverCash {
  total: number;
  items: { orderId: string; orderNumber: string; amount: number; collectedAt: string }[];
}

export interface DeliverPayload {
  cashCollected: boolean;
  refusedItems: { subOrderItemId: string; quantity: number }[];
  refusalReason?: string;
  refusalNote?: string;
}

export interface FailPayload {
  reason: string;
  note?: string;
  feeCollected?: boolean;
}

const D = API_ENDPOINTS.DRIVER_APP;

export const fetchDriverProfile = async (): Promise<DriverProfile> => (await api.get(D.ME)).data.data;
export const setWorkStatus = async (workStatus: WorkStatus): Promise<DriverProfile> =>
  (await api.put(D.WORK_STATUS, { workStatus })).data.data;
export const fetchDriverOrders = async (history = false): Promise<DriverOrder[]> =>
  (await api.get(D.ORDERS, { params: { history } })).data.data ?? [];
export const fetchDriverCash = async (): Promise<DriverCash> => (await api.get(D.MY_CASH)).data.data;
// المفتوح، أو سجل ما استلمه المتجر (7 أيام). الخادم القديم يتجاهل history فيُرشَّح السجل هنا بالحالة
export const fetchDriverReturns = async (history = false): Promise<ReturnTrip[]> => {
  const rows: ReturnTrip[] = (await api.get(D.MY_RETURNS, { params: { history } })).data.data ?? [];
  return history ? rows.filter((t) => t.status === 'RECEIVED') : rows;
};

export const pickUpStop = async (subOrderId: string): Promise<void> => {
  await api.post(D.PICKED_UP(subOrderId));
};
export const deliverOrder = async (orderId: string, payload: DeliverPayload): Promise<DriverOrder> =>
  (await api.post(D.DELIVERED(orderId), payload)).data.data;
export const failOrder = async (orderId: string, payload: FailPayload): Promise<DriverOrder> =>
  (await api.post(D.FAILED(orderId), payload)).data.data;
export const collectReturn = async (returnId: string): Promise<void> => {
  await api.post(D.RETURN_PICKED_UP(returnId));
};
export const failReturnPickup = async (returnId: string, note?: string): Promise<void> => {
  await api.post(D.RETURN_PICKUP_FAILED(returnId), { note });
};
// الخادم يتجاهل التحديث الأسرع من 3 ثوانٍ ويردّ accepted=false
export const postDriverLocation = async (latitude: number, longitude: number, accuracy?: number | null): Promise<boolean> =>
  (await api.post(D.LOCATION, { latitude, longitude, accuracy: accuracy ?? undefined })).data.data?.accepted ?? true;

// ===== ثوابت وحسابات الشاشة (منقولة من DriverDashboard.jsx) =====

export const WORK_STATUSES: { value: Exclude<WorkStatus, 'delivering'>; label: string }[] = [
  { value: 'available', label: 'متاح' },
  { value: 'break', label: 'استراحة' },
  { value: 'offline', label: 'غير متصل' },
];

export const FAIL_REASONS = [
  { value: 'customer_refused', label: 'رفض الزبون الطلب' },
  { value: 'no_answer', label: 'الزبون لا يرد' },
  { value: 'wrong_address', label: 'العنوان خاطئ' },
  { value: 'other', label: 'سبب آخر' },
];

export const REFUSAL_REASONS = [
  { value: 'not_as_described', label: 'لا يطابق الوصف' },
  { value: 'wrong_item', label: 'منتج خاطئ' },
  { value: 'defective', label: 'تالف' },
  { value: 'changed_mind', label: 'غيّر رأيه' },
  { value: 'other', label: 'أخرى' },
];

// «delivering» حالة يضعها الخادم أثناء الرحلة وتُعرض كـ«متاح»
export const displayWorkStatus = (s?: WorkStatus | null): Exclude<WorkStatus, 'delivering'> =>
  s === 'delivering' || !s ? 'available' : s;

// يحصل السائق على الطلبات فقط وهو متاح أو في رحلة
export const canReceiveOrders = (s?: WorkStatus | null): boolean => s === 'available' || s === 'delivering';

// رابط الملاحة: الإحداثيات إن وُجدت، وإلا بحث بالعنوان
export const mapsUrl = (o: { latitude?: number | null; longitude?: number | null; address?: string | null }): string =>
  o.latitude && o.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address ?? '')}`;

// الطلب جاهز للتسليم حين يستلم السائق من كل المتاجر
export const pendingPickups = (o: DriverOrder): DriverStop[] => o.stores.filter((s) => !s.pickedUpAt);

// قيمة القطع المرفوضة (للعرض فقط؛ الخادم يحسب المبلغ النهائي)
export const refusedValue = (order: DriverOrder, refused: Record<string, number>): number => {
  let total = 0;
  for (const store of order.stores)
    for (const item of store.items) total += (refused[item.subOrderItemId] ?? 0) * item.unitPrice;
  return total;
};

export const refusedCount = (refused: Record<string, number>): number =>
  Object.values(refused).reduce((a, b) => a + b, 0);

// القطع المتاحة للرفض: ما لم يُرفض سابقاً
export const refusableQuantity = (item: DriverItem): number => Math.max(0, item.quantity - item.refusedQuantity);

// رفض كل القطع = رفض كامل، فيُحوَّل لـ«تعذّر التسليم»
export const refusesAll = (order: DriverOrder, refused: Record<string, number>): boolean => {
  const all = order.stores.flatMap((s) => s.items);
  return all.length > 0 && all.every((i) => (refused[i.subOrderItemId] ?? 0) >= refusableQuantity(i));
};

// مرتجعات «أخذ القطع من الزبون» تُجمع برقم المرتجع، وباقيها محطات تسليم للمتاجر
export const splitReturnTrips = (trips: ReturnTrip[]) => {
  const pickups: Record<string, ReturnTrip[]> = {};
  for (const t of trips.filter((x) => x.status === 'AT_CUSTOMER')) (pickups[t.returnId ?? t.id] ??= []).push(t);
  return { pickups: Object.values(pickups), deliveries: trips.filter((t) => t.status !== 'AT_CUSTOMER') };
};

// القوائم تُعرض من الأحدث إلى الأقدم (الخادم لا يضمن ترتيباً)
export const newestFirst = <T>(items: readonly T[], dateOf: (item: T) => string | null | undefined): T[] =>
  [...items].sort((a, b) => (Date.parse(dateOf(b) ?? '') || 0) - (Date.parse(dateOf(a) ?? '') || 0));

// باركود الطلب = رقم الطلب. يُطابَق دون حساسية لحالة الأحرف والمسافات والرموز، ويقبل معرّف الطلب أيضاً
const codeKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const findOrderByCode = <T extends { orderId: string; orderNumber: string }>(orders: readonly T[], code: string): T | undefined => {
  const key = codeKey(code);
  if (!key) return undefined;
  return orders.find((o) => codeKey(o.orderNumber) === key) ?? orders.find((o) => codeKey(o.orderId) === key);
};
