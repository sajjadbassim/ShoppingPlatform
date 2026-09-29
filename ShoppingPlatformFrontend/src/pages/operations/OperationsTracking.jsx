// src/pages/operations/OperationsTracking.jsx
import { MapPin, Construction } from 'lucide-react'

// ✅ صفحة مؤقتة (Placeholder) — الميزة الحقيقية (تتبع السائقين على الخريطة لحظياً)
// غير مبنية بعد لا في الفرونت اند ولا في الباك اند. هذه الصفحة موجودة فقط
// لمنع ظهور 404 عند الضغط على "التتبع المباشر" بالقائمة الجانبية.
// عند بناء الميزة الفعلية: تحتاج endpoint خلفي يوفر مواقع السائقين لحظياً
// (عبر SignalR على الأرجح، مشابه لـ OpsHub) + مكتبة خرائط بالواجهة.
const OperationsTracking = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">التتبع المباشر</h1>
        <p className="text-gray-500 mt-1">تتبع مواقع السائقين لحظياً على الخريطة</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6">
            <MapPin size={36} className="text-purple-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Construction size={18} className="text-yellow-500" />
            هذه الميزة قيد التطوير
          </h3>
          <p className="text-gray-500">
            التتبع المباشر لمواقع السائقين على الخريطة غير متاح حالياً. سيتم تفعيلها قريباً.
          </p>
        </div>
      </div>
    </div>
  )
}

export default OperationsTracking
