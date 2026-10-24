import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import type { SubOrder } from './myOrders';

// ===== تقييم الطلب: التجربة (التوصيل) + كل متجر + كل سائق =====

export interface OrderRatingStatus {
  hasRated: boolean;
  ratedSubOrderIds: string[];
  ratedDriverIds: string[];
}

export const fetchOrderRatingStatus = async (orderId: string): Promise<OrderRatingStatus> =>
  (await api.get(API_ENDPOINTS.ORDER_RATING.STATUS(orderId))).data.data;

export interface StoreRating {
  subOrderId: string;
  vendorRating: number;
  vendorComment?: string;
}

export interface DriverRating {
  driverId: string;
  rating: number;
}

export interface ExperienceRating {
  deliveryRating: number;
  deliveryComment?: string;
  speedRating?: number;
  packagingRating?: number;
  wouldRecommend?: boolean;
}

const cleanStores = (stores: StoreRating[]) =>
  stores.map((s) => ({ ...s, vendorComment: s.vendorComment?.trim() || undefined }));

// تقييم التجربة كاملاً مع المتاجر والسائقين (مرة واحدة لكل طلب)
export const createOrderRating = async (
  orderId: string,
  input: ExperienceRating & { storeRatings: StoreRating[]; driverRatings: DriverRating[] },
): Promise<void> => {
  await api.post(API_ENDPOINTS.ORDER_RATING.CREATE(orderId), {
    deliveryRating: input.deliveryRating,
    deliveryComment: input.deliveryComment?.trim() || undefined,
    speedRating: input.speedRating || undefined,
    packagingRating: input.packagingRating || undefined,
    wouldRecommend: input.wouldRecommend,
    subOrderRatings: cleanStores(input.storeRatings),
    driverRatings: input.driverRatings,
  });
};

// المتاجر والسائقون وحدهم (بعد أن قُيّمت التجربة سابقاً)
export const rateStoresAndDrivers = async (
  orderId: string,
  input: { storeRatings: StoreRating[]; driverRatings: DriverRating[] },
): Promise<void> => {
  await api.post(API_ENDPOINTS.ORDER_RATING.STORES(orderId), {
    subOrderRatings: cleanStores(input.storeRatings),
    driverRatings: input.driverRatings,
  });
};

type RateableSubOrder = Pick<SubOrder, 'id' | 'status' | 'driverId'>;

// ما بقي بلا تقييم في هذا الطلب: المتاجر المسلَّمة والسائقون الذين لم يُقيَّموا بعد
export const pendingRatings = (
  subOrders: RateableSubOrder[],
  status: OrderRatingStatus,
): { subOrderIds: string[]; driverIds: string[] } => {
  const delivered = subOrders.filter((s) => s.status === 'DELIVERED');
  const driverIds = [...new Set(delivered.map((s) => s.driverId).filter((d): d is string => !!d))].filter(
    (d) => !status.ratedDriverIds.includes(d),
  );
  return {
    subOrderIds: delivered.map((s) => s.id).filter((id) => !status.ratedSubOrderIds.includes(id)),
    driverIds,
  };
};

export const canRateOrder = (subOrders: RateableSubOrder[], status: OrderRatingStatus | undefined): boolean => {
  if (!status) return false;
  const pending = pendingRatings(subOrders, status);
  return !status.hasRated || pending.subOrderIds.length > 0 || pending.driverIds.length > 0;
};

export const validateOrderRating = (deliveryRating: number): string | undefined =>
  deliveryRating >= 1 && deliveryRating <= 5 ? undefined : 'قيّم تجربة التوصيل';

// الطلبات المسلَّمة التي يصح أن يُكتب عنها تقييم لمنتج. القائمة قد لا تحمل البنود، فيُترك التحقق النهائي للخادم
export const reviewableOrders = <T extends { status: string; subOrders?: { items?: { productId: string }[] }[] }>(
  orders: T[],
  productId: string,
): T[] =>
  orders.filter(
    (o) =>
      o.status === 'DELIVERED' &&
      (!o.subOrders?.some((s) => s.items) || o.subOrders.some((s) => s.items?.some((i) => i.productId === productId))),
  );
