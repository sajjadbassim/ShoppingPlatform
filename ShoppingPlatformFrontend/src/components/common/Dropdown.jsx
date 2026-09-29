import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

/**
 * Dropdown Component
 * 
 * @param {ReactNode} trigger - عنصر التفعيل
 * @param {Array} items - [{label, icon?, onClick?, danger?, divider?}]
 * @param {string} align - right | left
 * @param {string} position - bottom | top
 */
const Dropdown = ({
  trigger,
  items = [],
  align = 'right',
  position = 'bottom',
  closeOnSelect = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const dropdownRef = useRef(null)
  const menuRef = useRef(null)

  // القائمة تُرسم في body بموضع fixed حتى لا يقصّها overflow الجداول والبطاقات،
  // وتنقلب للأعلى تلقائياً إذا لم تكفِ المساحة بالأسفل
  const updatePosition = useCallback(() => {
    if (!dropdownRef.current || !menuRef.current) return
    const rect = dropdownRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current.offsetHeight
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    const openUp = position === 'top'
      ? spaceAbove >= menuHeight + gap || spaceAbove > spaceBelow
      : spaceBelow < menuHeight + gap && spaceAbove > spaceBelow

    const style = openUp
      ? { bottom: window.innerHeight - rect.top + gap }
      : { top: rect.bottom + gap }

    if (align === 'left') style.left = rect.left
    else style.right = window.innerWidth - rect.right

    setMenuStyle(style)
  }, [align, position])

  useLayoutEffect(() => {
    if (!isOpen) { setMenuStyle(null); return }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // إغلاق بـ Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleItemClick = (item) => {
    item.onClick?.()
    if (closeOnSelect) setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {/* Menu */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={menuStyle || { top: 0, left: 0, visibility: 'hidden' }}
          className="fixed z-[60] min-w-[180px] bg-white border border-gray-200 rounded-md shadow-dropdown py-1 animate-fade-in"
        >
          {items.map((item, index) => {
            // Divider
            if (item.divider) {
              return <div key={index} className="border-t border-gray-200 my-1" />
            }

            // Menu Item
            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={`
                  w-full px-4 py-2.5 text-right text-sm flex items-center gap-2
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${item.danger 
                    ? 'text-error hover:bg-error-light' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {item.icon && <item.icon size={18} />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-gray-400">{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}


/**
 * DropdownButton Component - زر مع قائمة منسدلة
 */
export const DropdownButton = ({
  label,
  items = [],
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className = '',
}) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
    outline: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
  }

  const trigger = (
    <button 
      className={`
        inline-flex items-center gap-2 rounded-md font-medium transition-colors
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {Icon && <Icon size={18} />}
      {label}
      <ChevronDown size={16} />
    </button>
  )

  return <Dropdown trigger={trigger} items={items} />
}


/**
 * ContextMenu Component - قائمة سياقية
 */
export const ContextMenu = ({
  children,
  items = [],
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleContextMenu = (e) => {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
    setIsOpen(true)
  }

  const handleItemClick = (item) => {
    item.onClick?.()
    setIsOpen(false)
  }

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        {children}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ top: position.y, left: position.x }}
          className="fixed z-50 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-dropdown py-1 animate-fade-in"
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="border-t border-gray-200 my-1" />
            }

            return (
              <button
                key={index}
                onClick={() => handleItemClick(item)}
                className={`
                  w-full px-4 py-2 text-right text-sm flex items-center gap-2
                  transition-colors
                  ${item.danger 
                    ? 'text-error hover:bg-error-light' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {item.icon && <item.icon size={16} />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

export default Dropdown
