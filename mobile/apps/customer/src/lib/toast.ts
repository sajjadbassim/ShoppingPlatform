// إشعارات النظام (Toast) كما في الويب: شريط ملوّن أعلى الشريط السفلي يختفي تلقائياً.
// تُستدعى من أي مكان (شاشة أو دالة عادية): toast.success('تمت الإضافة للسلة')
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}

type Listener = (items: ToastItem[]) => void;

const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l(items));

export const subscribeToasts = (listener: Listener) => {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
};

export const dismissToast = (id: number) => {
  items = items.filter((t) => t.id !== id);
  emit();
};

const show = (type: ToastType, message: string, options?: { title?: string; duration?: number }) => {
  if (!message) return;
  // نفس الرسالة لا تتكرر فوق بعضها
  if (items.some((t) => t.type === type && t.message === message)) return;
  items = [...items, { id: nextId++, type, message, title: options?.title, duration: options?.duration ?? 4000 }].slice(-MAX_VISIBLE);
  emit();
};

export const toast = {
  success: (message: string, options?: { title?: string; duration?: number }) => show('success', message, options),
  error: (message: string, options?: { title?: string; duration?: number }) => show('error', message, options),
  warning: (message: string, options?: { title?: string; duration?: number }) => show('warning', message, options),
  info: (message: string, options?: { title?: string; duration?: number }) => show('info', message, options),
};

// رسالة الميزات غير المتوفرة بعد
export const comingSoonToast = () => toast.info('هذه الميزة قادمة في تحديث قريب');

// نتيجة إعادة الطلب: نجاح كامل / جزئي / فشل
export const toastReorderResult = (added: number, total: number, failed: { name: string; message: string }[]) => {
  const details = failed.map((f) => `${f.name} (${f.message})`).join('، ');
  if (added > 0 && failed.length === 0) toast.success(`تمت إضافة ${added} منتج للسلة`);
  else if (added > 0) toast.warning(`تمت إضافة ${added} من ${total} منتج. تعذّرت: ${details}`, { duration: 6000 });
  else toast.error(`تعذّرت إضافة المنتجات: ${details}`, { duration: 6000 });
};
