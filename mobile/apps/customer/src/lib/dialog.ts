// نوافذ التأكيد والقوائم السفلية بتصميم التطبيق بدل Alert الأصلي.
// confirmDialog({ title, message, confirmText, tone: 'danger', onConfirm }) — actionSheet({ title, actions })
import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  // danger = أحمر (حذف/إفراغ)، primary = لون العلامة
  tone?: 'danger' | 'primary';
  icon?: IconName;
  onConfirm: () => void | Promise<void>;
}

export interface SheetAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

export interface SheetOptions {
  title?: string;
  actions: SheetAction[];
}

export type DialogState = ({ kind: 'confirm' } & ConfirmOptions) | ({ kind: 'sheet' } & SheetOptions) | null;

type Listener = (state: DialogState) => void;

let current: DialogState = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(current));

export const subscribeDialog = (listener: Listener) => {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
};

export const closeDialog = () => {
  current = null;
  emit();
};

export const confirmDialog = (options: ConfirmOptions) => {
  current = { kind: 'confirm', ...options };
  emit();
};

export const actionSheet = (options: SheetOptions) => {
  current = { kind: 'sheet', ...options };
  emit();
};
