import { forwardRef } from 'react'
import { Check } from 'lucide-react'

/**
 * Checkbox Component
 */
export const Checkbox = forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  error,
  className = '',
  ...props
}, ref) => {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className={`
          w-5 h-5 border-2 rounded transition-all duration-200
          flex items-center justify-center
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${checked 
            ? 'bg-primary border-primary' 
            : 'bg-white border-gray-300 hover:border-gray-400'
          }
          ${error ? 'border-error' : ''}
        `}>
          {checked && <Check size={14} className="text-white" strokeWidth={3} />}
        </div>
      </div>
      {label && (
        <span className="text-sm text-gray-700 select-none">{label}</span>
      )}
    </label>
  )
})

Checkbox.displayName = 'Checkbox'


/**
 * Radio Component
 */
export const Radio = forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  name,
  value,
  className = '',
  ...props
}, ref) => {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <div className="relative">
        <input
          ref={ref}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className={`
          w-5 h-5 border-2 rounded-full transition-all duration-200
          flex items-center justify-center
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${checked 
            ? 'border-primary' 
            : 'bg-white border-gray-300 hover:border-gray-400'
          }
        `}>
          {checked && (
            <div className="w-2.5 h-2.5 bg-primary rounded-full" />
          )}
        </div>
      </div>
      {label && (
        <span className="text-sm text-gray-700 select-none">{label}</span>
      )}
    </label>
  )
})

Radio.displayName = 'Radio'


/**
 * RadioGroup Component
 */
export const RadioGroup = ({
  options = [],
  value,
  onChange,
  name,
  label,
  direction = 'vertical', // vertical | horizontal
  disabled = false,
  error,
  className = '',
}) => {
  return (
    <div className={className}>
      {label && (
        <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      )}
      <div className={`flex ${direction === 'vertical' ? 'flex-col gap-2' : 'flex-row flex-wrap gap-4'}`}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            checked={value === option.value}
            onChange={() => onChange?.(option.value)}
            disabled={disabled || option.disabled}
          />
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-error">{error}</p>
      )}
    </div>
  )
}


/**
 * Toggle/Switch Component
 */
export const Toggle = forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  size = 'md', // sm | md | lg
  className = '',
  ...props
}, ref) => {
  const sizes = {
    sm: { track: 'w-8 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3' },
    md: { track: 'w-10 h-6', thumb: 'w-4 h-4', translate: 'translate-x-4' },
    lg: { track: 'w-12 h-7', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  }

  const currentSize = sizes[size]

  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className={`
          ${currentSize.track} rounded-full transition-colors duration-200
          peer-focus:ring-2 peer-focus:ring-primary/20 peer-focus:ring-offset-1
          ${checked ? 'bg-primary' : 'bg-gray-300'}
        `}>
          <div className={`
            ${currentSize.thumb} bg-white rounded-full shadow-sm
            transition-transform duration-200 absolute top-1 right-1
            ${checked ? `-${currentSize.translate}` : ''}
          `} 
          style={{ transform: checked ? 'translateX(-100%)' : 'translateX(0)', marginRight: checked ? '-4px' : '0' }}
          />
        </div>
      </div>
      {label && (
        <span className="text-sm text-gray-700 select-none">{label}</span>
      )}
    </label>
  )
})

Toggle.displayName = 'Toggle'

export default { Checkbox, Radio, RadioGroup, Toggle }
