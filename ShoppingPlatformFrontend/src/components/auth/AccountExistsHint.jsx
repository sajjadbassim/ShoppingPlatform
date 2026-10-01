// تحت الرسالة المحايدة («إذا كان لديك حساب...»): طريق مباشر للدخول بدل البحث عنه
import { Link } from 'react-router-dom'
import { AlertCircle, LogIn, KeyRound } from 'lucide-react'

export const isAccountExistsMessage = (msg) => typeof msg === 'string' && msg.includes('إذا كان لديك حساب')

const AccountExistsHint = ({ message, identifier = '', className = '' }) => (
  <div className={`p-4 rounded-xl border border-amber-200 bg-amber-50 ${className}`} role="alert">
    <div className="flex items-start gap-2">
      <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">{message}</p>
    </div>
    <div className="flex flex-wrap gap-2 mt-3">
      <Link to="/login" state={{ identifier }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover">
        <LogIn size={16} /> الدخول بكلمة المرور
      </Link>
      <Link to="/forgot-password"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50">
        <KeyRound size={16} /> نسيت كلمة المرور
      </Link>
    </div>
  </div>
)

export default AccountExistsHint
