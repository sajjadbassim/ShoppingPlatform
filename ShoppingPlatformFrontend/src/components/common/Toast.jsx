import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

/**
 * Toast Types & Icons
 */
const toastTypes = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-success',
    iconColor: 'text-white',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-error',
    iconColor: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-warning',
    iconColor: 'text-white',
  },
  info: {
    icon: Info,
    bgColor: 'bg-info',
    iconColor: 'text-white',
  },
}

/**
 * Single Toast Component
 */
const ToastItem = ({ id, type = 'info', message, title, duration = 5000, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false)

  const typeConfig = toastTypes[type] || toastTypes.info
  const Icon = typeConfig.icon

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onRemove(id)
    }, 200)
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg shadow-dropdown min-w-[320px] max-w-md
        ${typeConfig.bgColor} text-white
        ${isExiting ? 'animate-fade-out' : 'animate-slide-up'}
      `}
      role="alert"
    >
      {/* Icon */}
      <Icon size={22} className={`flex-shrink-0 mt-0.5 ${typeConfig.iconColor}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold mb-0.5">{title}</p>
        )}
        <p className={`text-sm ${title ? 'opacity-90' : ''}`}>{message}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="إغلاق"
      >
        <X size={18} />
      </button>
    </div>
  )
}

/**
 * Toast Container Component
 */
const ToastContainer = ({ toasts, removeToast, position = 'bottom-left' }) => {
  const positions = {
    'top-right': 'top-4 left-4',
    'top-left': 'top-4 right-4',
    'bottom-right': 'bottom-[calc(1rem+var(--bottom-nav-h))] left-4',
    'bottom-left': 'bottom-[calc(1rem+var(--bottom-nav-h))] right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-[calc(1rem+var(--bottom-nav-h))] left-1/2 -translate-x-1/2',
  }

  if (toasts.length === 0) return null

  return createPortal(
    <div className={`fixed z-[100] flex flex-col gap-2 ${positions[position]}`}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onRemove={removeToast}
        />
      ))}
    </div>,
    document.body
  )
}

/**
 * Toast Context
 */
const ToastContext = createContext(null)

/**
 * Toast Provider
 */
export const ToastProvider = ({ children, position = 'bottom-left' }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((options) => {
    const id = Date.now() + Math.random()
    const toast = {
      id,
      type: 'info',
      duration: 5000,
      ...options,
    }

    setToasts((prev) => [...prev, toast])

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  // Helper methods
  const success = useCallback((message, options = {}) => {
    return addToast({ ...options, type: 'success', message })
  }, [addToast])

  const error = useCallback((message, options = {}) => {
    return addToast({ ...options, type: 'error', message })
  }, [addToast])

  const warning = useCallback((message, options = {}) => {
    return addToast({ ...options, type: 'warning', message })
  }, [addToast])

  const info = useCallback((message, options = {}) => {
    return addToast({ ...options, type: 'info', message })
  }, [addToast])

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} position={position} />
    </ToastContext.Provider>
  )
}

/**
 * useToast Hook
 */
export const useToast = () => {
  const context = useContext(ToastContext)
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}

export default ToastProvider
