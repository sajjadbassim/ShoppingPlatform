import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services';

// ===========================
// Query Keys
// ===========================

export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (filters) => [...productKeys.lists(), filters],
  details: () => [...productKeys.all, 'detail'],
  detail: (id) => [...productKeys.details(), id],
  byVendor: (vendorId) => [...productKeys.all, 'vendor', vendorId],
  byCategory: (categoryId) => [...productKeys.all, 'category', categoryId],
  search: (term) => [...productKeys.all, 'search', term],
  unifiedSearch: (term, params) => [...productKeys.all, 'unified-search', term, params], // ✅ جديد
  advancedFilter: (filters) => [...productKeys.all, 'advanced-filter', filters],         // ✅ جديد
};

// ===========================
// Hooks الموجودة (بدون تغيير)
// ===========================

/**
 * جلب جميع المنتجات
 */
export const useProducts = () => {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productService.getAll(),
  });
};

/**
 * جلب المنتجات مع التصفية والصفحات
 */
export const useProductsPaged = (params = {}, options = {}) => {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => productService.getPaged(params),
    keepPreviousData: true,
    ...options,
  });
};

/**
 * جلب منتج بالمعرف
 */
export const useProduct = (id) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productService.getById(id),
    enabled: !!id,
  });
};

/**
 * جلب منتجات بائع معين
 */
export const useProductsByVendor = (vendorId) => {
  return useQuery({
    queryKey: productKeys.byVendor(vendorId),
    queryFn: () => productService.getByVendor(vendorId),
    enabled: !!vendorId,
  });
};

/**
 * جلب منتجات تصنيف معين
 */
export const useProductsByCategory = (categoryId) => {
  return useQuery({
    queryKey: productKeys.byCategory(categoryId),
    queryFn: () => productService.getByCategory(categoryId),
    enabled: !!categoryId,
  });
};

/**
 * البحث البسيط (القديم — لا يزال يعمل)
 */
export const useProductSearch = (term) => {
  return useQuery({
    queryKey: productKeys.search(term),
    queryFn: () => productService.search(term),
    enabled: !!term && term.length >= 2,
  });
};

// ===========================
// ✅ جديد — البحث الموحد
// ===========================

/**
 * البحث الموحد — استخدمه في شريط البحث الرئيسي
 * يبحث في الاسم + الوصف + البائع + التصنيف دفعة واحدة
 *
 * الاستخدام:
 *   const { data, isLoading } = useUnifiedSearch(searchTerm)
 *   const products = data?.items || data || []
 *
 * @param {string} term   - نص البحث (يبدأ من 2 حرف)
 * @param {Object} params - { pageNumber?, pageSize? }
 */
export const useUnifiedSearch = (term, params = {}) => {
  return useQuery({
    queryKey: productKeys.unifiedSearch(term, params),
    queryFn: () => productService.unifiedSearch(term, params),
    enabled: !!term && term.length >= 2,
    staleTime: 30 * 1000, // 30 ثانية — البحث يتغير كثيراً
    keepPreviousData: true,
  });
};

// ===========================
// ✅ جديد — الفلتر المتقدم (useQuery — للفلاتر الثابتة في URL)
// ===========================

/**
 * الفلتر المتقدم كـ useQuery
 * مناسب عندما تريد الفلاتر في الـ URL وتُحدَّث تلقائياً
 *
 * الاستخدام:
 *   const { data, isLoading } = useAdvancedFilter({
 *     categoryId, minPrice, maxPrice, hasDiscount, minRating,
 *     pageNumber: 1, pageSize: 12, sortBy: 'price', sortOrder: 'asc'
 *   })
 *
 * @param {Object}  filters
 * @param {boolean} [enabled=true] - تعطيل الـ query حسب الحاجة
 */
export const useAdvancedFilter = (filters = {}, enabled = true) => {
  return useQuery({
    queryKey: productKeys.advancedFilter(filters),
    queryFn: () => productService.advancedFilter(filters),
    enabled,
    keepPreviousData: true,
    staleTime: 1 * 60 * 1000,
  });
};

// ===========================
// ✅ جديد — الفلتر المتقدم (useMutation — للفلاتر الديناميكية)
// ===========================

/**
 * الفلتر المتقدم كـ useMutation
 * مناسب عندما تريد تشغيل الفلتر عند الضغط على زر "بحث" / "تطبيق"
 *
 * الاستخدام:
 *   const { mutateAsync: applyFilter, data, isPending } = useFilterProducts()
 *   const results = await applyFilter({ categoryId, minPrice, hasDiscount })
 */
export const useFilterProducts = () => {
  return useMutation({
    mutationFn: (filters) => productService.advancedFilter(filters),
  });
};

// ===========================
// Mutations الموجودة (بدون تغيير)
// ===========================

/**
 * إنشاء منتج جديد
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productData, images }) =>
      productService.create(productData, images),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

/**
 * تحديث منتج
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, productData, newImages }) =>
      productService.update(id, productData, newImages),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
};

/**
 * حذف منتج
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => productService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

/**
 * إضافة صورة للمنتج
 */
export const useAddProductImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, image }) =>
      productService.addImage(productId, image),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) });
    },
  });
};

/**
 * حذف صورة منتج
 */
export const useDeleteProductImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId) => productService.deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

/**
 * تحديث المخزون
 */
export const useUpdateProductStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, quantity }) =>
      productService.updateStock(productId, quantity),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) });
    },
  });
};
