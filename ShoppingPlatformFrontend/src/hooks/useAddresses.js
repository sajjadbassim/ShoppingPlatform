import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addressService } from '../services';

// مفاتيح الاستعلامات
export const addressKeys = {
  all: ['addresses'],
  lists: () => [...addressKeys.all, 'list'],
  details: () => [...addressKeys.all, 'detail'],
  detail: (id) => [...addressKeys.details(), id],
  byUser: (userId) => [...addressKeys.all, 'user', userId],
};

/**
 * جلب جميع العناوين
 */
export const useAddresses = () => {
  return useQuery({
    queryKey: addressKeys.lists(),
    queryFn: () => addressService.getAll(),
  });
};

/**
 * جلب عنوان بالمعرف
 */
export const useAddress = (id) => {
  return useQuery({
    queryKey: addressKeys.detail(id),
    queryFn: () => addressService.getById(id),
    enabled: !!id,
  });
};

/**
 * جلب عناوين مستخدم معين
 */
export const useUserAddresses = (userId) => {
  return useQuery({
    queryKey: addressKeys.byUser(userId),
    queryFn: () => addressService.getByUser(userId),
    enabled: !!userId,
  });
};

/**
 * إنشاء عنوان جديد
 */
export const useCreateAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressData) => addressService.create(addressData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
    },
  });
};

/**
 * تحديث عنوان
 */
export const useUpdateAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, addressData }) =>   // ✅ destructure بشكل صحيح
      addressService.update(id, addressData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: addressKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: addressKeys.lists() });
    },
  });
};

/**
 * حذف عنوان
 */
export const useDeleteAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => addressService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all });
    },
  });
};
