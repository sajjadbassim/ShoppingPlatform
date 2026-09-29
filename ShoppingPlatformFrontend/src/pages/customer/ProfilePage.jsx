import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { User, Mail, Phone, MapPin, Camera, Edit, Shield, Package, Heart, LogOut, Plus, RotateCcw, Star, Clock, Check, X } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { Avatar } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Toggle } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { ConfirmModal } from '../../components/common/Modal'
import { useAuthStore } from '../../stores/authStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useUserAddresses, useCreateAddress, useUpdateAddress, useDeleteAddress } from '../../hooks/useAddresses'
import { userService, authService } from '../../services'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const ProfilePage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()

  const { user, isAuthenticated, logout, updateUser } = useAuthStore()
const { items: wishlistItems, fetchWishlist } = useWishlistStore()
  const { data: addressesData, isLoading: addressesLoading } = useUserAddresses(user?.id)
  const createAddressMutation = useCreateAddress()
  const updateAddressMutation = useUpdateAddress()
  const deleteAddressMutation = useDeleteAddress()
  const addresses = addressesData || []

  // ✅ Returns
  const { data: returnsData, isLoading: returnsLoading } = useQuery({
    queryKey: ['my-returns'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RETURNS.MY)
      return r.data.data || r.data
    },
    staleTime: 2 * 60 * 1000,
  })
  const myReturns = Array.isArray(returnsData) ? returnsData : (returnsData?.items ?? [])
  const pendingReturnsCount = myReturns.filter(r => r.status?.toUpperCase() === 'PENDING').length

  // ✅ Loyalty
  const { data: loyaltyAccount } = useQuery({
    queryKey: ['loyalty-account'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.ACCOUNT)
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '' })
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [addressFormData, setAddressFormData] = useState({
    title: '', phone: '', city: '', area: '', street: '', building: '', isDefault: false,
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState(null)
  const [notifications, setNotifications] = useState({
    orders: true, promotions: true, updates: false, newsletter: true,
  })
useEffect(() => {
  fetchWishlist()
}, [])
  useEffect(() => {
    if (user) setFormData({ fullName: user.fullName || '', email: user.email || '', phone: user.phone || '' })
  }, [user])

  if (!isAuthenticated) { navigate('/login', { state: { from: '/profile' } }); return null }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      const updatedUser = await userService.update(user.id, formData)
      updateUser(updatedUser)
      setIsEditing(false)
      success('تم تحديث البيانات بنجاح')
    } catch (err) { error(err.message || 'فشل تحديث البيانات') }
    finally { setLoading(false) }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) { error('كلمة المرور الجديدة غير متطابقة'); return }
    if (passwordData.newPassword.length < 6) { error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setPasswordLoading(true)
    try {
      await authService.changePassword({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      success('تم تغيير كلمة المرور بنجاح')
    } catch (err) { error(err.message || 'فشل تغيير كلمة المرور') }
    finally { setPasswordLoading(false) }
  }

  const openAddressModal = (address = null) => {
    if (address) {
      setEditingAddress(address)
      setAddressFormData({ title: address.label || '', phone: address.phone || '', city: address.city || '', area: address.area || '', street: address.streetAddress || '', building: address.buildingNumber || '', isDefault: address.isDefault || false })
    } else {
      setEditingAddress(null)
      setAddressFormData({ title: '', phone: user?.phone || '', city: '', area: '', street: '', building: '', isDefault: addresses.length === 0 })
    }
    setShowAddressModal(true)
  }

  const handleSaveAddress = async () => {
    const userId = user?.userId || user?.id
    if (!userId) { error('حدث خطأ في بيانات المستخدم'); return }
    const apiData = { userId, label: addressFormData.title || '', streetAddress: addressFormData.street || '', city: addressFormData.city || '', area: addressFormData.area || '', buildingNumber: addressFormData.building || '', floorNumber: '', apartmentNumber: '', phone: addressFormData.phone || '', notes: '', isDefault: addressFormData.isDefault || false }
    try {
      if (editingAddress) {
        await updateAddressMutation.mutateAsync({ id: editingAddress.id, addressData: apiData })
        success('تم تحديث العنوان بنجاح')
      } else {
        await createAddressMutation.mutateAsync(apiData)
        success('تم إضافة العنوان بنجاح')
      }
      setShowAddressModal(false)
    } catch (err) {
      if (err.errors) {
        error(err.errors[Object.keys(err.errors)[0]][0] || 'يرجى ملء جميع الحقول المطلوبة')
      } else { error(err.message || 'فشل حفظ العنوان') }
    }
  }

  const handleDeleteAddress = async () => {
    try {
      await deleteAddressMutation.mutateAsync(addressToDelete.id)
      success('تم حذف العنوان بنجاح')
    } catch (err) {
      error(err.status === 400 ? 'لا يمكن حذف هذا العنوان لأنه مرتبط بطلبات سابقة' : err.message || 'فشل حذف العنوان')
    } finally { setShowDeleteConfirm(false); setAddressToDelete(null) }
  }

  const handleLogout = () => { logout(); success('تم تسجيل الخروج بنجاح'); navigate('/') }

  const returnStatusMap = {
    PENDING:   { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700', icon: Clock  },
    APPROVED:  { label: 'مقبول',        color: 'bg-green-100 text-green-700',   icon: Check  },
    REJECTED:  { label: 'مرفوض',        color: 'bg-red-100 text-red-600',       icon: X      },
    COMPLETED: { label: 'مكتمل',        color: 'bg-blue-100 text-blue-700',     icon: Check  },
  }

// 1. أولاً الـ query
const { data: ordersData } = useQuery({
  queryKey: ['customer-orders-count', user?.userId || user?.id],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.ORDERS.BY_CUSTOMER(user?.userId || user?.id))
    return r.data.data || r.data
  },
  enabled: !!(user?.userId || user?.id),
  staleTime: 2 * 60 * 1000,
})

// 2. ثانياً stats — بعد الـ query مباشرة
const stats = { 
  ordersCount: Array.isArray(ordersData) ? ordersData.length : 0, 
  wishlistCount: wishlistItems.length 
}
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={[{ label: 'حسابي' }]} className="mb-6" />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full lg:w-80">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <Avatar name={user?.fullName || 'مستخدم'} size="xl" className="w-24 h-24 text-3xl" />
                  <button className="absolute bottom-0 left-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90"><Camera size={16} /></button>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-4">{user?.fullName}</h2>
                <p className="text-gray-500">{user?.email || user?.phone}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-200">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{stats.ordersCount}</p>
                  <p className="text-xs text-gray-500">طلب</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{stats.wishlistCount}</p>
                  <p className="text-xs text-gray-500">مفضلة</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-500 flex items-center justify-center gap-0.5">
                    <Star size={14} className="fill-yellow-400" />
                    {(loyaltyAccount?.balance ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">نقطة</p>
                </div>
              </div>

              <nav className="mt-4 space-y-1">
                <Link to="/orders" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Package size={20} /><span>طلباتي</span>
                </Link>
                <Link to="/wishlist" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Heart size={20} /><span>المفضلة</span>
                </Link>
                <Link to="/loyalty" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Star size={20} className="text-yellow-400" /><span>نقاط الولاء</span>
                  {(loyaltyAccount?.points ?? 0) > 0 && (
                    <span className="mr-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {loyaltyAccount.points.toLocaleString()}
                    </span>
                  )}
                </Link>
                <Link to="/returns" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <RotateCcw size={20} /><span>طلبات الإرجاع</span>
                  {pendingReturnsCount > 0 && (
                    <span className="mr-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{pendingReturnsCount}</span>
                  )}
                </Link>
                <Link to="/settings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Shield size={20} /><span>الإعدادات</span>
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg w-full">
                  <LogOut size={20} /><span>تسجيل الخروج</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl border border-gray-200">
              <Tabs defaultValue="profile">
                <div className="px-6 border-b border-gray-200">
                  <TabsList>
                    <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
                    <TabsTrigger value="addresses">العناوين</TabsTrigger>
                    <TabsTrigger value="returns">
                      الإرجاع{pendingReturnsCount > 0 ? ` (${pendingReturnsCount})` : ''}
                    </TabsTrigger>
                    <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
                    <TabsTrigger value="security">الأمان</TabsTrigger>
                  </TabsList>
                </div>

                {/* Profile Tab */}
                <TabsContent value="profile" className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">المعلومات الشخصية</h3>
                    {!isEditing && <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}><Edit size={16} className="ml-1" />تعديل</Button>}
                  </div>
                  {isEditing ? (
                    <div className="space-y-4">
                      <Input label="الاسم الكامل" name="fullName" value={formData.fullName} onChange={handleChange} />
                      <Input label="البريد الإلكتروني" name="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" />
                      <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={handleChange} dir="ltr" disabled hint="لا يمكن تغيير رقم الهاتف" />
                      <div className="flex gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>إلغاء</Button>
                        <Button variant="primary" onClick={handleSaveProfile} loading={loading}>حفظ التغييرات</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { icon: User,  label: 'الاسم الكامل',      value: user?.fullName },
                        { icon: Mail,  label: 'البريد الإلكتروني', value: user?.email },
                        { icon: Phone, label: 'رقم الهاتف',         value: user?.phone, dir: 'ltr' },
                      ].map(({ icon: Icon, label, value, dir }) => (
                        <div key={label} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                          <Icon size={20} className="text-gray-400" />
                          <div><p className="text-sm text-gray-500">{label}</p><p className="font-medium text-gray-900" dir={dir}>{value || 'غير محدد'}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Addresses Tab */}
                <TabsContent value="addresses" className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">عناويني</h3>
                    <Button variant="primary" size="sm" onClick={() => openAddressModal()}><Plus size={16} className="ml-1" />إضافة عنوان</Button>
                  </div>
                  {addressesLoading ? (
                    <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
                  ) : addresses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>لا توجد عناوين محفوظة</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => openAddressModal()}>إضافة عنوان جديد</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {addresses.map(addr => (
                        <div key={addr.id} className={`p-4 rounded-xl border-2 ${addr.isDefault ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-900 flex items-center gap-2">
                                {addr.title || 'عنوان'}
                                {addr.isDefault && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">افتراضي</span>}
                              </p>
                              <p className="text-gray-600 text-sm">{addr.city}، {addr.area}، {addr.street}</p>
                              <p className="text-gray-500 text-sm mt-1" dir="ltr">{addr.phone}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openAddressModal(addr)}>تعديل</Button>
                              {!addr.isDefault && (
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => { setAddressToDelete(addr); setShowDeleteConfirm(true) }}>حذف</Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ✅ Returns Tab */}
                <TabsContent value="returns" className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">طلبات الإرجاع</h3>
                    <Link to="/returns">
                      <Button variant="primary" size="sm"><Plus size={16} className="ml-1" />طلب جديد</Button>
                    </Link>
                  </div>
                  {returnsLoading ? (
                    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                  ) : myReturns.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <RotateCcw size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>لا توجد طلبات إرجاع</p>
                      <Link to="/returns"><Button variant="outline" size="sm" className="mt-4">تقديم طلب إرجاع</Button></Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myReturns.slice(0, 5).map(ret => {
                        const s = returnStatusMap[ret.status?.toUpperCase()] || returnStatusMap.PENDING
                        const Icon = s.icon
                        return (
                          <div key={ret.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                              <p className="font-medium text-gray-900">#{ret.returnNumber || ret.id?.slice(0,8)}</p>
                              <p className="text-xs text-gray-400">{new Date(ret.createdAt).toLocaleDateString('ar-IQ')}</p>
                              <p className="text-sm text-gray-500 mt-0.5">{ret.reasonAr || ret.reason}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>
                              <Icon size={11} />{s.label}
                            </span>
                          </div>
                        )
                      })}
                      {myReturns.length > 5 && (
                        <Link to="/returns" className="block text-center text-sm text-primary hover:underline py-2">
                          عرض كل الطلبات ({myReturns.length})
                        </Link>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">إعدادات الإشعارات</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'orders',     title: 'تحديثات الطلبات',  desc: 'إشعارات عن حالة طلباتك' },
                      { key: 'promotions', title: 'العروض والخصومات', desc: 'إشعارات عن العروض الجديدة' },
                      { key: 'updates',    title: 'تحديثات المنصة',   desc: 'إشعارات عن الميزات الجديدة' },
                      { key: 'newsletter', title: 'النشرة البريدية',  desc: 'رسائل أسبوعية عن المنتجات' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <Toggle checked={notifications[item.key]} onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })} />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">الأمان وكلمة المرور</h3>
                  <div className="space-y-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-4">تغيير كلمة المرور</h4>
                      <div className="space-y-4">
                        <Input label="كلمة المرور الحالية" type="password" placeholder="••••••••" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} />
                        <Input label="كلمة المرور الجديدة" type="password" placeholder="••••••••" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
                        <Input label="تأكيد كلمة المرور" type="password" placeholder="••••••••" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
                        <Button variant="primary" onClick={handleChangePassword} loading={passwordLoading} disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}>تحديث كلمة المرور</Button>
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <h4 className="font-medium text-red-700 mb-2">حذف الحساب</h4>
                      <p className="text-sm text-gray-600 mb-4">سيتم حذف جميع بياناتك نهائياً</p>
                      <Button variant="danger">حذف الحساب</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddressModal(false)} />
          <div className="relative bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">{editingAddress ? 'تعديل العنوان' : 'إضافة عنوان جديد'}</h3>
              <div className="space-y-4">
                <Input label="عنوان مختصر" placeholder="مثال: المنزل، العمل" value={addressFormData.title} onChange={(e) => setAddressFormData({ ...addressFormData, title: e.target.value })} />
                <Input label="رقم الهاتف" placeholder="07XX XXX XXXX" value={addressFormData.phone} onChange={(e) => setAddressFormData({ ...addressFormData, phone: e.target.value })} dir="ltr" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="المدينة" placeholder="بغداد" value={addressFormData.city} onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })} />
                  <Input label="المنطقة" placeholder="المنصور" value={addressFormData.area} onChange={(e) => setAddressFormData({ ...addressFormData, area: e.target.value })} />
                </div>
                <Input label="الشارع" placeholder="شارع 14 رمضان" value={addressFormData.street} onChange={(e) => setAddressFormData({ ...addressFormData, street: e.target.value })} />
                <Input label="تفاصيل إضافية (اختياري)" placeholder="رقم البناية، الشقة..." value={addressFormData.building} onChange={(e) => setAddressFormData({ ...addressFormData, building: e.target.value })} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={addressFormData.isDefault} onChange={(e) => setAddressFormData({ ...addressFormData, isDefault: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-sm text-gray-600">تعيين كعنوان افتراضي</span>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="ghost" onClick={() => setShowAddressModal(false)}>إلغاء</Button>
                <Button variant="primary" onClick={handleSaveAddress} loading={createAddressMutation.isPending || updateAddressMutation.isPending}>
                  {editingAddress ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setAddressToDelete(null) }}
        onConfirm={handleDeleteAddress}
        title="حذف العنوان"
        message="هل أنت متأكد من حذف هذا العنوان؟"
        type="danger"
        confirmText="حذف"
        loading={deleteAddressMutation.isPending}
      />
    </div>
  )
}

export default ProfilePage