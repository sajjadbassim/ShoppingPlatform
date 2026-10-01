import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'
import Button from './Button'

/**
 * Modal Component
 * 
 * @param {boolean} isOpen - حالة الفتح
 * @param {function} onClose - دالة الإغلاق
 * @param {string} title - عنوان النافذة
 * @param {string} size - sm | md | lg | xl | full
 * @param {boolean} closeOnOverlay - الإغلاق عند النقر على الخلفية
 * @param {boolean} showCloseButton - إظهار زر الإغلاق
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
  footer,
  className = '',
}) => {
  const modalRef = useRef(null)

  // أحجام النافذة
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)]',
  }

  // إغلاق بـ Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // منع التمرير في الخلفية
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // التركيز على النافذة
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose?.()
    }
  }

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`
          relative bg-white rounded-t-2xl sm:rounded-lg shadow-modal w-full
          animate-slide-up sm:animate-scale-in overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-none
          ${sizes[size]}
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex-shrink-0">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-auto"
                aria-label="إغلاق"
              >
                <X size={20} className="text-gray-500" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 flex-1 min-h-0 sm:max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}


/**
 * ConfirmModal Component - نافذة التأكيد
 * 
 * @param {string} type - danger | warning | success | info
 */
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد',
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'danger',
  loading = false,
}) => {
  const types = {
    danger: {
      icon: AlertTriangle,
      iconBg: 'bg-error-light',
      iconColor: 'text-error',
      buttonVariant: 'danger',
    },
    warning: {
      icon: AlertCircle,
      iconBg: 'bg-warning-light',
      iconColor: 'text-warning',
      buttonVariant: 'primary',
    },
    success: {
      icon: CheckCircle,
      iconBg: 'bg-success-light',
      iconColor: 'text-success',
      buttonVariant: 'primary',
    },
    info: {
      icon: Info,
      iconBg: 'bg-info-light',
      iconColor: 'text-info',
      buttonVariant: 'primary',
    },
  }

  const currentType = types[type]
  const Icon = currentType.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center py-4">
        {/* Icon */}
        <div className={`w-16 h-16 ${currentType.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon size={32} className={currentType.iconColor} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>

        {/* Message */}
        {message && (
          <p className="text-gray-600 mb-6">{message}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button 
            variant={currentType.buttonVariant} 
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default Modal
