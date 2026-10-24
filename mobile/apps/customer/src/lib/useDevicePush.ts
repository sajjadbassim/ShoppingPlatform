import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { disableDevicePush, enableDevicePush, getDevicePushStatus, type DevicePushStatus } from './pushNotifications';
import { confirmDialog } from './dialog';
import { toast } from './toast';

// حالة «إشعارات هذا الجهاز» وتبديلها من الإعدادات. تُعاد قراءتها عند الرجوع من إعدادات النظام
export function useDevicePush() {
  const [status, setStatus] = useState<DevicePushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => getDevicePushStatus().then(setStatus).catch(() => {}), []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const toggle = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!on) {
        await disableDevicePush();
        toast.success('تم إيقاف إشعارات هذا الجهاز');
      } else {
        const result = await enableDevicePush();
        if (result === 'enabled') toast.success('ستصلك الإشعارات على هذا الجهاز');
        else if (result === 'unsupported') toast.info('إشعارات الجهاز غير متاحة في هذه النسخة');
        else if (result === 'denied') toast.warning('لم تُمنح صلاحية الإشعارات');
        else
          confirmDialog({
            title: 'الإشعارات محجوبة',
            message: 'اسمح لوسيط بإرسال الإشعارات من إعدادات النظام ثم ارجع للتطبيق.',
            confirmText: 'فتح الإعدادات',
            icon: 'notifications-off-outline',
            onConfirm: () => Linking.openSettings(),
          });
      }
    } catch {
      toast.error('تعذّر تحديث إشعارات الجهاز');
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return { status, busy, toggle };
}
