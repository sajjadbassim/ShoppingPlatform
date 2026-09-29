import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, orderService } from '../services';

export const adminKeys = {
  stats:    ['admin', 'stats'],
  users:    ['admin', 'users'],
  vendors:  ['admin', 'vendors'],
  orders:   ['admin', 'orders'],
  products: ['admin', 'products'],
  reports:  ['admin', 'reports'],
};

// ============================================================
// Dashboard
// ============================================================

export const useAdminStats = () => useQuery({
  queryKey: adminKeys.stats,
  queryFn:  () => adminService.getDashboardStats(),
  staleTime: 2 * 60 * 1000,
});

export const useAdminDashboard = useAdminStats;

// ============================================================
// Users
// ============================================================

// ✅ إصلاح: الـ API يقبل { role } وليس params عشوائي
export const useAdminUsers = (role = null) => useQuery({
  queryKey: [...adminKeys.users, role],
  queryFn:  () => adminService.getUsers(role),
  staleTime: 2 * 60 * 1000,
});

export const useSearchUsers = ({ term, role, pageSize = 10 } = {}) => useQuery({
  queryKey: [...adminKeys.users, 'search', { term, role, pageSize }],
  queryFn:  () => adminService.searchUsers({ term, role, pageSize }),
  enabled:  !!term,
  staleTime: 30 * 1000,
  placeholderData: (prev) => prev,
});

export const useCreateOpsUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userData) => adminService.createOpsUser(userData),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => adminService.toggleUserStatus(userId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => adminService.deleteUser(userId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

// ============================================================
// Vendors
// ============================================================

// ✅ إصلاح: الـ API يقبل isActive كـ boolean مباشرة وليس params object
// useAdminVendors()         → جلب الكل
// useAdminVendors(true)     → النشطة فقط
// useAdminVendors(false)    → المعطلة فقط
export const useAdminVendors = (isActive = null) => useQuery({
  queryKey: [...adminKeys.vendors, isActive],
  queryFn:  () => adminService.getVendors(isActive),
  staleTime: 2 * 60 * 1000,
});

export const useToggleVendorStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vendorId) => adminService.toggleVendorStatus(vendorId),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors })
      queryClient.invalidateQueries({ queryKey: adminKeys.stats })
    },
  })
}

// ============================================================
// Products
// ============================================================

// ✅ الـ API يقبل isActive كـ boolean
export const useAdminProducts = (isActive = null) => useQuery({
  queryKey: [...adminKeys.products, isActive],
  queryFn:  () => adminService.getProducts(isActive),
  staleTime: 2 * 60 * 1000,
});

export const useToggleProductStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId) => adminService.toggleProductStatus(productId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: adminKeys.products }),
  })
}

export const useBulkUpdateProductStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => adminService.bulkUpdateProductStatus(data),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: adminKeys.products }),
  })
}

// ============================================================
// Orders
// ============================================================

// ✅ orderService.getPaged يقبل { pageSize, pageNumber, status, ... }
export const useAdminOrders = (params = {}) => useQuery({
  queryKey: [...adminKeys.orders, params],
  queryFn:  () => orderService.getPaged(params),
  staleTime: 1 * 60 * 1000,
});

// ============================================================
// Reports
// ============================================================

export const useSalesReport = (params = {}) => useQuery({
  queryKey: [...adminKeys.reports, 'sales', params],
  queryFn:  () => adminService.getSalesReport(params),
  staleTime: 5 * 60 * 1000,
});

export const useTopVendors = (count = 10) => useQuery({
  queryKey: [...adminKeys.reports, 'top-vendors', count],
  queryFn:  () => adminService.getTopVendors(count),
  staleTime: 5 * 60 * 1000,
});

export const useTopProducts = (count = 10) => useQuery({
  queryKey: [...adminKeys.reports, 'top-products', count],
  queryFn:  () => adminService.getTopProducts(count),
  staleTime: 5 * 60 * 1000,
});