import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import type { PickedImage } from './upload';
import { appendImages } from './upload';
import type { WorkingDay } from './storeHours';

// لوحة البائع (VendorDashboardController وVendorMarketingController وما حولهما). الأشكال مطابقة لـ DTOs الخادم

const V = API_ENDPOINTS.VENDOR_DASHBOARD;
const M = API_ENDPOINTS.VENDOR_MARKETING;
const unwrap = <T>(res: { data?: { data?: T } | T }): T => ((res.data as { data?: T })?.data ?? res.data) as T;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// ===== الصلاحيات (موظف المتجر يرى ما يسمح به صاحبه فقط؛ الصاحب بلا قيود) =====
export type VendorPermission = 'home' | 'orders' | 'products' | 'marketing' | 'reviews' | 'reports' | 'finance' | 'social' | 'settings';

export const VENDOR_PERMISSIONS: { key: VendorPermission; label: string; desc: string }[] = [
  { key: 'home', label: 'أرقام الصفحة الرئيسية', desc: 'المبيعات والطلبات والتقييمات وآخر الطلبات' },
  { key: 'orders', label: 'الطلبات', desc: 'تأكيد الطلبات وتحضيرها ورفضها، واستلام البضاعة الراجعة' },
  { key: 'products', label: 'المنتجات', desc: 'إضافة وتعديل المنتجات والأسعار والمخزون والصور' },
  { key: 'marketing', label: 'العروض والكوبونات', desc: 'عروض وكوبونات المتجر' },
  { key: 'reviews', label: 'التقييمات', desc: 'رؤية التقييمات والرد عليها' },
  { key: 'reports', label: 'التقارير', desc: 'تقارير المبيعات' },
  { key: 'finance', label: 'الأرباح', desc: 'رصيد المتجر وحركاته' },
  { key: 'social', label: 'ربط الحسابات', desc: 'إنستغرام وفيسبوك وتيك توك والنشر' },
  { key: 'settings', label: 'إعدادات المتجر', desc: 'معلومات المتجر وأوقات العمل واستقبال الطلبات' },
];

// permissions=null أو فارغة لغير الموظف = بلا قيود (صاحب المتجر)
export const canDo = (session: { isStoreStaff?: boolean; permissions?: string[] | null } | null | undefined, key: VendorPermission): boolean => {
  if (!session?.isStoreStaff) return true;
  return !!session.permissions?.includes(key);
};

// ===== المتجر =====

export interface VendorProfile {
  id: string;
  name: string;
  nameAr: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  estimatedPrepTime?: number | null;
  isAcceptingOrders: boolean;
  workingHours?: WorkingDay[] | null;
  isOpenNow: boolean;
  openStatus?: string | null;
  rating: number;
  ratingsCount: number;
}

export const fetchVendorProfile = async (vendorId: string): Promise<VendorProfile> =>
  unwrap(await api.get(API_ENDPOINTS.VENDORS.BY_ID(vendorId)));

export interface VendorProfilePatch {
  Name?: string;
  NameAr?: string;
  Description?: string;
  Phone?: string;
  Address?: string;
  MinOrderAmount?: string;
  EstimatedPrepTime?: string;
  IsAcceptingOrders?: boolean;
  // JSON جدول الأسبوع؛ نص فارغ = مفتوح دائماً
  WorkingHours?: string;
}

export const updateVendorProfile = async (
  vendorId: string,
  patch: VendorProfilePatch,
  files: { logo?: PickedImage; cover?: PickedImage } = {},
): Promise<VendorProfile> => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) fd.append(key, String(value));
  appendImages(fd, 'NewLogo', files.logo ? [files.logo] : []);
  appendImages(fd, 'NewCover', files.cover ? [files.cover] : []);
  return unwrap(await api.put(API_ENDPOINTS.VENDORS.BY_ID(vendorId), fd, MULTIPART));
};

// ===== الرئيسية =====
export interface VendorDashboard {
  vendorName: string;
  logoUrl?: string | null;
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  averageRating?: number | null;
  totalReviews: number;
  pendingReviews: number;
  recentOrders: { subOrderId: string; subOrderNumber: string; customerName: string; subtotal: number; status: string; createdAt: string }[];
  topProducts: { productId: string; productName: string; productNameAr?: string | null; imageUrl?: string | null; totalSold: number; totalRevenue: number; price: number; stockQuantity: number }[];
}

export const fetchVendorDashboard = async (vendorId: string): Promise<VendorDashboard> => unwrap(await api.get(V.BASE(vendorId)));

export interface SalesStats {
  period: string;
  from: string;
  to: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  previousRevenue: number;
  previousOrders: number;
  salesByDay: { date: string; revenue: number; orderCount: number }[];
}

export type SalesPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export const fetchSalesStats = async (vendorId: string, period: SalesPeriod, range?: { from: string; to: string }): Promise<SalesStats> =>
  unwrap(await api.get(V.SALES(vendorId), { params: period === 'custom' && range ? { period, ...range } : { period } }));

export const fetchProductSales = async (vendorId: string): Promise<Record<string, { sold: number; revenue: number }>> => {
  const list = unwrap<{ productId: string; sold: number; revenue: number }[]>(await api.get(V.PRODUCT_SALES(vendorId))) ?? [];
  return Object.fromEntries(list.map((s) => [s.productId, s]));
};

// ===== الطلبات =====
export type SubOrderStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED' | string;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: 'بانتظار قرارك',
  CONFIRMED: 'مؤكد',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز للاستلام',
  OUT_FOR_DELIVERY: 'في الطريق',
  DELIVERED: 'مكتمل',
  DELIVERY_FAILED: 'تعذّر التسليم',
  CANCELLED: 'ملغي',
};

export const REJECT_REASONS = ['نفد المخزون', 'المنتج غير متوفر حالياً', 'لا يمكن التوصيل لهذا العنوان', 'خطأ في سعر المنتج'];

export interface VendorOrderItem {
  id: string;
  productId: string;
  productName: string;
  productNameAr?: string | null;
  productImageUrl?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  refusedQuantity: number;
  returnedQuantity: number;
  unavailableQuantity: number;
  weightStepKg?: number | null;
  replacesItemId?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface VendorOrderReturn {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  details?: string | null;
  isDoorRefusal: boolean;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

export interface VendorOrder {
  subOrderId: string;
  orderId: string;
  subOrderNumber: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  subtotal: number;
  deliveryFee: number;
  vendorDiscount: number;
  platformDiscount: number;
  customerPays: number;
  status: SubOrderStatus;
  cancellationReason?: string | null;
  confirmationDeadline?: string | null;
  minutesRemaining?: number | null;
  customerNotes?: string | null;
  deliverySlotStart?: string | null;
  deliverySlotEnd?: string | null;
  substitutionPreference?: string | null;
  items: VendorOrderItem[];
  returns: VendorOrderReturn[];
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  totalPages: number;
  totalCount: number;
}

const toPaged = <T>(raw: { data?: T[]; pagination?: { totalPages?: number; totalCount?: number } } | undefined): Paged<T> => ({
  items: Array.isArray(raw?.data) ? raw.data : [],
  totalPages: raw?.pagination?.totalPages ?? 1,
  totalCount: raw?.pagination?.totalCount ?? (Array.isArray(raw?.data) ? raw.data.length : 0),
});

export const fetchVendorOrders = async (vendorId: string, params: { status?: string; search?: string; pageNumber?: number; pageSize?: number } = {}): Promise<Paged<VendorOrder>> =>
  toPaged((await api.get(V.ORDERS(vendorId), { params })).data);

export const fetchVendorOrder = async (vendorId: string, subOrderId: string): Promise<VendorOrder> => unwrap(await api.get(V.ORDER_BY_ID(vendorId, subOrderId)));

export interface OrderCounts {
  total: number;
  byStatus: Record<string, number>;
  pendingValue: number;
}

export const fetchOrderCounts = async (vendorId: string): Promise<OrderCounts> => unwrap(await api.get(V.ORDER_COUNTS(vendorId)));

export interface UnavailableItem {
  itemId: string;
  quantity: number;
  replacementProductId?: string;
}

// الجسم اختياري: القبول الجزئي يحدد القطع غير المتوفرة (ومعها بديل إن سمح الزبون)
export const confirmOrder = async (vendorId: string, subOrderId: string, unavailableItems?: UnavailableItem[]): Promise<VendorOrder> =>
  unwrap(await api.post(V.CONFIRM_ORDER(vendorId, subOrderId), unavailableItems?.length ? { unavailableItems } : undefined));
export const rejectOrder = async (vendorId: string, subOrderId: string, reason: string): Promise<VendorOrder> =>
  unwrap(await api.post(V.REJECT_ORDER(vendorId, subOrderId), { reason }));
export const startPreparing = async (vendorId: string, subOrderId: string): Promise<VendorOrder> => unwrap(await api.post(V.START_PREPARING(vendorId, subOrderId)));
export const markReady = async (vendorId: string, subOrderId: string): Promise<VendorOrder> => unwrap(await api.post(V.MARK_READY(vendorId, subOrderId)));

// الخطوة التالية بعد القبول: بدء التحضير ثم جاهز للاستلام
export const nextOrderStep = (status: string): { step: 'preparing' | 'ready'; label: string } | null =>
  status === 'CONFIRMED' ? { step: 'preparing', label: 'بدء التحضير' } : status === 'PREPARING' ? { step: 'ready', label: 'جاهز للاستلام' } : null;

// ما يدفعه الزبون عن هذا الجزء، ومجموع القطع
export const orderTotal = (o: Pick<VendorOrder, 'subtotal' | 'deliveryFee'>): number => (o.subtotal ?? 0) + (o.deliveryFee ?? 0);

export const orderPieces = (o: Pick<VendorOrder, 'items'>): number => (o.items ?? []).reduce((s, i) => s + (i.quantity || 0), 0);

// اسم القطعة مع المتغير الذي اختاره الزبون
export const itemTitle = (it: Pick<VendorOrderItem, 'productName' | 'productNameAr' | 'variantLabel'>): string => {
  const name = it.productNameAr || it.productName;
  return it.variantLabel ? `${name} (${it.variantLabel})` : name;
};

// الثواني المتبقية لقرار القبول (0 بعد انتهاء المهلة؛ الطلب لا يُلغى تلقائياً بل يظهر متأخراً للعمليات)
export const secondsLeft = (deadline?: string | null, now = Date.now()): number | null =>
  deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000)) : null;

export const formatDecisionCountdown = (seconds: number): string => {
  if (seconds === 0) return 'انتهت المهلة';
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}س ${Math.floor((seconds % 3600) / 60)}د`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// القبول الجزئي: القطع الناقصة لكل بند، والمجموع الجديد للعرض فقط (الخادم يحسب النهائي)
export const partialSubtotal = (items: VendorOrderItem[], missing: Record<string, number>, replacementPrice: (item: VendorOrderItem) => number = () => 0): number =>
  items.reduce((s, it) => s + it.unitPrice * (it.quantity - (missing[it.id] || 0)) + replacementPrice(it), 0);

export const missingCount = (missing: Record<string, number>): number => Object.values(missing).reduce((a, b) => a + b, 0);

export const allMissing = (items: VendorOrderItem[], missing: Record<string, number>): boolean =>
  items.length > 0 && items.every((it) => (missing[it.id] || 0) >= it.quantity);

export const toUnavailableItems = (missing: Record<string, number>, replacements: Record<string, string> = {}, canReplace = false): UnavailableItem[] =>
  Object.entries(missing)
    .filter(([, q]) => q > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity, ...(canReplace && replacements[itemId] ? { replacementProductId: replacements[itemId] } : {}) }));

// ===== المرتجعات الراجعة للمتجر =====
export interface VendorReturnTrip {
  id: string;
  orderId: string;
  subOrderNumber: string;
  reason: string;
  reasonAr: string;
  status: string; // AT_CUSTOMER = السائق لم يأخذها من الزبون بعد
  driverName?: string | null;
  driverPhone?: string | null;
  items: { productName: string; quantity: number }[];
  createdAt?: string;
}

export const fetchVendorReturnTrips = async (vendorId: string): Promise<VendorReturnTrip[]> => unwrap<VendorReturnTrip[]>(await api.get(V.RETURN_TRIPS(vendorId))) ?? [];
export const markReturnTripReceived = async (vendorId: string, tripId: string): Promise<void> => {
  await api.post(V.RETURN_TRIP_RECEIVED(vendorId, tripId));
};

// ===== المنتجات =====
export interface VendorProduct {
  id: string;
  name: string;
  nameAr: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  regularPrice?: number;
  regularOriginalPrice?: number | null;
  regularStockQuantity?: number;
  regularIsAvailable?: boolean;
  sku?: string | null;
  stockQuantity: number;
  isAvailable: boolean;
  isActive: boolean;
  weightStepKg?: number | null;
  hasVariants: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  createdAt?: string;
  hasPromotion?: boolean;
  promotionNameAr?: string | null;
  primaryImageUrl?: string | null;
  images: { id: string; imageUrl: string; isPrimary: boolean; displayOrder: number }[];
}

export const LOW_STOCK = 10;

export const fetchVendorProducts = async (vendorId: string): Promise<VendorProduct[]> => {
  const data = unwrap<VendorProduct[] | { items?: VendorProduct[] }>(await api.get(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId), { params: { includeHidden: true } }));
  return Array.isArray(data) ? data : data?.items ?? [];
};

export const fetchVendorProduct = async (id: string): Promise<VendorProduct> => unwrap(await api.get(API_ENDPOINTS.PRODUCTS.BY_ID(id)));

export const productImageOf = (p: Pick<VendorProduct, 'primaryImageUrl' | 'images'>): string | null =>
  p.primaryImageUrl || p.images?.find((i) => i.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl || null;

export type VendorProductFilter = 'all' | 'visible' | 'hidden' | 'low' | 'out';
export type VendorProductSort = 'newest' | 'best' | 'name' | 'price_desc' | 'price_asc' | 'stock_asc';

export const VENDOR_PRODUCT_FILTERS: { key: VendorProductFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'visible', label: 'ظاهر' },
  { key: 'hidden', label: 'مخفي' },
  { key: 'low', label: 'مخزون منخفض' },
  { key: 'out', label: 'نفد' },
];

export const VENDOR_PRODUCT_SORTS: { key: VendorProductSort; label: string }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'best', label: 'الأكثر مبيعاً' },
  { key: 'name', label: 'الاسم' },
  { key: 'price_desc', label: 'الأعلى سعراً' },
  { key: 'price_asc', label: 'الأقل سعراً' },
  { key: 'stock_asc', label: 'المخزون الأقل' },
];

export const productCounts = (products: VendorProduct[]): Record<VendorProductFilter, number> => ({
  all: products.length,
  visible: products.filter((p) => p.isActive).length,
  hidden: products.filter((p) => !p.isActive).length,
  low: products.filter((p) => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) < LOW_STOCK).length,
  out: products.filter((p) => (p.stockQuantity ?? 0) === 0).length,
});

// الفلترة والبحث والترتيب في الجهاز (الخادم يعيد كل المنتجات كما في الويب)
export const filterVendorProducts = (
  products: VendorProduct[],
  opts: { filter: VendorProductFilter; search: string; sort: VendorProductSort; sold?: Record<string, { sold: number }> },
): VendorProduct[] => {
  const q = opts.search.trim().toLowerCase();
  const soldOf = (p: VendorProduct) => opts.sold?.[p.id]?.sold ?? 0;
  const matches = products.filter((p) => {
    const qty = p.stockQuantity ?? 0;
    const okFilter =
      opts.filter === 'visible' ? p.isActive : opts.filter === 'hidden' ? !p.isActive : opts.filter === 'low' ? qty > 0 && qty < LOW_STOCK : opts.filter === 'out' ? qty === 0 : true;
    const okSearch = !q || (p.nameAr || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    return okFilter && okSearch;
  });
  const byName = (a: VendorProduct, b: VendorProduct) => (a.nameAr || a.name || '').localeCompare(b.nameAr || b.name || '', 'ar');
  const sorters: Record<VendorProductSort, (a: VendorProduct, b: VendorProduct) => number> = {
    newest: (a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') || 0,
    best: (a, b) => soldOf(b) - soldOf(a),
    name: byName,
    price_desc: (a, b) => (b.price || 0) - (a.price || 0),
    price_asc: (a, b) => (a.price || 0) - (b.price || 0),
    stock_asc: (a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0),
  };
  return [...matches].sort(sorters[opts.sort]);
};

export const discountPercent = (price: number, original?: number | null): number =>
  original && original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0;

// الإخفاء والإظهار وغيرها: تحديث جزئي بحقول Form كما في الويب
export const updateProductFields = async (id: string, fields: Record<string, string | boolean>): Promise<VendorProduct> => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  return unwrap(await api.put(API_ENDPOINTS.PRODUCTS.BY_ID(id), fd, MULTIPART));
};

export const setProductActive = (id: string, isActive: boolean) => updateProductFields(id, { IsActive: isActive });

export const updateProductStock = async (id: string, quantity: number): Promise<void> => {
  await api.patch(API_ENDPOINTS.PRODUCTS.UPDATE_STOCK(id), quantity); // الجسم رقم خام كما في الويب
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.PRODUCTS.BY_ID(id));
};

export const duplicateProduct = async (id: string): Promise<VendorProduct> => unwrap(await api.post(API_ENDPOINTS.PRODUCTS.DUPLICATE(id)));

// البيع بالوزن: الخادم يخزّن السعر والمخزون للوحدة، والتاجر يكتب سعر الكيلو والمخزون بالكيلو
export const WEIGHT_STEPS = [
  { value: '0.1', label: '100 غرام' },
  { value: '0.25', label: 'ربع كيلو' },
  { value: '0.5', label: 'نصف كيلو' },
  { value: '1', label: 'كيلو' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ProductForm {
  Name: string;
  NameAr: string;
  Description: string;
  Price: string;
  OriginalPrice: string;
  Sku: string;
  StockQuantity: string;
  CategoryId: string;
  IsActive: boolean;
  IsAvailable: boolean;
  WeightStep: string; // فارغ = بالقطعة
}

export const EMPTY_PRODUCT_FORM: ProductForm = {
  Name: '', NameAr: '', Description: '', Price: '', OriginalPrice: '', Sku: '', StockQuantity: '1', CategoryId: '', IsActive: true, IsAvailable: true, WeightStep: '',
};

// المخزّن لا المعروض للزبون: السعر قبل العرض، وبالكيلو إن كان بالوزن
export const productToForm = (p: VendorProduct): ProductForm => {
  const step = Number(p.weightStepKg) || 0;
  const perKg = (v?: number | null) => (v == null ? '' : String(step ? round2(v / step) : v));
  return {
    WeightStep: step ? String(step) : '',
    Name: p.name || '',
    NameAr: p.nameAr || '',
    Description: p.description && p.description !== '-' ? p.description : '',
    Price: perKg(p.regularPrice ?? p.price),
    OriginalPrice: perKg(p.regularOriginalPrice !== undefined ? p.regularOriginalPrice : p.originalPrice),
    Sku: p.sku || '',
    StockQuantity: String(round2((p.regularStockQuantity ?? p.stockQuantity ?? 0) * (step || 1))),
    CategoryId: p.categoryId || '',
    IsActive: p.isActive ?? true,
    IsAvailable: p.regularIsAvailable ?? p.isAvailable ?? true,
  };
};

export const MAX_PRODUCT_IMAGES = 5;

export type ProductFormErrors = Partial<Record<'NameAr' | 'Price' | 'OriginalPrice' | 'images', string>>;

export const validateProductForm = (form: ProductForm, imageCount: number, editing: boolean): ProductFormErrors => {
  const e: ProductFormErrors = {};
  const price = Number(form.Price) || 0;
  const original = Number(form.OriginalPrice) || 0;
  if (!form.NameAr.trim()) e.NameAr = 'اكتب اسم المنتج';
  if (!(price > 0)) e.Price = form.Price ? 'سعر البيع يجب أن يكون أكبر من صفر' : 'اكتب سعر البيع';
  if (form.OriginalPrice && original <= price) e.OriginalPrice = 'يجب أن يكون أعلى من سعر البيع ليظهر كخصم';
  if (!editing && imageCount === 0) e.images = 'أضف صورة واحدة على الأقل';
  return e;
};

export const buildProductFormData = (form: ProductForm, opts: { editing: boolean; vendorId: string; images: PickedImage[] }): FormData => {
  const price = Number(form.Price) || 0;
  const original = Number(form.OriginalPrice) || 0;
  const step = Number(form.WeightStep) || 0;
  const toUnit = (perKg: number) => (step ? round2(perKg * step) : perKg);
  const stockUnits = step ? Math.floor((Number(form.StockQuantity) || 0) / step + 1e-9) : Math.max(0, Number(form.StockQuantity) || 0);
  const fd = new FormData();
  if (!opts.editing) fd.append('VendorId', opts.vendorId);
  fd.append('Name', form.Name.trim() || form.NameAr.trim());
  fd.append('NameAr', form.NameAr.trim());
  fd.append('Description', form.Description.trim() || '-');
  fd.append('Price', String(toUnit(price)));
  if (form.OriginalPrice) fd.append('OriginalPrice', String(toUnit(original)));
  else if (opts.editing) fd.append('ClearOriginalPrice', 'true');
  if (form.Sku.trim()) fd.append('Sku', form.Sku.trim());
  fd.append('StockQuantity', String(Math.max(0, stockUnits)));
  if (step) fd.append('WeightStepKg', String(step));
  else if (opts.editing) fd.append('ClearWeightStep', 'true');
  if (form.CategoryId) fd.append('CategoryId', form.CategoryId);
  else if (opts.editing) fd.append('ClearCategory', 'true');
  fd.append('IsActive', String(form.IsActive));
  fd.append('IsAvailable', String(form.IsAvailable));
  // الإنشاء يستقبل «Images» والتعديل «NewImages»
  appendImages(fd, opts.editing ? 'NewImages' : 'Images', opts.images);
  return fd;
};

export const saveProduct = async (id: string | null, fd: FormData): Promise<VendorProduct> =>
  unwrap(id ? await api.put(API_ENDPOINTS.PRODUCTS.BY_ID(id), fd, MULTIPART) : await api.post(API_ENDPOINTS.PRODUCTS.BASE, fd, MULTIPART));

export const deleteProductImage = async (imageId: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.PRODUCTS.DELETE_IMAGE(imageId));
};
export const setPrimaryProductImage = async (productId: string, imageId: string): Promise<void> => {
  await api.patch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId));
};

// تسعير جماعي: نسبة موجبة للرفع وسالبة للخفض، أو خصم يظهر السعر الأصلي مشطوباً
export type BulkPriceMode = 'percent' | 'discount' | 'clearDiscount';

export const bulkPriceFields = (p: Pick<VendorProduct, 'price' | 'originalPrice' | 'regularPrice' | 'regularOriginalPrice'>, mode: BulkPriceMode, percent: number): Record<string, string> | null => {
  const base = p.regularPrice ?? p.price;
  const original = p.regularOriginalPrice !== undefined ? p.regularOriginalPrice : p.originalPrice;
  if (mode === 'percent') {
    const next = Math.round(base * (1 + percent / 100));
    return next > 0 ? { Price: String(next) } : null;
  }
  if (mode === 'discount') {
    const next = Math.round(base * (1 - percent / 100));
    return next > 0 && next < base ? { Price: String(next), OriginalPrice: String(base) } : null;
  }
  // إلغاء الخصم: يعود السعر إلى الأصلي المشطوب
  return original && original > base ? { Price: String(original), ClearOriginalPrice: 'true' } : null;
};

// ===== المتغيرات =====
export interface AttributeValue { id: string; value: string; valueAr?: string | null; displayOrder: number }
export interface ProductAttribute { id: string; name: string; nameAr?: string | null; displayOrder: number; values: AttributeValue[] }
export interface VendorVariant {
  id: string;
  sku?: string | null;
  basePrice: number;
  priceAdjustment: number;
  finalPrice: number;
  stockQuantity: number;
  isAvailable: boolean;
  imageUrl?: string | null;
  attributes: { attributeId: string; attributeName: string; attributeNameAr?: string | null; valueId: string; value: string; valueAr?: string | null }[];
}

const VR = API_ENDPOINTS.VARIANTS;
export const fetchAttributes = async (productId: string): Promise<ProductAttribute[]> => unwrap<ProductAttribute[]>(await api.get(VR.ATTRIBUTES(productId))) ?? [];
export const fetchProductVariants = async (productId: string): Promise<VendorVariant[]> => unwrap<VendorVariant[]>(await api.get(VR.BASE(productId))) ?? [];
export const createAttribute = async (productId: string, body: { name: string; nameAr: string; values: { value: string; valueAr: string }[] }) => unwrap(await api.post(VR.ATTRIBUTES(productId), body));
export const deleteAttribute = async (productId: string, attributeId: string) => {
  await api.delete(VR.ATTRIBUTE_BY_ID(productId, attributeId));
};
export const addAttributeValue = async (productId: string, attributeId: string, body: { value: string; valueAr: string }) => unwrap(await api.post(VR.ATTRIBUTE_VALUES(productId, attributeId), body));
export const deleteAttributeValue = async (productId: string, attributeId: string, valueId: string) => {
  await api.delete(VR.ATTRIBUTE_VALUE_BY_ID(productId, attributeId, valueId));
};
export const createVariant = async (productId: string, body: { sku?: string; priceAdjustment: number; stockQuantity: number; isAvailable: boolean; attributeValueIds: string[] }) => unwrap(await api.post(VR.BASE(productId), body));
export const updateVariant = async (productId: string, variantId: string, body: { sku?: string; priceAdjustment?: number; stockQuantity?: number; isAvailable?: boolean }) => unwrap(await api.put(VR.BY_ID(productId, variantId), body));
export const deleteVariant = async (productId: string, variantId: string) => {
  await api.delete(VR.BY_ID(productId, variantId));
};

// كل التوليفات الممكنة من قيم الصفات (اللون × المقاس...): قائمة معرّفات قيم لكل متغير
export const variantCombinations = (attributes: ProductAttribute[]): string[][] =>
  attributes
    .filter((a) => a.values.length > 0)
    .reduce<string[][]>((acc, attr) => acc.flatMap((combo) => attr.values.map((v) => [...combo, v.id])), [[]]);

// مفتاح ثابت للتوليفة (لتجاهل ما أُنشئ مسبقاً)
export const combinationKey = (ids: string[]): string => [...ids].sort().join('|');

export const variantLabel = (v: Pick<VendorVariant, 'attributes'>): string => v.attributes.map((a) => a.valueAr || a.value).join(' · ');

// ===== التقييمات =====
export interface VendorReview {
  id: string;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  customerName?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  isVerifiedPurchase: boolean;
  images: string[];
  vendorReply?: string | null;
  vendorReplyAt?: string | null;
  createdAt: string;
}

export const fetchVendorReviews = async (vendorId: string, params: { unanswered?: boolean; rating?: number; pageNumber?: number; pageSize?: number } = {}): Promise<Paged<VendorReview>> =>
  toPaged((await api.get(V.REVIEWS(vendorId), { params })).data);

export interface VendorReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
  totalVerified?: number;
  totalWithImages?: number;
}

export const fetchVendorReviewSummary = async (vendorId: string): Promise<VendorReviewSummary> => unwrap(await api.get(API_ENDPOINTS.REVIEWS.VENDOR_SUMMARY(vendorId)));

export const replyToReview = async (reviewId: string, reply: string): Promise<void> => {
  await api.put(API_ENDPOINTS.REVIEWS.REPLY(reviewId), { reply });
};
export const deleteReviewReply = async (reviewId: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.REVIEWS.REPLY(reviewId));
};

// ===== العروض والكوبونات =====
export type DiscountType = 'percentage' | 'fixed';

export interface Promotion {
  id: string;
  name: string;
  targetType: 'vendor' | 'product' | string;
  targetId?: string | null;
  targetName?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  isActive: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  isExpired: boolean;
  isScheduled: boolean;
  isRunning: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usageCount: number;
  userUsageLimit: number;
  vendorId?: string | null;
  isActive: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  isExpired: boolean;
  isUsageLimitReached: boolean;
}

export const fetchPromotions = async (vendorId: string): Promise<Promotion[]> => unwrap<Promotion[]>(await api.get(M.PROMOTIONS(vendorId))) ?? [];
export const fetchCoupons = async (vendorId: string): Promise<Coupon[]> => unwrap<Coupon[]>(await api.get(M.COUPONS(vendorId))) ?? [];

export interface PromotionBody {
  name: string;
  targetType: 'vendor' | 'product';
  productId: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

export interface CouponBody {
  code?: string;
  discountType?: DiscountType;
  description: string | null;
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  usageLimit: number | null;
  userUsageLimit: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

export const savePromotion = async (vendorId: string, id: string | null, body: PromotionBody) =>
  id ? api.put(`${M.PROMOTIONS(vendorId)}/${id}`, body) : api.post(M.PROMOTIONS(vendorId), body);
export const saveCoupon = async (vendorId: string, id: string | null, body: CouponBody) =>
  id ? api.put(`${M.COUPONS(vendorId)}/${id}`, body) : api.post(M.COUPONS(vendorId), body);
export const deletePromotion = async (vendorId: string, id: string) => api.delete(`${M.PROMOTIONS(vendorId)}/${id}`);
export const deleteCoupon = async (vendorId: string, id: string) => api.delete(`${M.COUPONS(vendorId)}/${id}`);

export const discountText = (x: { discountType: DiscountType; discountValue: number; maxDiscountAmount?: number | null }): string =>
  x.discountType === 'percentage'
    ? `${x.discountValue}%${x.maxDiscountAmount ? ` (حتى ${Math.round(x.maxDiscountAmount).toLocaleString('en-US')} د.ع)` : ''}`
    : `${Math.round(x.discountValue).toLocaleString('en-US')} د.ع`;

// حالة العرض أو الكوبون للعرض
export const marketingStatus = (x: { isActive: boolean; isExpired: boolean; isScheduled?: boolean; isUsageLimitReached?: boolean }): { label: string; tone: 'ok' | 'warn' | 'muted' } =>
  !x.isActive ? { label: 'متوقف', tone: 'muted' }
  : x.isExpired ? { label: 'منتهٍ', tone: 'muted' }
  : x.isUsageLimitReached ? { label: 'اكتمل استخدامه', tone: 'muted' }
  : x.isScheduled ? { label: 'مجدول', tone: 'warn' }
  : { label: 'فعّال', tone: 'ok' };

// تاريخ yyyy-mm-dd ← ISO (بداية اليوم أو نهايته)
export const dayToIso = (day: string, endOfDay = false): string | null => (day ? new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null);
export const isoToDay = (iso?: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

// ===== الأرباح =====
export interface EarningsSummary {
  vendorName: string;
  sales: number;
  commission: number;
  deductions: number;
  payouts: number;
  balance: number;
  lastPayoutAt?: string | null;
  commissionRule?: { type: string; value: number } | null;
}

export interface LedgerEntry {
  id: string;
  type: string;
  typeAr: string;
  amount: number;
  runningBalance: number;
  description?: string | null;
  reference?: string | null;
  orderId?: string | null;
  subOrderId?: string | null;
  orderNumber?: string | null;
  createdAt: string;
}

export const fetchMyEarnings = async (): Promise<{ summary: EarningsSummary; entries: LedgerEntry[] }> => unwrap(await api.get(API_ENDPOINTS.FINANCE.ME));

export const commissionLabel = (c?: { type: string; value: number } | null): string =>
  !c ? '—' : c.type === 'FIXED' ? `${Number(c.value).toLocaleString('en-US')} د.ع / طلب` : `${Number(c.value)}%`;

// ===== الموظفون =====
export interface StaffMember {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  fullAccess: boolean;
  permissions: string[];
  lastLogin?: string | null;
}

export const fetchStaff = async (): Promise<StaffMember[]> => {
  const res = await api.get(API_ENDPOINTS.STAFF.VENDOR);
  return res.data?.data ?? [];
};

export interface StaffBody {
  fullName: string;
  phone?: string;
  email?: string | null;
  password?: string | null;
  permissions: string[];
  fullAccess: boolean;
}

export const saveStaff = async (id: string | null, body: StaffBody) =>
  id
    ? api.put(`${API_ENDPOINTS.STAFF.VENDOR}/${id}`, { fullName: body.fullName, password: body.password || null, permissions: body.fullAccess ? null : body.permissions, fullAccess: null })
    : api.post(API_ENDPOINTS.STAFF.VENDOR, { ...body, email: body.email || null });
export const toggleStaff = async (id: string) => api.put(`${API_ENDPOINTS.STAFF.VENDOR}/${id}/toggle`);
export const removeStaff = async (id: string) => api.delete(`${API_ENDPOINTS.STAFF.VENDOR}/${id}`);

export const validateStaff = (form: { fullName: string; phone: string; password: string; permissions: string[]; fullAccess: boolean }, editing: boolean): boolean =>
  !!form.fullName.trim() && (editing || (!!form.phone.trim() && form.password.length >= 6)) && (!form.password || form.password.length >= 6) && (form.fullAccess || form.permissions.length > 0);

// ===== سجل النشاط =====
export interface ActivityLog {
  id: string;
  kind: 'AUTH' | 'ACTION' | string;
  action: string;
  summary: string;
  actorName?: string | null;
  actorRole?: string | null;
  at: string;
  ip?: string | null;
  device?: string | null;
  details?: { type: string; label?: string | null; state: string; changes?: { p: string; o?: string | null; n?: string | null }[] }[] | null;
}

export interface ActivityPage {
  items: ActivityLog[];
  hasMore: boolean;
}

export const fetchActivity = async (params: { page: number; pageSize?: number; kind?: 'AUTH' | 'ACTION'; failedLoginsOnly?: boolean; from?: string; mine?: boolean; search?: string }): Promise<ActivityPage> => {
  const res = await api.get(API_ENDPOINTS.ACTIVITY.LIST, { params: { pageSize: 30, ...params } });
  const raw = res.data;
  const items: ActivityLog[] = Array.isArray(raw?.data) ? raw.data : raw?.data?.items ?? [];
  const totalPages = raw?.pagination?.totalPages ?? raw?.data?.totalPages;
  return { items, hasMore: totalPages != null ? params.page < totalPages : items.length >= (params.pageSize ?? 30) };
};

// بداية اليوم بتوقيت بغداد (UTC+3) قبل days أيام
export const activityFrom = (days: number | null, now = Date.now()): string | undefined => {
  if (days == null) return undefined;
  const baghdad = new Date(now + 3 * 3600_000);
  baghdad.setUTCHours(0, 0, 0, 0);
  return new Date(baghdad.getTime() - 3 * 3600_000 - days * 86400_000).toISOString();
};

// ===== تفضيلات إشعارات المتجر =====
export interface VendorNotifyPrefs {
  notifyNewOrders?: boolean;
  notifyOrderConfirmations?: boolean;
  notifyLowStock?: boolean;
  notifyReviews?: boolean;
}

// ===== أوقات العمل =====
export const toWorkingHoursJson = (schedule: Required<WorkingDay>[]): string =>
  JSON.stringify(schedule.map((d) => (d.closed ? { day: d.day, closed: true } : { day: d.day, closed: false, open: d.open, close: d.close })));

export const fetchVendorPrefs = async (): Promise<VendorNotifyPrefs> => unwrap(await api.get(API_ENDPOINTS.USERS.MY_PREFERENCES)) ?? {};
export const updateVendorPrefs = async (patch: VendorNotifyPrefs): Promise<VendorNotifyPrefs> => unwrap(await api.put(API_ENDPOINTS.USERS.MY_PREFERENCES, patch));

// ===== ربط حسابات التواصل (الحالة والربط والمزامنة والفصل؛ النشر من الويب حالياً) =====
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';

const SOCIAL_ENDPOINTS: Record<SocialPlatform, { status: string; connectUrl: string; sync?: string; connection: string }> = {
  instagram: { status: API_ENDPOINTS.INSTAGRAM.STATUS, connectUrl: API_ENDPOINTS.INSTAGRAM.CONNECT_URL, sync: API_ENDPOINTS.INSTAGRAM.SYNC, connection: API_ENDPOINTS.INSTAGRAM.CONNECTION },
  facebook: { status: API_ENDPOINTS.FACEBOOK.STATUS, connectUrl: API_ENDPOINTS.FACEBOOK.CONNECT_URL, sync: API_ENDPOINTS.FACEBOOK.SYNC, connection: API_ENDPOINTS.FACEBOOK.CONNECTION },
  tiktok: { status: API_ENDPOINTS.TIKTOK.STATUS, connectUrl: API_ENDPOINTS.TIKTOK.CONNECT_URL, sync: API_ENDPOINTS.TIKTOK.SYNC, connection: API_ENDPOINTS.TIKTOK.CONNECTION },
};

export const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: 'instagram', label: 'إنستغرام' },
  { key: 'facebook', label: 'فيسبوك' },
  { key: 'tiktok', label: 'تيك توك' },
];

export interface SocialStatus {
  connected: boolean;
  needsReconnect?: boolean;
  account?: { username?: string | null; name?: string | null; displayName?: string | null; pageName?: string | null } | null;
  lastSyncAt?: string | null;
}

export const fetchSocialStatus = async (p: SocialPlatform): Promise<SocialStatus> => unwrap(await api.get(SOCIAL_ENDPOINTS[p].status));
export const fetchSocialConnectUrl = async (p: SocialPlatform): Promise<string> => {
  const data = unwrap<string | { url?: string }>(await api.get(SOCIAL_ENDPOINTS[p].connectUrl));
  return typeof data === 'string' ? data : data?.url ?? '';
};
export const syncSocial = async (p: SocialPlatform): Promise<void> => {
  const url = SOCIAL_ENDPOINTS[p].sync;
  if (url) await api.post(url);
};
export const disconnectSocial = async (p: SocialPlatform): Promise<void> => {
  await api.delete(SOCIAL_ENDPOINTS[p].connection);
};
export const socialAccountName = (s?: SocialStatus | null): string => s?.account?.username || s?.account?.displayName || s?.account?.pageName || s?.account?.name || '';
