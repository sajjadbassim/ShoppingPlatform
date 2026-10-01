import { useState, useRef, useEffect } from 'react'
import { localizeStatusCodes, ORDER_STATUS_AR, ORDER_STATUS_CHIP } from '../../utils/orderStatusText'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Trash2, X, ChevronLeft } from 'lucide-react'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import PushPrompt from './PushPrompt'

// إشعار له وجهة (طلب، إرجاع، تقييم) — الخادم يحدد الصفحة المناسبة لدور المستخدم
const LINK_KEYS = ['orderId', 'subOrderId', 'returnId', 'reviewId']
const isLinkable = (n) => n?.data && typeof n.data === 'object' && LINK_KEYS.some(k => n.data[k])
const linkLabel = (n) => n.data?.returnId ? 'عرض الإرجاع' : n.data?.reviewId ? 'عرض التقييم' : 'عرض الطلب'

const useOpenNotification = (onNavigate) => {
  const navigate = useNavigate()
  const markAsRead = useNotificationsStore((s) => s.markAsRead)
  return async (e, n) => {
    // أزرار الحذف والتحديد كمقروء داخل الإشعار تعمل كما هي
    if (e.target.closest('button') || !isLinkable(n)) return
    if (!n.isRead) markAsRead(n.id)
    try {
      const r = await apiGet(API_ENDPOINTS.NOTIFICATIONS.LINK(n.id))
      const path = r.data?.data?.path
      if (path) { onNavigate?.(); navigate(path) }
    } catch { /* الإشعار حُذف أو لا وجهة له */ }
  }
}

const OpenHint = ({ n, className = '' }) => isLinkable(n) ? (
  <span className={`inline-flex items-center gap-0.5 text-primary font-medium ${className}`}>{linkLabel(n)}<ChevronLeft size={14} /></span>
) : null

// زر الإشعارات مع القائمة المنسدلة
export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotificationsStore()
  const openNotification = useOpenNotification(() => setIsOpen(false))

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (hours < 24) return `منذ ${hours} ساعة`
    if (days < 7) return `منذ ${days} يوم`
    return date.toLocaleDateString('ar-IQ')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
      >
        <Bell size={22} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        // على الهاتف: بعرض الشاشة تحت الهيدر مباشرة حتى لا تُقص، وعلى الشاشات الأكبر: قائمة منسدلة بجانب الزر
        <div className="fixed inset-x-3 top-[76px] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80 bg-white rounded-xl shadow-dropdown border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900">الإشعارات</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck size={14} />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[calc(100dvh-220px)] sm:max-h-[400px] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  onClick={(e) => openNotification(e, notification)}
                  className={`${isLinkable(notification) ? 'cursor-pointer active:bg-gray-100 ' : ''}px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{notification.icon || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm break-words min-w-0 ${!notification.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-3 break-words">{localizeStatusCodes(notification.message)}</p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="flex items-center gap-2 min-w-0">
                          {notification.status && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ORDER_STATUS_CHIP[notification.status] || 'bg-gray-100 text-gray-600'}`}>
                              {ORDER_STATUS_AR[notification.status] || notification.status}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(notification.createdAt)}</span>
                          <OpenHint n={notification} className="text-xs whitespace-nowrap" />
                        </span>
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Check size={12} />
                            تحديد كمقروء
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center bg-gray-50">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-primary hover:underline"
              >
                عرض جميع الإشعارات
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// صفحة الإشعارات الكاملة
export const NotificationsPage = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationsStore()
  const openNotification = useOpenNotification()

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="container-main">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">الإشعارات</h1>
              <p className="text-gray-500 mt-1">{unreadCount} إشعار غير مقروء</p>
            </div>
            <PushPrompt className="w-full order-last" dismissible={false} />
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  تحديد الكل كمقروء
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg">لا توجد إشعارات</p>
                <p className="text-sm mt-1">ستظهر هنا إشعارات الطلبات والعروض</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={(e) => openNotification(e, notification)}
                  className={`${isLinkable(notification) ? 'cursor-pointer active:bg-gray-100 ' : ''}p-4 hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <span className="text-2xl sm:text-3xl">{notification.icon || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 break-words">
                            <p className={`${!notification.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <p className="text-gray-600 mt-1">{localizeStatusCodes(notification.message)}</p>
                          </div>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-3">
                          <span className="flex items-center gap-2 min-w-0">
                            {notification.status && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ORDER_STATUS_CHIP[notification.status] || 'bg-gray-100 text-gray-600'}`}>
                                {ORDER_STATUS_AR[notification.status] || notification.status}
                              </span>
                            )}
                            <span className="text-sm text-gray-400 whitespace-nowrap">{formatTime(notification.createdAt)}</span>
                            <OpenHint n={notification} className="text-sm whitespace-nowrap" />
                          </span>
                          <div className="flex items-center gap-2">
                            {!notification.isRead && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-sm text-primary hover:underline"
                              >
                                تحديد كمقروء
                              </button>
                            )}
                            <button
                              onClick={() => removeNotification(notification.id)}
                              className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationBell
