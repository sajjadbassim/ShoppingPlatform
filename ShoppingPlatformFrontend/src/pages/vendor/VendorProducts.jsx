import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, MoreVertical, Edit, Trash2, Eye,
  Package, Grid, List, RefreshCw, AlertCircle,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Checkbox } from '../../components/common/FormControls'
import Pagination from '../../components/common/Pagination'
import { ConfirmModal } from '../../components/common/Modal'
import EmptyState from '../../components/common/EmptyState'
import Dropdown from '../../components/common/Dropdown'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useDeleteProduct } from '../../hooks/useProducts'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

// ✅ Hook يجلب منتجات البائع مباشرة
const useVendorProducts = (vendorId) => useQuery({
  queryKey: ['vendor-products', vendorId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId))
    return r.data.data || r.data
  },
  enabled: !!vendorId,
  staleTime: 2 * 60 * 1000,
})

const VendorProducts = () => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()  // ✅ إصلاح اسم الدالة
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id

  const { data: productsData, isLoading, isError, error, refetch } = useVendorProducts(vendorId)
  const { mutateAsync: deleteProduct, isPending: deleting } = useDeleteProduct()

  const products = Array.isArray(productsData) ? productsData : []

  const [viewMode,          setViewMode]          = useState('table')
  const [searchQuery,       setSearchQuery]        = useState('')
  const [selectedProducts,  setSelectedProducts]   = useState([])
  const [currentPage,       setCurrentPage]        = useState(1)
  const [showDeleteModal,   setShowDeleteModal]    = useState(false)
  const [productToDelete,   setProductToDelete]    = useState(null)
  const [filterStatus,      setFilterStatus]       = useState('all')

  const filteredProducts = products.filter(p => {
    const name = (p.nameAr || p.name || '').toLowerCase()
    const sku  = (p.sku || '').toLowerCase()
    const q    = searchQuery.toLowerCase()
    const matchesSearch = !q || name.includes(q) || sku.includes(q)
    const matchesStatus =
      filterStatus === 'all'          ? true :
      filterStatus === 'active'       ? p.isActive && p.isAvailable :
      filterStatus === 'inactive'     ? !p.isActive :
      filterStatus === 'out_of_stock' ? p.stockQuantity === 0 : true
    return matchesSearch && matchesStatus
  })

  const pageSize        = 10
  const totalPages      = Math.ceil(filteredProducts.length / pageSize)
  const paginated       = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ✅ الصورة الرئيسية
  const getProductImage = (product) => {
    if (product.primaryImageUrl) return getImageUrl(product.primaryImageUrl)
    const primary = product.images?.find(i => i.isPrimary) || product.images?.[0]
    return getImageUrl(primary?.imageUrl) || null
  }

  const confirmDelete = async () => {
    try {
      await deleteProduct(productToDelete.id)
      success('تم حذف المنتج بنجاح')
      setShowDeleteModal(false)
      setProductToDelete(null)
      refetch()
    } catch (err) {
      showError(err.message || 'فشل حذف المنتج')
    }
  }

  const getProductActions = (product) => [
    { label: 'عرض',   icon: Eye,   onClick: () => navigate(`/products/${product.id}`) },
    { label: 'تعديل', icon: Edit,  onClick: () => navigate(`/vendor/products/${product.id}/edit`) },
    { divider: true },
    { label: 'حذف',   icon: Trash2, onClick: () => { setProductToDelete(product); setShowDeleteModal(true) }, danger: true },
  ]

  // Stock badge
  const StockBadge = ({ qty, isActive }) => {
    if (qty === 0)   return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">نفذ</span>
    if (!isActive)   return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">غير نشط</span>
    if (qty < 10)    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">منخفض ({qty})</span>
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">نشط</span>
  }

  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المنتجات</h1>
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">{error?.message || 'فشل تحميل المنتجات'}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المنتجات</h1>
          <p className="text-gray-500 mt-1">{products.length} منتج في متجرك</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Link to="/vendor/products/new">
            <Button variant="primary"><Plus size={16} className="ml-1" />إضافة منتج</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            placeholder="البحث بالاسم أو SKU..."
            className="w-full h-9 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary" />
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="all">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="out_of_stock">نفذ المخزون</option>
        </select>
        <div className="flex items-center border border-gray-300 rounded-lg">
          <button onClick={() => setViewMode('table')}
            className={`p-2 ${viewMode === 'table' ? 'bg-gray-100 text-primary' : 'text-gray-500 hover:bg-gray-50'}`}>
            <List size={16} />
          </button>
          <button onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-primary' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Grid size={16} />
          </button>
        </div>

        {selectedProducts.length > 0 && (
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-sm text-gray-600">تم تحديد {selectedProducts.length}</span>
            <Button variant="ghost" size="sm" className="text-red-500">حذف المحدد</Button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
              <div className="flex-1"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10">
          <EmptyState title="لا توجد منتجات"
            description={searchQuery ? 'لا توجد نتائج للبحث' : 'لم تضف أي منتجات بعد'}
            action={<Link to="/vendor/products/new"><Button variant="primary"><Plus size={16} className="ml-1" />إضافة منتج</Button></Link>} />
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={selectedProducts.length === paginated.length && paginated.length > 0}
                      onChange={() => setSelectedProducts(
                        selectedProducts.length === paginated.length ? [] : paginated.map(p => p.id)
                      )}
                    />
                  </th>
                  {['المنتج','SKU','السعر','المخزون','الحالة',''].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => setSelectedProducts(prev =>
                          prev.includes(product.id) ? prev.filter(i => i !== product.id) : [...prev, product.id]
                        )}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {getProductImage(product)
                            ? <img src={getProductImage(product)} alt=""
                                className="w-full h-full object-cover"
                                onError={e => e.target.style.display='none'} />
                            : <Package size={20} className="m-auto text-gray-300 mt-3" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.nameAr || product.name}</p>
                          <p className="text-xs text-gray-400">{product.categoryName || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{product.sku || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{(product.price || 0).toLocaleString()} د.ع</td>
                    <td className="px-4 py-3">
                      <span className={
                        product.stockQuantity === 0 ? 'text-red-500 font-medium' :
                        product.stockQuantity < 10 ? 'text-yellow-600 font-medium' : 'text-gray-700'
                      }>{product.stockQuantity ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge qty={product.stockQuantity ?? 0} isActive={product.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <Dropdown
                        trigger={<button className="p-1.5 hover:bg-gray-100 rounded-lg"><MoreVertical size={16} className="text-gray-500" /></button>}
                        items={getProductActions(product)}
                        align="left"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginated.map(product => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 relative">
                {getProductImage(product)
                  ? <img src={getProductImage(product)} alt="" className="w-full h-full object-cover"
                      onError={e => e.target.style.display='none'} />
                  : <Package size={32} className="absolute inset-0 m-auto text-gray-300" />
                }
                <div className="absolute top-2 right-2">
                  <StockBadge qty={product.stockQuantity ?? 0} isActive={product.isActive} />
                </div>
                <div className="absolute top-2 left-2">
                  <Dropdown
                    trigger={<button className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50"><MoreVertical size={14} /></button>}
                    items={getProductActions(product)}
                    align="left"
                  />
                </div>
              </div>
              <div className="p-3">
                <p className="font-medium text-gray-900 truncate text-sm">{product.nameAr || product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{product.sku || '—'}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary text-sm">{(product.price || 0).toLocaleString()} د.ع</span>
                  <span className="text-xs text-gray-400">مخزون: {product.stockQuantity ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredProducts.length > pageSize && (
        <div className="flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setProductToDelete(null) }}
        onConfirm={confirmDelete}
        title="حذف المنتج"
        message={`هل أنت متأكد من حذف "${productToDelete?.nameAr || productToDelete?.name}"؟`}
        confirmText="حذف" type="danger" loading={deleting}
      />
    </div>
  )
}

export default VendorProducts