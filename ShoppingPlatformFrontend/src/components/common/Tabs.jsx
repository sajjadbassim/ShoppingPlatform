import { useState, createContext, useContext } from 'react'

/**
 * Tabs Context
 */
const TabsContext = createContext(null)

/**
 * Tabs Component
 * 
 * @param {string} defaultValue - القيمة الافتراضية
 * @param {string} value - القيمة المحددة (controlled)
 * @param {function} onChange - دالة التغيير
 * @param {string} variant - line | pills | enclosed
 */
export const Tabs = ({
  children,
  defaultValue,
  value: controlledValue,
  onValueChange,
  variant = 'line',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  
  const value = controlledValue !== undefined ? controlledValue : internalValue
  
const handleChange = (newValue) => {
  if (controlledValue === undefined) {
    setInternalValue(newValue)
  }
  onValueChange?.(newValue)  // ✅ غيّر من onChange إلى onValueChange
}

  return (
    <TabsContext.Provider value={{ value, onChange: handleChange, variant }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}


/**
 * TabsList Component - قائمة التبويبات
 */
export const TabsList = ({ children, className = '' }) => {
  const { variant } = useContext(TabsContext)

  const variants = {
    line: 'border-b border-gray-200',
    pills: 'bg-gray-100 p-1 rounded-lg',
    enclosed: 'border-b border-gray-200',
  }

  return (
    <div className={`flex gap-1 ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}


/**
 * TabsTrigger Component - زر التبويب
 */
export const TabsTrigger = ({ 
  children, 
  value, 
  disabled = false,
  icon: Icon,
  badge,
  className = '' 
}) => {
  const { value: selectedValue, onChange, variant } = useContext(TabsContext)
  const isSelected = selectedValue === value

  const variants = {
    line: `
      px-4 py-2.5 -mb-px border-b-2 transition-colors
      ${isSelected 
        ? 'border-primary text-primary font-medium' 
        : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
      }
    `,
    pills: `
      px-4 py-2 rounded-md transition-all
      ${isSelected 
        ? 'bg-white text-primary font-medium shadow-sm' 
        : 'text-gray-600 hover:text-gray-800'
      }
    `,
    enclosed: `
      px-4 py-2.5 border border-transparent rounded-t-md -mb-px transition-colors
      ${isSelected 
        ? 'bg-white border-gray-200 border-b-white text-primary font-medium' 
        : 'text-gray-600 hover:text-gray-800'
      }
    `,
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`
        flex items-center gap-2 text-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
    >
      {Icon && <Icon size={18} />}
      {children}
      {badge !== undefined && (
        <span className={`
          px-1.5 py-0.5 text-xs rounded-full
          ${isSelected ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}
        `}>
          {badge}
        </span>
      )}
    </button>
  )
}


/**
 * TabsContent Component - محتوى التبويب
 */
export const TabsContent = ({ children, value, className = '' }) => {
  const { value: selectedValue } = useContext(TabsContext)

  if (selectedValue !== value) return null

  return (
    <div 
      role="tabpanel"
      className={`animate-fade-in ${className}`}
    >
      {children}
    </div>
  )
}


/**
 * SimpleTabs Component - تبويبات بسيطة
 */
export const SimpleTabs = ({
  tabs = [], // [{value, label, icon?, badge?, content}]
  defaultValue,
  value,
  onChange,
  variant = 'line',
  className = '',
}) => {
  return (
    <Tabs 
      defaultValue={defaultValue || tabs[0]?.value} 
      value={value}
      onChange={onChange}
      variant={variant}
      className={className}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger 
            key={tab.value} 
            value={tab.value}
            icon={tab.icon}
            badge={tab.badge}
            disabled={tab.disabled}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="pt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export default Tabs
