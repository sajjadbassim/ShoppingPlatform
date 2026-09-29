import { forwardRef, useState } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

/**
 * Input Component
 * 
 * @param {string} type - text | email | password | number | tel | search | textarea
 * @param {string} label - عنوان الحقل
 * @param {string} error - رسالة الخطأ
 * @param {string} success - رسالة النجاح
 * @param {string} hint - نص المساعدة
 * @param {ReactNode} icon - أيقونة (اختياري)
 * @param {boolean} disabled - تعطيل الحقل
 * @param {boolean} required - حقل مطلوب
 */
const Input = forwardRef(({
  type = 'text',
  label,
  error,
  success,
  hint,
  icon: Icon,
  disabled = false,
  required = false,
  className = '',
  containerClassName = '',
  rows = 4,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const isPassword = type === 'password'
  const isTextarea = type === 'textarea'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  // تحديد حالة الحقل
  const getStateStyles = () => {
    if (error) return 'border-error focus:border-error focus:ring-error/20'
    if (success) return 'border-success focus:border-success focus:ring-success/20'
    return 'border-gray-300 focus:border-primary focus:ring-primary/20'
  }

  const baseInputStyles = `
    w-full bg-white border rounded-md text-gray-800 placeholder-gray-400
    transition-all duration-200 outline-none
    focus:ring-2
    disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500
    ${getStateStyles()}
    ${Icon ? 'pr-11' : 'pr-4'}
    ${isPassword ? 'pl-11' : 'pl-4'}
  `

  const inputSizeStyles = isTextarea ? 'py-3' : 'h-11 py-2'

  const InputComponent = isTextarea ? 'textarea' : 'input'

  return (
    <div className={`w-full ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-error mr-1">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Icon */}
        {Icon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon size={20} />
          </div>
        )}

        {/* Input/Textarea */}
        <InputComponent
          ref={ref}
          type={isTextarea ? undefined : inputType}
          disabled={disabled}
          required={required}
          rows={isTextarea ? rows : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            ${baseInputStyles}
            ${inputSizeStyles}
            ${className}
          `}
          {...props}
        />

        {/* Password Toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}

        {/* Status Icon */}
        {(error || success) && !isPassword && (
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${error ? 'text-error' : 'text-success'}`}>
            {error ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          </div>
        )}
      </div>

      {/* Hint / Error / Success Message */}
      {(hint || error || success) && (
        <p className={`mt-1.5 text-sm ${
          error ? 'text-error' : 
          success ? 'text-success' : 
          'text-gray-500'
        }`}>
          {error || success || hint}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
