import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchAllCategories,
  fetchChildCategories,
  fetchProduct,
  fetchProducts,
  fetchRootCategories,
  fetchVendor,
  fetchVariants,
  type ProductQuery,
} from '@wasit/shared';

// قائمة منتجات بتمرير لا نهائي: تتغيّر بتغيّر البحث والقسم والترتيب
export const useProducts = (query: Omit<ProductQuery, 'pageNumber'>) =>
  useInfiniteQuery({
    queryKey: ['products', query],
    queryFn: ({ pageParam }) => fetchProducts({ ...query, pageNumber: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasNext ? last.pagination.currentPage + 1 : undefined),
    // أثناء الكتابة تبقى النتائج السابقة ظاهرة بدل وميض الشاشة
    placeholderData: keepPreviousData,
  });

// صفحة منتجات برقم (ترقيم كما في الويب): النتائج السابقة تبقى ظاهرة أثناء تحميل الصفحة الجديدة
export const useProductsPage = (query: Omit<ProductQuery, 'pageNumber'>, page: number, enabled = true) =>
  useQuery({
    queryKey: ['products', 'page', query, page],
    queryFn: () => fetchProducts({ ...query, pageNumber: page }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useProduct = (id: string) => useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id) });

export const useVariants = (productId: string, enabled: boolean) =>
  useQuery({ queryKey: ['variants', productId], queryFn: () => fetchVariants(productId), enabled });

export const useRootCategories = () =>
  useQuery({ queryKey: ['categories', 'root'], queryFn: fetchRootCategories, staleTime: 30 * 60 * 1000 });

export const useVendor = (id: string) => useQuery({ queryKey: ['vendor', id], queryFn: () => fetchVendor(id), enabled: !!id });

export const useChildCategories = (parentId?: string) =>
  useQuery({
    queryKey: ['categories', 'children', parentId],
    queryFn: () => fetchChildCategories(parentId as string),
    enabled: !!parentId,
    staleTime: 30 * 60 * 1000,
  });

export const useAllCategories = () =>
  useQuery({ queryKey: ['categories', 'all'], queryFn: fetchAllCategories, staleTime: 30 * 60 * 1000 });
