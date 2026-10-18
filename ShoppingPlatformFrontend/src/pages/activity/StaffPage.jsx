// الموظفون (لوحة المتجر) والمسؤولون (لوحة الأدمن) — نفس الشاشة، ونقطة الخادم حسب الدور
import { useAuthStore } from '../../stores/authStore'
import StaffManager from '../../components/staff/StaffManager'
import { API_ENDPOINTS } from '../../api/endpoints'

const StaffPage = () => {
  const user = useAuthStore(s => s.user)
  const vendor = user?.role === 'VENDOR'
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{vendor ? 'الموظفون' : 'المسؤولون'}</h1>
        <p className="text-gray-500 mt-1 text-sm">{vendor ? 'أشخاص يديرون متجرك معك بصلاحيات تحددها' : 'حسابات الإدارة وصلاحيات كل منها'}</p>
      </div>
      <StaffManager kind={vendor ? 'vendor' : 'admin'} endpoint={vendor ? API_ENDPOINTS.STAFF.VENDOR : API_ENDPOINTS.STAFF.ADMIN}
        currentUserId={user?.id} />
    </div>
  )
}

export default StaffPage
