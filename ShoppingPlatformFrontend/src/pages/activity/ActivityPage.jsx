// صفحة سجل النشاط في لوحات الأدمن والعمليات والمتجر — النطاق يفرضه الخادم حسب الدور
import { useAuthStore } from '../../stores/authStore'
import ActivityLogView from '../../components/activity/ActivityLogView'

const SUBTITLES = {
  ADMIN: 'كل ما فعله الموظفون والمتاجر والسائقون، ودخولهم',
  OPS: 'ما فعله فريق العمليات، ودخولهم',
  VENDOR: 'ما فعلته في متجرك، وما فعلته الإدارة والعمليات بطلباتك ومنتجاتك',
}

const ActivityPage = () => {
  const role = useAuthStore(s => s.user?.role)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">سجل النشاط</h1>
        <p className="text-gray-500 mt-1 text-sm">{SUBTITLES[role] || ''}</p>
      </div>
      <ActivityLogView role={role} />
    </div>
  )
}

export default ActivityPage
