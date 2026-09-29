import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryService } from '../services';

// مفاتيح الاستعلامات
export const categoryKeys = {
  all: ['categories'],
  lists: () => [...categoryKeys.all, 'list'],
  list: (filters) => [...categoryKeys.lists(), filters],
  details: () => [...categoryKeys.all, 'detail'],
  detail: (id) => [...categoryKeys.details(), id],
  root: () => [...categoryKeys.all, 'root'],
  children: (parentId) => [...categoryKeys.all, 'children', parentId],
};

/**
 * جلب جميع التصنيفات
 */
export const useCategories = (onlyActive = true) => {
  return useQuery({
    queryKey: categoryKeys.list({ onlyActive }),
    queryFn: () => categoryService.getAll(onlyActive),
  });
};

/**
 * جلب التصنيفات مع التصفح
 */
export const useCategoriesPaged = (params = {}) => {
  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoryService.getPaged(params),
    keepPreviousData: true,
  });
};

/**
 * جلب تصنيف بالمعرف
 */
export const useCategory = (id) => {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => categoryService.getById(id),
    enabled: !!id,
  });
};

/**
 * جلب التصنيفات الجذرية
 */
export const useRootCategories = (onlyActive = true) => {
  return useQuery({
    queryKey: [...categoryKeys.root(), { onlyActive }],
    queryFn: () => categoryService.getRoot(onlyActive),
  });
};

/**
 * جلب التصنيفات الفرعية
 */
export const useChildCategories = (parentId, onlyActive = true) => {
  return useQuery({
    queryKey: [...categoryKeys.children(parentId), { onlyActive }],
    queryFn: () => categoryService.getChildren(parentId, onlyActive),
    enabled: !!parentId,
  });
};

/**
 * إنشاء تصنيف جديد
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryData, icon }) => 
      categoryService.create(categoryData, icon),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

/**
 * تحديث تصنيف
 */
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryData, newIcon }) => 
      categoryService.update(id, categoryData, newIcon),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

/**
 * حذف تصنيف
 */
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => categoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

/**
 * رفع أيقونة التصنيف
 */
export const useUploadCategoryIcon = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, icon }) => 
      categoryService.uploadIcon(categoryId, icon),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.categoryId) });
    },
  });
};

/**
 * حذف أيقونة التصنيف
 */
export const useDeleteCategoryIcon = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId) => categoryService.deleteIcon(categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(categoryId) });
    },
  });
};
