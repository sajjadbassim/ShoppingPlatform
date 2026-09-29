// src/pages/operations/OperationsReports.jsx
import { BarChart3, Construction } from 'lucide-react'

// ✅ صفحة مؤقتة (Placeholder) — تقارير العمليات (أداء السائقين، أوقات التوصيل، إلخ)
// غير مبنية بعد لا في الفرونت اند ولا في الباك اند. هذه الصفحة موجودة فقط
// لمنع ظهور 404 عند الضغط على "التقارير" بالقائمة الجانبية.
// عند بناء الميزة الفعلية: تحتاج endpoint خلفي مخصص لتقارير العمليات
// (مشابه لـ AdminReports/AdminController لكن بمقاييس عمليات التوصيل).
const OperationsReports = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
        <p className="text-gray-500 mt-1">تقارير أداء التوصيل والسائقين</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <BarChart3 size={36} className="text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Construction size={18} className="text-yellow-500" />
            هذه الميزة قيد التطوير
          </h3>
          <p className="text-gray-500">
            تقارير أداء التوصيل والسائقين غير متاحة حالياً. سيتم تفعيلها قريباً.
          </p>
        </div>
      </div>
    </div>
  )
}

export default OperationsReports
