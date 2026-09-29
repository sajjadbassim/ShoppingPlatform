// src/hooks/useVariants.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { variantsService } from '../services/variantsService';

// ===========================
// Query Keys
// ===========================

export const variantKeys = {
  all: (productId) => ['variants', productId],
  list: (productId) => [...variantKeys.all(productId), 'list'],
  detail: (productId, variantId) => [...variantKeys.all(productId), variantId],
  attributes: (productId) => [...variantKeys.all(productId), 'attributes'],
};

// ===========================
// Queries
// ===========================

/**
 * جلب كل المتغيرات لمنتج
 * الاستخدام: const { data: variants } = useProductVariants(productId)
 */
export const useProductVariants = (productId) => {
  return useQuery({
    queryKey: variantKeys.list(productId),
    queryFn: () => variantsService.getVariants(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * جلب صفات المنتج
 */
export const useProductAttributes = (productId) => {
  return useQuery({
    queryKey: variantKeys.attributes(productId),
    queryFn: () => variantsService.getAttributes(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * جلب variant بالمعرف
 */
export const useProductVariant = (productId, variantId) => {
  return useQuery({
    queryKey: variantKeys.detail(productId, variantId),
    queryFn: () => variantsService.getVariantById(productId, variantId),
    enabled: !!productId && !!variantId,
    staleTime: 5 * 60 * 1000,
  });
};

// ===========================
// Mutations (Vendor)
// ===========================

export const useCreateVariant = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => variantsService.createVariant(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all(productId) });
    },
  });
};

export const useUpdateVariant = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, data }) => variantsService.updateVariant(productId, variantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all(productId) });
    },
  });
};

export const useDeleteVariant = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variantId) => variantsService.deleteVariant(productId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.all(productId) });
    },
  });
};

export const useCreateAttribute = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => variantsService.createAttribute(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.attributes(productId) });
    },
  });
};

export const useUpdateAttribute = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, data }) => variantsService.updateAttribute(productId, attributeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.attributes(productId) });
    },
  });
};

export const useDeleteAttribute = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attributeId) => variantsService.deleteAttribute(productId, attributeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.attributes(productId) });
    },
  });
};

export const useAddAttributeValue = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, data }) => variantsService.addAttributeValue(productId, attributeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.attributes(productId) });
    },
  });
};

export const useDeleteAttributeValue = (productId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, valueId }) => variantsService.deleteAttributeValue(productId, attributeId, valueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.attributes(productId) });
    },
  });
};