import { canDo, useSessionStore, type AuthUser, type VendorPermission } from '@wasit/shared';

// معرّف المتجر والصلاحيات من جلسة الدخول (الموظف يرى ما يسمح به صاحب المتجر فقط)
export const useVendorSession = () => {
  const session = useSessionStore((s) => s.session) as AuthUser | null;
  const vendorId = session?.vendorId ?? null;
  return {
    session,
    vendorId,
    isStaff: !!session?.isStoreStaff,
    can: (key: VendorPermission) => canDo(session, key),
  };
};

export const useVendorId = (): string => {
  const { vendorId } = useVendorSession();
  return vendorId ?? '';
};
