import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import { normalizeIraqiPhone } from './phone';

export interface Address {
  id: string;
  label?: string | null;
  streetAddress: string;
  area?: string | null;
  city: string;
  buildingNumber?: string | null;
  phone?: string | null;
  notes?: string | null;
  isDefault: boolean;
  latitude?: number | null;
  longitude?: number | null;
  zoneId?: string | null;
  zoneName?: string | null;
}

export interface AddressInput {
  label: string;
  streetAddress: string;
  area: string;
  city: string;
  buildingNumber?: string;
  phone: string;
  notes?: string;
  isDefault?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  zoneId?: string | null;
}

export const hasPin = (a?: { latitude?: number | null; longitude?: number | null } | null): boolean =>
  a?.latitude != null && a?.longitude != null;

// نص العنوان في سطر واحد
export const formatAddress = (a: Pick<Address, 'city' | 'area' | 'streetAddress' | 'buildingNumber'>): string =>
  [a.city, a.area, a.streetAddress, a.buildingNumber && `بناية ${a.buildingNumber}`].filter(Boolean).join('، ');

export const fetchAddresses = async (userId: string): Promise<Address[]> =>
  (await api.get(API_ENDPOINTS.ADDRESSES.BY_USER(userId))).data.data ?? [];

export const createAddress = async (userId: string, input: AddressInput): Promise<Address> =>
  (
    await api.post(API_ENDPOINTS.ADDRESSES.BASE, {
      ...input,
      userId,
      phone: normalizeIraqiPhone(input.phone) ?? input.phone.trim(),
      buildingNumber: input.buildingNumber ?? '',
      floorNumber: '',
      apartmentNumber: '',
      notes: input.notes ?? '',
      zoneId: input.zoneId || undefined,
    })
  ).data.data;

// التعديل يشبه الإنشاء؛ بلا منطقة نرسل Guid فارغاً لإزالتها (كما في الويب)
export const updateAddress = async (id: string, userId: string, input: AddressInput): Promise<Address> =>
  (
    await api.put(API_ENDPOINTS.ADDRESSES.BY_ID(id), {
      ...input,
      userId,
      phone: normalizeIraqiPhone(input.phone) ?? input.phone.trim(),
      buildingNumber: input.buildingNumber ?? '',
      floorNumber: '',
      apartmentNumber: '',
      notes: input.notes ?? '',
      zoneId: input.zoneId || '00000000-0000-0000-0000-000000000000',
    })
  ).data.data;

export const deleteAddress = async (id: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.ADDRESSES.BY_ID(id));
};

export type AddressErrors = Partial<Record<'label' | 'phone' | 'city' | 'area' | 'streetAddress' | 'pin', string>>;

// نفس شروط صفحة الدفع في الويب: الدبوس إلزامي ليصل السائق مباشرة
export const validateAddress = (
  input: Pick<AddressInput, 'label' | 'phone' | 'city' | 'area' | 'streetAddress'>,
  pin: { latitude: number; longitude: number } | null,
): AddressErrors => {
  const errors: AddressErrors = {};
  if (!input.label.trim()) errors.label = 'الاسم مطلوب';
  if (!input.phone.trim()) errors.phone = 'رقم الهاتف مطلوب';
  else if (!normalizeIraqiPhone(input.phone)) errors.phone = 'رقم الهاتف غير صحيح (مثال: 07701234567)';
  if (!input.city.trim()) errors.city = 'المدينة مطلوبة';
  if (!input.area.trim()) errors.area = 'المنطقة مطلوبة';
  if (!input.streetAddress.trim()) errors.streetAddress = 'الشارع مطلوب';
  if (!pin) errors.pin = 'حدّد موقع منزلك ليصل السائق مباشرة';
  return errors;
};
