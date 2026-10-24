import { addToCart, canCheckout, maxQuantityFor, removeCartItem, updateCartItem, type Cart } from './cart';
import { api } from './api';
import { countPieces, formatQuantity, stepLabel } from './money';

jest.mock('./api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as unknown as Record<'post' | 'put' | 'delete', jest.Mock>;
const cartResponse = { data: { data: { cartId: 'c1', items: [] } } };

describe('cart api', () => {
  beforeEach(() => Object.values(mockApi).forEach((m) => m.mockReset().mockResolvedValue(cartResponse)));

  it('الإضافة ترسل المنتج والمتغيّر والكمية وتعيد السلة', async () => {
    const cart = await addToCart({ productId: 'p', variantId: 'v', quantity: 2 });
    expect(mockApi.post.mock.calls[0][1]).toEqual({ productId: 'p', variantId: 'v', quantity: 2 });
    expect(cart.cartId).toBe('c1');
  });

  it('منتج بلا متغيّر: variantId غير مرسل', async () => {
    await updateCartItem({ productId: 'p', variantId: null, quantity: 3 });
    expect(mockApi.put.mock.calls[0][1].variantId).toBeUndefined();
  });

  it('الحذف يمرّر variantId كمعامل استعلام فقط إن وُجد', async () => {
    await removeCartItem({ productId: 'p', variantId: 'v' });
    expect(mockApi.delete.mock.calls[0][1]).toEqual({ params: { variantId: 'v' } });

    await removeCartItem({ productId: 'p' });
    expect(mockApi.delete.mock.calls[1][1]).toEqual({ params: undefined });
  });
});

describe('الكميات', () => {
  it('الحد الأقصى: أقل من المخزون و100، وواحد على الأقل', () => {
    expect(maxQuantityFor({ stockQuantity: 5 })).toBe(5);
    expect(maxQuantityFor({ stockQuantity: 500 })).toBe(100);
    expect(maxQuantityFor({ stockQuantity: 0 })).toBe(1);
  });

  it('الوزن: 3 وحدات من 0.5 = 1.5 كغم، وأقل من كيلو بالغرام', () => {
    expect(formatQuantity(3, 0.5)).toBe('1.5 كغم');
    expect(formatQuantity(1, 0.5)).toBe('500 غ');
    expect(formatQuantity(4, 0.25)).toBe('1 كغم');
    expect(formatQuantity(3, null)).toBe('3');
    expect(stepLabel(0.1)).toBe('100 غ');
  });

  it('منتج الوزن قطعة واحدة في الشارة', () => {
    expect(countPieces([{ quantity: 10, weightStepKg: 0.1 }, { quantity: 3 }])).toBe(4);
    expect(countPieces()).toBe(0);
  });
});

describe('canCheckout', () => {
  const base = (over: Partial<Cart> = {}): Cart => ({
    cartId: 'c',
    items: [{ isAvailable: true } as Cart['items'][number]],
    totalItems: 1,
    subtotal: 0,
    totalDeliveryFees: 0,
    totalAmount: 0,
    vendorsSummary: [{ isOpen: true, meetsMinimum: true } as Cart['vendorsSummary'][number]],
    warnings: [],
    hasGroceryItems: false,
    ...over,
  });

  it('سلة سليمة', () => expect(canCheckout(base())).toBe(true));
  it('سلة فارغة أو غير موجودة', () => {
    expect(canCheckout(base({ items: [] }))).toBe(false);
    expect(canCheckout(undefined)).toBe(false);
  });
  it('متجر مغلق أو دون الحد الأدنى أو منتج غير متاح', () => {
    expect(canCheckout(base({ vendorsSummary: [{ isOpen: false, meetsMinimum: true } as Cart['vendorsSummary'][number]] }))).toBe(false);
    expect(canCheckout(base({ vendorsSummary: [{ isOpen: true, meetsMinimum: false } as Cart['vendorsSummary'][number]] }))).toBe(false);
    expect(canCheckout(base({ items: [{ isAvailable: false } as Cart['items'][number]] }))).toBe(false);
  });
});
