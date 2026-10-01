import { useState } from 'react'
import {
  Search, UserPlus, MoreVertical, Trash2, Eye, Ban,
  CheckCircle, Users, Store, Shield, RefreshCw, Settings
} from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { Avatar } from '../../components/common/Badge'
import { Tabs, TabsList, TabsTrigger } from '../../components/common/Tabs'
import Pagination from '../../components/common/Pagination'
import Modal, { ConfirmModal } from '../../components/common/Modal'
import Dropdown from '../../components/common/Dropdown'
import EmptyState from '../../components/common/EmptyState'
import { Checkbox } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import {
  useAdminUsers,
  useToggleUserStatus,
  useDeleteUser,
  useCreateOpsUser,
} from '../../hooks/useAdmin'

// ✅ API يرجع role بحروف كبيرة: CUSTOMER, VENDOR, ADMIN, OPS
const ROLE_CONFIG = {
  CUSTOMER: { label: 'عميل',   icon: Users,    bg: 'bg-blue-100',   text: 'text-blue-600'   },
  VENDOR:   { label: 'بائع',   icon: Store,    bg: 'bg-yellow-100', text: 'text-yellow-600' },
  ADMIN:    { label: 'مدير',   icon: Shield,   bg: 'bg-purple-100', text: 'text-purple-600' },
  OPS:      { label: 'عمليات', icon: Settings, bg: 'bg-green-100',  text: 'text-green-600'  },
}

// ✅ يتعامل مع PascalCase و UPPERCASE
const getRoleConfig = (role) =>
  ROLE_CONFIG[role?.toUpperCase()] || ROLE_CONFIG.CUSTOMER

const AdminUsers = () => {
  const { success, error: toastError } = useToast()

  const [searchQuery, setSearchQuery]   = useState('')
  const [currentPage, setCurrentPage]   = useState(1)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [activeTab, setActiveTab]       = useState('all')
  const [showUserModal, setShowUserModal]   = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCreateOpsModal, setShowCreateOpsModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [opsForm, setOpsForm] = useState({ fullName: '', phone: '', password: '', email: '' })

  // ✅ Tab values تطابق ما يمرره adminService.getUsers
  const roleFilter = activeTab !== 'all' ? activeTab : null
  const { data: usersData, isLoading, refetch } = useAdminUsers(roleFilter)
  // الأعداد (البطاقات والتبويبات) من كل المستخدمين دائماً — لا تتغير حسب التبويب المختار.
  // في تبويب "الكل" هو نفس الطلب السابق (مخزّن)
  const { data: allUsersData, refetch: refetchAll } = useAdminUsers(null)

  const { mutateAsync: toggleStatus, isPending: toggling } = useToggleUserStatus()
  const { mutateAsync: deleteUser,   isPending: deleting  } = useDeleteUser()
  const { mutateAsync: createOpsUser, isPending: creatingOps } = useCreateOpsUser()

  const users      = Array.isArray(usersData) ? usersData : (usersData?.items ?? [])
  const totalPages = usersData?.totalPages ?? 1
  const totalCount = usersData?.totalCount ?? users.length

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  })

  // ✅ counts تقارن بـ uppercase لأن الـ API يرجع uppercase
  const allUsers = Array.isArray(allUsersData) ? allUsersData : (allUsersData?.items ?? [])
  const countRole = (r) => allUsers.filter(u => u.role?.toUpperCase() === r).length
  const counts = {
    all:      allUsersData?.totalCount ?? allUsers.length,
    Customer: countRole('CUSTOMER'),
    Vendor:   countRole('VENDOR'),
    Admin:    countRole('ADMIN'),
    Ops:      countRole('OPS'),
  }

  const handleToggleStatus = async (user) => {
    try {
      await toggleStatus(user.id)
      success(user.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل تغيير الحالة')
    }
  }

  const confirmDelete = async () => {
    try {
      await deleteUser(selectedUser.id)
      success('تم حذف المستخدم بنجاح')
      setShowDeleteModal(false)
      setSelectedUser(null)
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل حذف المستخدم')
    }
  }

  const handleCreateOps = async (e) => {
    e.preventDefault()
    if (!opsForm.fullName || !opsForm.phone || !opsForm.password || !opsForm.email) {
      toastError('يجب ملء جميع الحقول المطلوبة')
      return
    }
    try {
      await createOpsUser(opsForm)
      success('تم إنشاء مستخدم العمليات بنجاح')
      setShowCreateOpsModal(false)
      setOpsForm({ fullName: '', phone: '', password: '', email: '' })
      refetch()
    } catch (err) {
      toastError(err.message || 'فشل إنشاء المستخدم')
    }
  }

  const getUserActions = (user) => [
    { label: 'عرض الملف', icon: Eye, onClick: () => { setSelectedUser(user); setShowUserModal(true) } },
    { divider: true },
    user.isActive
      ? { label: 'تعطيل الحساب', icon: Ban,          onClick: () => handleToggleStatus(user), danger: true }
      : { label: 'تفعيل الحساب', icon: CheckCircle,   onClick: () => handleToggleStatus(user) },
    { label: 'حذف', icon: Trash2, onClick: () => { setSelectedUser(user); setShowDeleteModal(true) }, danger: true },
  ]

  const UserRow = ({ user }) => {
    const rc = getRoleConfig(user.role)
    const RoleIcon = rc.icon
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-4">
          <Checkbox
            checked={selectedUsers.includes(user.id)}
            onChange={() => setSelectedUsers(prev =>
              prev.includes(user.id) ? prev.filter(i => i !== user.id) : [...prev, user.id]
            )}
          />
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.fullName || 'مستخدم'} size="md" />
            <div>
              <p className="font-medium text-gray-900">{user.fullName}</p>
              <p className="text-sm text-gray-500">{user.email || '—'}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 text-gray-600 text-sm" dir="ltr">{user.phone || '—'}</td>
        <td className="px-4 py-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rc.bg} ${rc.text}`}>
            <RoleIcon size={13} />{rc.label}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            {user.isActive ? 'نشط' : 'غير نشط'}
          </span>
        </td>
        <td className="px-4 py-4 text-gray-500 text-sm">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-IQ') : '—'}
        </td>
        <td className="px-4 py-4">
          <Dropdown
            trigger={<button className="p-2 hover:bg-gray-100 rounded-lg"><MoreVertical size={18} className="text-gray-500" /></button>}
            items={getUserActions(user)}
            align="left"
          />
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المستخدمين</h1>
          <p className="text-gray-500 mt-1">{counts.all} مستخدم مسجل</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { refetch(); refetchAll() }} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" onClick={() => { setOpsForm({ fullName: '', phone: '', password: '', email: '' }); setShowCreateOpsModal(true) }}>
            <UserPlus size={16} className="ml-1" />إضافة مستخدم Ops
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'الإجمالي', count: counts.all,      icon: Users,    bg: 'bg-blue-100',   text: 'text-blue-600'   },
          { label: 'العملاء',  count: counts.Customer, icon: Users,    bg: 'bg-green-100',  text: 'text-green-600'  },
          { label: 'البائعين', count: counts.Vendor,   icon: Store,    bg: 'bg-yellow-100', text: 'text-yellow-600' },
          { label: 'المديرين', count: counts.Admin,    icon: Shield,   bg: 'bg-purple-100', text: 'text-purple-600' },
          { label: 'العمليات', count: counts.Ops,      icon: Settings, bg: 'bg-teal-100',   text: 'text-teal-600'   },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className={`w-12 h-12 ${s.bg} rounded-lg flex items-center justify-center`}>
              <s.icon size={24} className={s.text} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-60">
            <input
              type="text"
              placeholder="البحث بالاسم، البريد، أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-10 pl-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
            <Search size={16} className="absolute right-3 top-3 text-gray-400" />
          </div>
          {selectedUsers.length > 0 && (
            <span className="text-sm text-gray-600">تم تحديد {selectedUsers.length} مستخدم</span>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={val => { setActiveTab(val); setCurrentPage(1) }}>
          <div className="px-4 border-b border-gray-200">
            <TabsList>
              <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
              <TabsTrigger value="Customer">العملاء ({counts.Customer})</TabsTrigger>
              <TabsTrigger value="Vendor">البائعين ({counts.Vendor})</TabsTrigger>
              <TabsTrigger value="Admin">المديرين ({counts.Admin})</TabsTrigger>
              <TabsTrigger value="Ops">العمليات ({counts.Ops})</TabsTrigger>
            </TabsList>
          </div>

          <div>
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-48" /></div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="لا يوجد مستخدمين"
                  description={searchQuery ? 'لم يتم العثور على مستخدمين يطابقون البحث' : 'لا يوجد مستخدمين مسجلين'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 w-12">
                        <Checkbox
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onChange={() => setSelectedUsers(
                            selectedUsers.length === filteredUsers.length ? [] : filteredUsers.map(u => u.id)
                          )}
                        />
                      </th>
                      {['المستخدم','الهاتف','النوع','الحالة','تاريخ الانضمام',''].map(h => (
                        <th key={h} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredUsers.map(user => <UserRow key={user.id} user={user} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Tabs>

        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex justify-center">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* User Details Modal */}
      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="تفاصيل المستخدم" size="md">
        {selectedUser && (() => {
          const rc = getRoleConfig(selectedUser.role)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Avatar name={selectedUser.fullName || 'مستخدم'} size="xl" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedUser.fullName}</h3>
                  <p className="text-gray-500 text-sm">{selectedUser.email || '—'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${rc.bg} ${rc.text}`}>{rc.label}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      selectedUser.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>{selectedUser.isActive ? 'نشط' : 'غير نشط'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">الهاتف</p>
                  <p className="font-medium text-sm" dir="ltr">{selectedUser.phone || '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">تاريخ الانضمام</p>
                  <p className="font-medium text-sm">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('ar-IQ') : '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">إجمالي الطلبات</p>
                  <p className="font-medium text-sm">{selectedUser.totalOrders ?? 0}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">إجمالي الإنفاق</p>
                  <p className="font-medium text-sm">{(selectedUser.totalSpent ?? 0).toLocaleString()} د.ع</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant={selectedUser.isActive ? 'danger' : 'primary'} fullWidth loading={toggling}
                  onClick={() => { handleToggleStatus(selectedUser); setShowUserModal(false) }}>
                  {selectedUser.isActive ? <><Ban size={15} className="ml-1" />تعطيل</> : <><CheckCircle size={15} className="ml-1" />تفعيل</>}
                </Button>
                <Button variant="danger" fullWidth
                  onClick={() => { setShowUserModal(false); setShowDeleteModal(true) }}>
                  <Trash2 size={15} className="ml-1" />حذف
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Create Ops Modal */}
      <Modal isOpen={showCreateOpsModal} onClose={() => setShowCreateOpsModal(false)} title="إنشاء مستخدم عمليات" size="md">
        <form onSubmit={handleCreateOps} className="space-y-4">
          <Input label="الاسم الكامل" value={opsForm.fullName}
            onChange={e => setOpsForm({...opsForm, fullName: e.target.value})} placeholder="أدخل الاسم الكامل" required />
          <Input label="رقم الهاتف" type="tel" value={opsForm.phone}
            onChange={e => setOpsForm({...opsForm, phone: e.target.value})} placeholder="+964..." required />
          <Input label="كلمة المرور" type="password" value={opsForm.password}
            onChange={e => setOpsForm({...opsForm, password: e.target.value})} placeholder="••••••••" required />
          <Input label="البريد الإلكتروني" type="email" value={opsForm.email}
            onChange={e => setOpsForm({...opsForm, email: e.target.value})} placeholder="email@example.com" required  />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" type="button" fullWidth onClick={() => setShowCreateOpsModal(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" fullWidth loading={creatingOps}>إنشاء المستخدم</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedUser(null) }}
        onConfirm={confirmDelete}
        title="حذف المستخدم"
        message={`هل أنت متأكد من حذف "${selectedUser?.fullName}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
        type="danger" confirmText="حذف" loading={deleting}
      />
    </div>
  )
}

export default AdminUsers