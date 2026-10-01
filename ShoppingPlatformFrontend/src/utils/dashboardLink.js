// لوحة التحكم الخاصة بكل دور — الزبون ليس له لوحة.
// الخادم يرسل الدور بحروف كبيرة (ADMIN, VENDOR, OPS, DRIVER)، لذلك المقارنة لا تفرّق بين الحالتين
import { LayoutDashboard, Store, Truck, Bike } from 'lucide-react'

const LINKS = {
  ADMIN: { path: '/admin', label: 'لوحة الإدارة', hint: 'إدارة المنصة', icon: LayoutDashboard },
  VENDOR: { path: '/vendor', label: 'لوحة البائع', hint: 'إدارة متجرك وطلباته', icon: Store },
  OPS: { path: '/operations', label: 'لوحة العمليات', hint: 'الطلبات والتوصيل', icon: Truck },
  DRIVER: { path: '/driver', label: 'لوحة السائق', hint: 'طلباتك والتوصيل', icon: Bike },
}

export const getDashboardLink = (role) => LINKS[String(role || '').toUpperCase()] || null
