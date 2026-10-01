import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorService } from '../services';

// مفاتيح الاستعلامات
export const vendorKeys = {
  all: ['vendors'],
  lists: () => [...vendorKeys.all, 'list'],
  list: (filters) => [...vendorKeys.lists(), filters],
  details: () => [...vendorKeys.all, 'detail'],
  detail: (id) => [...vendorKeys.details(), id],
};

/**
 * جلب جميع المتاجر
 */
export const useVendors = (onlyActive = true) => {
  return useQuery({
    queryKey: vendorKeys.list({ onlyActive }),
    queryFn: () => vendorService.getAll(onlyActive),
  });
};

/**
 * جلب المتاجر مع التصفح
 */
export const useVendorsPaged = (params = {}, options = {}) => {
  return useQuery({
    queryKey: vendorKeys.list(params),
    queryFn: () => vendorService.getPaged(params),
    keepPreviousData: true,
    ...options,
  });
};

/**
 * جلب متجر بالمعرف
 */
export const useVendor = (id) => {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => vendorService.getById(id),
    enabled: !!id,
  });
};

/**
 * إنشاء متجر جديد
 */
export const useCreateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorData, logo }) => 
      vendorService.create(vendorData, logo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
  });
};

/**
 * تحديث متجر
 */
export const useUpdateVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, vendorData, newLogo }) => 
      vendorService.update(id, vendorData, newLogo),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
    },
  });
};

/**
 * حذف متجر
 */
export const useDeleteVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => vendorService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
  });
};

/**
 * رفع شعار المتجر
 */
export const useUploadVendorLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, logo }) => 
      vendorService.uploadLogo(vendorId, logo),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(variables.vendorId) });
    },
  });
};

/**
 * حذف شعار المتجر
 */
export const useDeleteVendorLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vendorId) => vendorService.deleteLogo(vendorId),
    onSuccess: (_, vendorId) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) });
    },
  });
};
