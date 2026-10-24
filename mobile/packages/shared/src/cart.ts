import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// أنواع ردّ /api/Cart (CartResponseDto) — كل المبالغ محسوبة في الخادم والتطبيق يعرضها فقط

export interface CartVariantAttribute {
  attributeName: string;
  attributeNameAr?: string | null;
  value: string;
  valueAr?: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productNameAr?: string | null;
  productImage?: string | null;
  price: number;
  originalPrice?: number | null;
  // بالوحدة: للبيع بالوزن الكمية × weightStepKg = كغم
  quantity: number;
  subtotal: number;
  isAvailable: boolean;
  stockQuantity: number;
  weightStepKg?: number | null;
  isGrocery: boolean;
  variantId?: string | null;
  variantSku?: string | null;
  variantAttributes: CartVariantAttribute[];
  vendorId: string;
  vendorName: string;
  vendorNameAr?: string | null;
}

export interface VendorCartSummary {
  vendorId: string;
  vendorName: string;
  vendorNameAr?: string | null;
  deliveryFee: number;
  minOrderAmount: number;
  itemsCount: number;
  subtotal: number;
  meetsMinimum: boolean;
  isOpen: boolean;
  closedMessage?: string | null;
  items: CartItem[];
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  totalDeliveryFees: number;
  totalAmount: number;
  vendorsSummary: VendorCartSummary[];
  warnings: string[];
  hasGroceryItems: boolean;
}

export interface CartLine {
  productId: string;
  variantId?: string | null;
}

export const fetchCart = async (): Promise<Cart> => (await api.get(API_ENDPOINTS.CART.BASE)).data.data;

export const addToCart = async (line: CartLine & { quantity: number }): Promise<Cart> =>
  (await api.post(API_ENDPOINTS.CART.ADD, { ...line, variantId: line.variantId ?? undefined })).data.data;

export const updateCartItem = async (line: CartLine & { quantity: number }): Promise<Cart> =>
  (await api.put(API_ENDPOINTS.CART.UPDATE, { ...line, variantId: line.variantId ?? undefined })).data.data;

export const removeCartItem = async (line: CartLine): Promise<Cart> =>
  (
    await api.delete(API_ENDPOINTS.CART.REMOVE(line.productId), {
      params: line.variantId ? { variantId: line.variantId } : undefined,
    })
  ).data.data;

export const clearCart = async (): Promise<void> => {
  await api.delete(API_ENDPOINTS.CART.CLEAR);
};

// الحد الأقصى للكمية: ما يسمح به الخادم (100) أو المخزون أيهما أقل
export const MAX_LINE_QUANTITY = 100;
export const maxQuantityFor = (item: { stockQuantity: number }): number =>
  Math.max(1, Math.min(MAX_LINE_QUANTITY, item.stockQuantity));

// ===== إعادة الطلب: إضافة منتجات طلب سابق للسلة =====

export interface ReorderLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
  name: string;
}

export interface ReorderResult {
  added: number;
  failed: { name: string; message: string }[];
}

// واحدة تلو الأخرى (السلة تتغيّر بين الطلبات). ما فشل يُبلَّغ عنه ولا يوقف الباقي
export const reorderLines = async (lines: ReorderLine[]): Promise<ReorderResult> => {
  const result: ReorderResult = { added: 0, failed: [] };
  for (const line of lines) {
    try {
      await addToCart({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, line.quantity)),
      });
      result.added += 1;
    } catch (e) {
      result.failed.push({ name: line.name, message: (e as { message?: string }).message || 'تعذّرت الإضافة' });
    }
  }
  return result;
};

// هل يمكن إتمام الطلب؟ كل متجر مفتوح ويحقق الحد الأدنى وكل المنتجات متاحة
export const canCheckout = (cart: Cart | undefined | null): boolean =>
  !!cart &&
  cart.items.length > 0 &&
  cart.items.every((i) => i.isAvailable) &&
  cart.vendorsSummary.every((v) => v.isOpen && v.meetsMinimum);
